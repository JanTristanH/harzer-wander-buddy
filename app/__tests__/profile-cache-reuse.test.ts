import { fetchProfileOverview, type FriendsOverviewData } from '@/lib/api';
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://example.test' } }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('profile reuses matching list, account and friend-progress data', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ value: [] }) }));
  global.fetch = fetchMock as unknown as typeof fetch;
  const friends: FriendsOverviewData = {
    currentUserId: 'alice', friendCount: 1, incomingRequestCount: 0, outgoingRequestCount: 0,
    incomingRequests: [], outgoingRequests: [], friends: [{ id: 'bob', name: 'Bob', friendshipId: 'friend',
      isAllowedToStampForMe: false, isAllowedToStampForFriend: false, visitedCount: 5, completionPercent: 50 }],
  };
  const result = await fetchProfileOverview('token', 'alice', { id: 'alice', name: 'Alice' }, [], friends);
  expect(result.friendCount).toBe(1);
  expect(result.friends[0].visitedCount).toBe(5);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String((fetchMock.mock.calls as unknown as [string][])[0][0])).toContain('/Stampings?');
});
