let mockPreview: { pr: string; sha: string; mapsConfigured: boolean } | undefined;
let mockStored: string | null = null;
const mockGet = jest.fn(async () => mockStored);
const mockSet = jest.fn(async (_key: string, value: string) => { mockStored = value; });
const mockRemove = jest.fn(async () => { mockStored = null; });
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: () => mockGet(), setItem: (...args: [string, string]) => mockSet(...args), removeItem: () => mockRemove() },
}));
jest.mock('expo-constants', () => ({
  __esModule: true, default: {
    nativeAppVersion: '1.8.0',
    get expoConfig() { return { extra: { preview: mockPreview, backendUrl: 'https://preview.example' } }; },
  },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 36 } }));

// Reload only this module so every case has a separate persisted-write queue.
function load() {
  let module: typeof import('@/lib/preview-diagnostics');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jest.isolateModules(() => { module = require('@/lib/preview-diagnostics'); });
  return module!;
}

beforeEach(() => {
  mockPreview = { pr: '110', sha: 'test-sha', mapsConfigured: false };
  mockStored = null;
  jest.clearAllMocks();
});

it('disables all persistence and the missing-key guard outside a PR preview', async () => {
  mockPreview = undefined;
  const store = load();
  expect(store.isPreviewBuild).toBe(false);
  expect(store.isPreviewMapBlocked).toBe(false);
  await store.recordPreviewEvent('test');
  expect(await store.readPreviewLogs()).toEqual([]);
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
});

it('persists ordered events, reloads them after a new session and keeps only the last 100', async () => {
  const store = load();
  await Promise.all(Array.from({ length: 105 }, (_, i) => store.recordPreviewEvent(`event-${i}`)));
  const entries = await load().readPreviewLogs();
  expect(entries).toHaveLength(100);
  expect(entries[0].event).toBe('event-5');
  expect(entries[99].event).toBe('event-104');
  expect(entries[0].sha).toBe('test-sha');
  await store.clearPreviewLogs();
  expect(await store.readPreviewLogs()).toEqual([]);
});

it('removes credentials, query parameters, Maps keys and emails from details', async () => {
  const store = load();
  const message = 'Bearer private-token Basic dXNlcjpwYXNz password=private-password access_token=private-access user1@hwb.de https://preview.example/api?code=private-code AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  await store.recordPreviewEvent('query.failed', message, 'error');
  const [{ detail }] = await store.readPreviewLogs();
  for (const secret of ['private-token', 'dXNlcjpwYXNz', 'private-password', 'private-access', 'user1@hwb.de', 'private-code', 'AIza']) expect(detail).not.toContain(secret);
  expect(detail).toContain('https://preview.example/api');
  expect(store.redactPreviewDetail('{"password":"private-password", "access_token":"opaque-secret"}')).not.toContain('private-password');
  expect(store.redactPreviewDetail('{"password":"private-password", "access_token":"opaque-secret"}')).not.toContain('opaque-secret');
});

it('does not let full/unavailable storage break the application', async () => {
  mockSet.mockRejectedValueOnce(new Error('Storage full'));
  await expect(load().recordPreviewEvent('example')).resolves.toBeUndefined();
});

it('recovers from invalid stored JSON and does not break the original error handler', async () => {
  mockStored = 'invalid-json';
  const store = load();
  const previous = jest.fn();
  let current = previous as (error: Error, fatal?: boolean) => void;
  const errorUtils = { getGlobalHandler: () => current, setGlobalHandler: (next: typeof current) => { current = next; } };
  const globalWithErrors = globalThis as unknown as { ErrorUtils?: typeof errorUtils };
  const old = globalWithErrors.ErrorUtils;
  globalWithErrors.ErrorUtils = errorUtils;
  try {
    const remove = store.installPreviewErrorHandler();
    const error = new Error('Example JS error');
    current(error, true);
    expect(previous).toHaveBeenCalledWith(error, true);
    expect((await store.readPreviewLogs())[0].event).toBe('js.fatal');
    remove();
    expect(current).toBe(previous);
  } finally { globalWithErrors.ErrorUtils = old; }
});
