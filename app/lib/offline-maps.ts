/** Downloads are deliberately serial: OpenFreeMap permits at most four concurrent requests. */
export const OFFLINE_MAP_MAX_BYTES = 50_000_000;
export const OFFLINE_MAP_MAX_TILES = 3000;
export const OFFLINE_MAP_MIN_ZOOM = 10;
export const OFFLINE_MAP_MAX_ZOOM = 14;
export const OFFLINE_MAP_USER_AGENT = 'HarzerWanderBuddy/OfflineMaps (+https://www.harzer-wander-buddy.de)';
export type MapBounds = [west: number, south: number, east: number, north: number];
export type OfflineMapPack = {
  id: string; name: string; bounds: MapBounds; bytes: number; createdAt: string; tileCount: number;
};
export type OfflineMapProgress = { completed: number; total: number; bytes: number };
export const OFFLINE_MAP_AREAS = [
  { name: 'Brocken & Schierke', latitude: 51.789, longitude: 10.635 },
  { name: 'Wernigerode', latitude: 51.83, longitude: 10.785 },
  { name: 'Thale & Bodetal', latitude: 51.737, longitude: 11.025 },
  { name: 'Goslar & Hahnenklee', latitude: 51.87, longitude: 10.37 },
  { name: 'Braunlage', latitude: 51.727, longitude: 10.61 },
];

export function boundsAround(latitude: number, longitude: number): MapBounds {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 51.3 || latitude > 52.1 || longitude < 9.9 || longitude > 11.5) {
    throw new Error('Bitte wähle einen Kartenausschnitt im Harz.');
  }
  // Approximately 10 x 10 km at Harz latitude.
  return [longitude - 0.072, latitude - 0.045, longitude + 0.072, latitude + 0.045];
}

export function tilesForBounds(bounds: MapBounds) {
  const [west, south, east, north] = bounds;
  if (bounds.some(value => !Number.isFinite(value)) || west >= east || south >= north ||
    west < -180 || east > 180 || south < -85 || north > 85) throw new Error('Ungültiger Kartenausschnitt.');
  const tiles: { z: number; x: number; y: number }[] = [];
  for (let z = OFFLINE_MAP_MIN_ZOOM; z <= OFFLINE_MAP_MAX_ZOOM; z++) {
    const n = 2 ** z;
    const x = (lon: number) => Math.floor((lon + 180) / 360 * n);
    const y = (lat: number) => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    const x0 = x(west), x1 = Math.min(n - 1, x(east)), y0 = y(north), y1 = y(south);
    if (tiles.length + (x1 - x0 + 1) * (y1 - y0 + 1) > OFFLINE_MAP_MAX_TILES) {
      throw new Error('Dieser Ausschnitt ist zu groß. Bitte wähle einen kleineren Bereich.');
    }
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) tiles.push({ z, x: tx, y: ty });
  }
  return tiles;
}

function providerUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'tiles.openfreemap.org' || url.username || url.password || url.port) {
    throw new Error('Die Kartenquelle enthält eine unerwartete Download-Adresse.');
  }
  return value;
}

export type OfflineMapDownloadIO = {
  read: (url: string, remainingBytes: number, signal: AbortSignal) => Promise<Uint8Array>;
  write: (relativePath: string, data: Uint8Array) => Promise<void>;
};

/** A pack is only usable once every tile and glyph has been persisted successfully. */
export async function downloadOfflineMap(
  bounds: MapBounds, io: OfflineMapDownloadIO, signal: AbortSignal,
  onProgress: (progress: OfflineMapProgress) => void,
) {
  const tiles = tilesForBounds(bounds);
  const glyphRanges = ['0-255', '256-511', '512-767', '768-1023', '8192-8447'];
  let bytes = 0, completed = 0;
  const total = 1 + tiles.length + glyphRanges.length;
  async function read(url: string) {
    if (signal.aborted) throw new Error('Download abgebrochen.');
    const data = await io.read(providerUrl(url), OFFLINE_MAP_MAX_BYTES - bytes, signal);
    if (!data.byteLength || bytes + data.byteLength > OFFLINE_MAP_MAX_BYTES) {
      throw new Error('Der Download überschreitet 50 MB. Bitte wähle einen anderen Ausschnitt.');
    }
    bytes += data.byteLength;
    return data;
  }
  const tileJson = JSON.parse(new TextDecoder().decode(await read('https://tiles.openfreemap.org/planet'))) as {
    tiles?: string[]; maxzoom?: number; minzoom?: number; scheme?: string;
  };
  const template = tileJson.tiles?.[0];
  if (!template || !template.includes('{z}') || !template.includes('{x}') || !template.includes('{y}') ||
    (tileJson.scheme && tileJson.scheme !== 'xyz') || (tileJson.maxzoom ?? 14) < 14 || (tileJson.minzoom ?? 0) > 10) {
    throw new Error('Die Kartenquelle unterstützt diesen Offline-Download nicht.');
  }
  onProgress({ bytes, completed: ++completed, total });
  for (const tile of tiles) {
    const relativePath = `${tile.z}/${tile.x}/${tile.y}.pbf`;
    const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
    const data = await read(url);
    await io.write(relativePath, data);
    onProgress({ bytes, completed: ++completed, total });
  }
  for (const range of glyphRanges) {
    const data = await read(`https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/${range}.pbf`);
    await io.write(`fonts/Noto Sans Regular/${range}.pbf`, data);
    onProgress({ bytes, completed: ++completed, total });
  }
  if (signal.aborted) throw new Error('Download abgebrochen.');
  return { bytes, tileCount: tiles.length };
}
