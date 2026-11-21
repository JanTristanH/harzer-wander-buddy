import type { MapBounds, OfflineMapPack, OfflineMapProgress } from './offline-maps';
export async function listOfflineMaps(): Promise<OfflineMapPack[]> { return []; }
export async function removeOfflineMap(_pack: OfflineMapPack) {}
export function offlineMapDirectory(_pack: OfflineMapPack) { return { uri: '' }; }
export async function saveOfflineMap(_name: string, _bounds: MapBounds, _signal: AbortSignal,
  _onProgress: (progress: OfflineMapProgress) => void): Promise<OfflineMapPack> {
  throw new Error('Offline-Karten sind in den Android- und iOS-Apps verfügbar.');
}
