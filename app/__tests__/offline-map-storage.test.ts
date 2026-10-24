import { Directory, File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { listOfflineMaps, offlineMapDirectory, removeOfflineMap, saveOfflineMap } from '@/lib/offline-map-storage';
import { boundsAround, OFFLINE_MAP_USER_AGENT } from '@/lib/offline-maps';

jest.mock('expo-file-system', () => {
  const nodes = new Map();
  const uri = (parts: any[]) => parts.map(part => typeof part === 'string' ? part : part.uri).join('/').replace(/(?<!:)\/{2,}/g, '/');
  class Directory {
    uri: string;
    constructor(...parts: any[]) { this.uri = uri(parts); }
    get name() { return this.uri.split('/').pop(); }
    get exists() { return nodes.has(this.uri); }
    create() {
      nodes.set(this.uri, { directory: true });
      let parent = this.uri.slice(0, this.uri.lastIndexOf('/'));
      while (parent.length > 'file://'.length) { nodes.set(parent, { directory: true }); parent = parent.slice(0, parent.lastIndexOf('/')); }
    }
    delete() { for (const key of nodes.keys()) if (key === this.uri || key.startsWith(this.uri + '/')) nodes.delete(key); }
    list() { return [...nodes.entries()].filter(([key]) => key.startsWith(this.uri + '/') && !key.slice(this.uri.length + 1).includes('/'))
      .map(([key, value]) => value.directory ? new Directory(key) : new File(key)); }
  }
  class File {
    uri: string;
    constructor(...parts: any[]) { this.uri = uri(parts); }
    get exists() { return nodes.has(this.uri); }
    write(data: string | Uint8Array) { nodes.set(this.uri, { data }); }
    async text() { return nodes.get(this.uri).data; }
  }
  return { Directory, File, Paths: { document: 'file:///documents' }, __reset: () => nodes.clear() };
});
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const mockFetch = fetch as jest.Mock;
const mockReset = jest.requireMock('expo-file-system').__reset;
const encoder = new TextEncoder();
const bounds = boundsAround(51.789, 10.635);
const response = (data: Uint8Array) => ({ ok: true, headers: { get: () => null }, body: {
  getReader: () => { let sent = false; return { read: async () => {
    if (sent) return { done: true }; sent = true; return { done: false, value: data };
  }, releaseLock: () => {} }; },
} });
beforeEach(() => {
  mockReset();
  mockFetch.mockReset().mockImplementation(async (url: string) => response(url.endsWith('/planet')
    ? encoder.encode(JSON.stringify({ tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'] }))
    : new Uint8Array([1, 2, 3])));
});
test('persists a completed pack across fresh listing and deletes all of its resources', async () => {
  const pack = await saveOfflineMap('Brocken', bounds, new AbortController().signal, jest.fn());
  expect(await listOfflineMaps()).toEqual([pack]);
  expect(new File(offlineMapDirectory(pack), 'fonts', 'Noto Sans Regular', '0-255.pbf').exists).toBe(true);
  expect(mockFetch.mock.calls.every(([, options]) => options.headers['User-Agent'] === OFFLINE_MAP_USER_AGENT)).toBe(true);
  await removeOfflineMap(pack);
  expect(await listOfflineMaps()).toEqual([]);
  expect(offlineMapDirectory(pack).exists).toBe(false);
});
test('interrupted downloads never appear ready and are removed after network errors', async () => {
  mockFetch.mockRejectedValueOnce(new Error('network disconnected'));
  await expect(saveOfflineMap('Brocken', bounds, new AbortController().signal, jest.fn())).rejects.toThrow('network disconnected');
  expect(await listOfflineMaps()).toEqual([]);
  const abandoned = new Directory(Paths.document, 'offline-hiking-maps-v1', 'map-abandoned');
  abandoned.create();
  new File(abandoned, 'partial.pbf').write('partial');
  expect(await listOfflineMaps()).toEqual([]);
  expect(abandoned.exists).toBe(false);
});
test('cancellation never writes a completion manifest and permits a later retry', async () => {
  const controller = new AbortController();
  await expect(saveOfflineMap('Brocken', bounds, controller.signal, () => controller.abort())).rejects.toThrow('abgebrochen');
  expect(await listOfflineMaps()).toEqual([]);
  const retry = await saveOfflineMap('Retry', bounds, new AbortController().signal, jest.fn());
  expect(await listOfflineMaps()).toEqual([retry]);
});
test('rejects declared oversized responses before consuming body data', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, headers: { get: () => '50000001' }, body: { getReader: jest.fn() } });
  await expect(saveOfflineMap('Brocken', bounds, new AbortController().signal, jest.fn())).rejects.toThrow('50 MB');
  expect(await listOfflineMaps()).toEqual([]);
});
