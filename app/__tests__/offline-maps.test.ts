import { boundsAround, downloadOfflineMap, OFFLINE_MAP_MAX_BYTES, tilesForBounds } from '@/lib/offline-maps';
import { offlineMapStyle } from '@/lib/offline-map-style';
const encoder = new TextEncoder();
const tileJSON = encoder.encode(JSON.stringify({ tiles: ['https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf'], maxzoom: 14 }));
const bounds = boundsAround(51.789, 10.635);
function io() { return { read: jest.fn(async () => new Uint8Array([1, 2, 3])), write: jest.fn(async () => {}) }; }

test('covers the selected geographic bounds with bounded XYZ tile coordinates', () => {
  const tiles = tilesForBounds(bounds);
  expect(tiles.length).toBeGreaterThan(20);
  expect(tiles.length).toBeLessThan(3000);
  expect(new Set(tiles.map(tile => tile.z))).toEqual(new Set([10, 11, 12, 13, 14]));
  expect(new Set(tiles.map(tile => JSON.stringify(tile))).size).toBe(tiles.length);
  expect(() => tilesForBounds([-180, -80, 180, 80])).toThrow('zu groß');
  expect(() => boundsAround(NaN, 10)).toThrow();
  expect(() => boundsAround(0, 0)).toThrow();
});
test('downloads tiles and glyphs serially, enforces provider host and reports complete progress', async () => {
  const storage = io();
  let active = 0, maxActive = 0;
  const requests: string[] = [];
  storage.read.mockImplementation(async (url?: string) => {
    requests.push(url!); active++; maxActive = Math.max(maxActive, active);
    await Promise.resolve(); active--;
    return url!.endsWith('/planet') ? tileJSON : new Uint8Array([1, 2, 3]);
  });
  const progress = jest.fn();
  const result = await downloadOfflineMap(bounds, storage, new AbortController().signal, progress);
  expect(maxActive).toBe(1);
  expect(result.tileCount).toBe(tilesForBounds(bounds).length);
  expect(storage.write).toHaveBeenCalledTimes(result.tileCount + 5);
  expect(requests.every(url => url.startsWith('https://tiles.openfreemap.org/'))).toBe(true);
  expect(storage.write).toHaveBeenCalledWith('fonts/Noto Sans Regular/0-255.pbf', expect.any(Uint8Array));
  const last = progress.mock.calls.at(-1)![0];
  expect(last.completed).toBe(last.total);
  expect(result.bytes).toBe(tileJSON.length + 3 * (result.tileCount + 5));
});
test('never completes partial downloads and supports cancellation between requests', async () => {
  const storage = io();
  storage.read.mockResolvedValueOnce(tileJSON).mockRejectedValueOnce(new Error('network failed'));
  await expect(downloadOfflineMap(bounds, storage, new AbortController().signal, jest.fn())).rejects.toThrow('network failed');
  const controller = new AbortController();
  storage.read.mockReset().mockImplementation(async () => { controller.abort(); return tileJSON; });
  await expect(downloadOfflineMap(bounds, storage, controller.signal, jest.fn())).rejects.toThrow('abgebrochen');
  expect(storage.write).not.toHaveBeenCalled();
});
test('rejects resources larger than remaining budget and does not persist them', async () => {
  const storage = io();
  storage.read.mockResolvedValueOnce(tileJSON).mockResolvedValueOnce(new Uint8Array(OFFLINE_MAP_MAX_BYTES));
  await expect(downloadOfflineMap(bounds, storage, new AbortController().signal, jest.fn())).rejects.toThrow('50 MB');
  expect(storage.write).not.toHaveBeenCalled();
});
test('rejects unknown providers and incompatible tile schemes', async () => {
  const storage = io();
  storage.read.mockResolvedValueOnce(encoder.encode(JSON.stringify({ tiles: ['https://evil.example/{z}/{x}/{y}'] })));
  await expect(downloadOfflineMap(bounds, storage, new AbortController().signal, jest.fn())).rejects.toThrow('unerwartete');
  expect(storage.read).toHaveBeenCalledTimes(1);
  storage.read.mockResolvedValueOnce(encoder.encode(JSON.stringify({ tiles: ['https://tiles.openfreemap.org/{z}/{x}/{y}'], scheme: 'tms' })));
  await expect(downloadOfflineMap(bounds, storage, new AbortController().signal, jest.fn())).rejects.toThrow('unterstützt');
});
test('offline style has no HTTP resources, preserves attribution and includes walking paths', () => {
  const style = offlineMapStyle({ id: 'map-test', name: 'Test', bounds, bytes: 10, createdAt: '', tileCount: 1 }, 'file:///documents/maps/map-test/');
  expect(JSON.stringify(style)).not.toMatch(/https?:/);
  expect(style.glyphs).toBe('file:///documents/maps/map-test/fonts/{fontstack}/{range}.pbf');
  expect(style.layers.find(layer => layer.id === 'walking-paths')).toBeDefined();
  expect(JSON.stringify(style.sources)).toContain('OpenStreetMap');
});
