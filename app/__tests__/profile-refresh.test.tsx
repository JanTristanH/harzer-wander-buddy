import { renderHook } from '@testing-library/react-native';
import { fetchProfileOverview } from '@/lib/api';
import { useProfileOverviewQuery } from '@/lib/queries';
const mockQuery = jest.fn();
const mockCache = jest.fn(() => ({ stamps: [{ ID: 'stamp', hasVisited: false }] }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: unknown) => mockQuery(options), useQueryClient: () => ({ getQueryData: mockCache }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ accessToken: 'token', getValidAccessToken: async () => 'token', isAuthenticated: true, logout: jest.fn() }), useIdTokenClaims: () => ({ sub: 'user', name: 'Alex' }) }));
jest.mock('@/lib/api', () => ({ fetchProfileOverview: jest.fn().mockResolvedValue({ visitedCount: 1 }) }));
test('profile refresh fetches current stamp progress instead of reusing a stale list cache', async () => {
  renderHook(() => useProfileOverviewQuery());
  const options = mockQuery.mock.calls[0][0];
  await options.queryFn();
  expect(fetchProfileOverview).toHaveBeenCalledWith('token', 'user', { id: 'user', name: 'Alex', picture: undefined });
  expect(mockCache).not.toHaveBeenCalled();
});
