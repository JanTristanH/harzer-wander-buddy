import { Directory, File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { downloadOfflineMap, OFFLINE_MAP_USER_AGENT, type MapBounds, type OfflineMapPack, type OfflineMapProgress } from './offline-maps';

const root = () => new Directory(Paths.document, 'offline-hiking-maps-v1');
let downloading = false;
export const offlineMapDirectory = (pack: OfflineMapPack) => new Directory(root(), pack.id);

export async function listOfflineMaps(): Promise<OfflineMapPack[]> {
  const directory = root();
  if (!directory.exists) return [];
  const packs: OfflineMapPack[] = [];
  for (const entry of directory.list()) {
    if (!(entry instanceof Directory)) continue;
    const manifest = new File(entry, 'complete.json');
    if (!manifest.exists) {
      if (!downloading) entry.delete(); // Remove interrupted, unusable downloads on next launch.
      continue;
    }
    try {
      const pack = JSON.parse(await manifest.text()) as OfflineMapPack;
      if (pack.id === entry.name && /^[a-z0-9-]+$/.test(pack.id) && Array.isArray(pack.bounds) && pack.bounds.length === 4) packs.push(pack);
    } catch { /* A corrupt pack is never exposed as ready. */ }
  }
  return packs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeOfflineMap(pack: OfflineMapPack) {
  if (!/^[a-z0-9-]+$/.test(pack.id)) throw new Error('Ungültiges Kartenpaket.');
  const directory = offlineMapDirectory(pack);
  if (directory.exists) directory.delete();
}

async function readResource(url: string, remainingBytes: number, parentSignal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort);
  if (parentSignal.aborted) abort();
  const timeout = setTimeout(abort, 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': OFFLINE_MAP_USER_AGENT } });
    if (!response.ok) throw new Error(`Kartenquelle nicht erreichbar (HTTP ${response.status}). Bitte erneut versuchen.`);
    if (Number(response.headers.get('content-length') ?? 0) > remainingBytes) throw new Error('Der Download überschreitet 50 MB.');
    if (!response.body) throw new Error('Kartendaten konnten nicht gelesen werden.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > remainingBytes) {
          controller.abort();
          throw new Error('Der Download überschreitet 50 MB.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
    return data;
  } finally {
    controller.abort(); // Release any unread response body after errors or byte-limit rejection.
    clearTimeout(timeout);
    parentSignal.removeEventListener('abort', abort);
  }
}

export async function saveOfflineMap(name: string, bounds: MapBounds, signal: AbortSignal,
  onProgress: (progress: OfflineMapProgress) => void): Promise<OfflineMapPack> {
  if (downloading) throw new Error('Es wird bereits eine Karte heruntergeladen.');
  downloading = true;
  const pack: OfflineMapPack = { id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Mein Harzausschnitt', bounds, bytes: 0, tileCount: 0, createdAt: new Date().toISOString() };
  const directory = offlineMapDirectory(pack);
  try {
    directory.create({ intermediates: true });
    const result = await downloadOfflineMap(bounds, {
      read: readResource,
      write: async (relativePath, data) => {
        const parts = relativePath.split('/');
        const fileName = parts.pop()!;
        const parent = new Directory(directory, ...parts);
        parent.create({ intermediates: true, idempotent: true });
        new File(parent, fileName).write(data);
      },
    }, signal, onProgress);
    Object.assign(pack, result);
    // Commit marker is written last; partial packs are never listed as offline-ready.
    new File(directory, 'complete.json').write(JSON.stringify(pack));
    return pack;
  } catch (error) {
    if (directory.exists) directory.delete();
    if (signal.aborted) throw new Error('Download abgebrochen.');
    throw error;
  } finally { downloading = false; }
}
