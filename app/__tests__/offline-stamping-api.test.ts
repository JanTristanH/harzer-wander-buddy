import { HttpStatusError, syncOfflineStamping } from '@/lib/api';
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://backend.test', authMode: 'sso' } }));
const entry = { id: '11111111-1111-4111-8111-111111111111', stamp: { ID: 'stamp' }, visitedAt: '2026-10-20T08:00:00.000Z' };
const existing = { ID: entry.id, createdBy: 'alice', stamp_ID: 'stamp', visitedAt: entry.visitedAt };
function response(status: number, body: unknown) { return { status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body) } as Response; }
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

it('sends the stable UUID and original timestamp, not a replay-time timestamp', async () => {
  const fetchMock = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response(201, existing)); global.fetch = fetchMock;
  await syncOfflineStamping('token', 'alice', entry);
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ ID: entry.id, stamp: { ID: 'stamp' }, visitedAt: entry.visitedAt });
});

it.each([400, 409])('acknowledges a duplicate (%s) only after verifying owner, place and original time', async (status) => {
  const fetchMock = jest.fn().mockResolvedValueOnce(response(status, {})).mockResolvedValueOnce(response(200, existing)); global.fetch = fetchMock;
  await expect(syncOfflineStamping('token', 'alice', entry)).resolves.toBeUndefined();
  expect(fetchMock.mock.calls[1][0]).toContain(`Stampings(${entry.id})`);
});

it.each([{ createdBy: 'bob' }, { stamp_ID: 'other' }, { visitedAt: '2026-10-19T08:00:00Z' }])('does not acknowledge a conflicting visit: %j', async (changes) => {
  global.fetch = jest.fn().mockResolvedValueOnce(response(409, {})).mockResolvedValueOnce(response(200, { ...existing, ...changes }));
  await expect(syncOfflineStamping('token', 'alice', entry)).rejects.toBeInstanceOf(HttpStatusError);
});

it('leaves authentication and network failures retryable', async () => {
  global.fetch = jest.fn().mockResolvedValue(response(401, {}));
  await expect(syncOfflineStamping('token', 'alice', entry)).rejects.toHaveProperty('name', 'UnauthorizedError');
  global.fetch = jest.fn().mockRejectedValue(new TypeError('offline'));
  await expect(syncOfflineStamping('token', 'alice', entry)).rejects.toThrow('offline');
});
