import { syncStampNote } from '@/lib/api';
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://backend.test', authMode: 'sso' } }));
const base = { ID: 'note', note: 'alt', modifiedAt: '2026-10-22T10:00:00Z' };
const originalFetch = global.fetch;
function response(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
it('sends the original version and a clearing edit to the atomic action', async () => {
  const mock = jest.fn().mockResolvedValue(response(200, { conflict: false, current: { ...base, note: '' } })); global.fetch = mock;
  await syncStampNote('token', 'stamp', '', base);
  expect(mock.mock.calls[0][0]).toContain('/syncStampNote');
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ stampId: 'stamp', note: '', expectedId: base.ID,
    expectedModifiedAt: base.modifiedAt, expectedNote: 'alt' });
});
it.each([null, {}, { conflict: false, current: null }, { conflict: false, current: base }])('does not acknowledge malformed or incorrect server results: %j', async (body) => {
  global.fetch = jest.fn().mockResolvedValue(response(200, body));
  await expect(syncStampNote('token', 'stamp', 'neu', base)).rejects.toThrow('nicht bestätigt');
});
it('preserves a conflict including a remote deletion', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(200, { conflict: true, current: null }));
  await expect(syncStampNote('token', 'stamp', 'neu', base)).resolves.toEqual({ conflict: true, current: null });
});
it.each([401, 403, 404, 429, 500])('keeps failed transfers retryable: HTTP %s', async (status) => {
  global.fetch = jest.fn().mockResolvedValue(response(status, {}));
  await expect(syncStampNote('token', 'stamp', 'neu', base)).rejects.toThrow();
});
it('aborts a stalled request so later reconnect attempts can run', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const promise = syncStampNote('token', 'stamp', 'neu', base);
  const assertion = expect(promise).rejects.toThrow('aborted');
  await jest.advanceTimersByTimeAsync(15_000); await assertion;
});
