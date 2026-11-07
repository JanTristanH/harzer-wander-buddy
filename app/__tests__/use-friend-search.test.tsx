import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  createFriendRequest,
  removeFriendship,
  searchUsers,
  type FriendsOverviewData,
} from '@/lib/api';
import { useFriendSearch } from '@/lib/use-friend-search';

const mockInvalidate = jest.fn().mockResolvedValue(undefined);
const mockAuth = {
  accessToken: 'token',
  isAuthenticated: true,
  canPerformWrites: true,
  isOffline: false,
  logout: jest.fn(),
};
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuth,
  useIdTokenClaims: () => ({ sub: 'account' }),
}));
jest.mock('@/lib/auth-actions', () => ({
  useRequireSignInAction: () => jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  searchUsers: jest.fn(),
  createFriendRequest: jest.fn(),
  removeFriendship: jest.fn(),
}));
jest.mock('@/lib/queries', () => ({
  queryKeys: {
    friendsOverview: (id: string) => ['friends', id],
    profileOverview: (id: string) => ['profile', id],
  },
}));

const overview: FriendsOverviewData = {
  currentUserId: 'self',
  friendCount: 0,
  incomingRequestCount: 0,
  outgoingRequestCount: 1,
  friends: [],
  incomingRequests: [],
  outgoingRequests: [
    {
      id: 'outgoing',
      userId: 'sent',
      friendshipId: 'friendship',
      name: 'Sent',
    },
  ],
};
const users = ['self', 'sent', 'received', 'friend', 'new'].map((id) => ({
  id,
  name: id,
  visitedCount: 0,
  completionPercent: 0,
  isFriend: id === 'friend',
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAuth.canPerformWrites = true;
  (searchUsers as jest.Mock).mockResolvedValue(users);
  (createFriendRequest as jest.Mock).mockResolvedValue(undefined);
  (removeFriendship as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function search(result: { current: ReturnType<typeof useFriendSearch> }) {
  act(() => {
    result.current.setIsSearchModalVisible(true);
    result.current.setSearchQuery('us');
  });
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
}

test('marks self, existing friends, incoming and persisted outgoing requests and blocks their actions', async () => {
  const data = {
    ...overview,
    incomingRequests: [
      {
        id: 'in',
        pendingRequestId: 'pending',
        userId: 'received',
        name: 'Received',
      },
    ],
  };
  const { result } = renderHook(() => useFriendSearch(data));
  await search(result);
  expect(result.current.searchListItems.map((item) => item.actionLabel)).toEqual([
    'Du',
    'Gesendet',
    'Erhalten',
    'Verbunden',
    'Anfrage',
  ]);
  await act(async () => {
    result.current.searchListItems.slice(0, 4).forEach((item) => item.onActionPress());
  });
  expect(createFriendRequest).not.toHaveBeenCalled();
});

test('keeps requests disabled until the current user and relationships are loaded', async () => {
  const { result } = renderHook(() => useFriendSearch(undefined));
  await search(result);
  expect(result.current.searchListItems.every((item) => item.actionDisabled)).toBe(true);
  await act(async () => {
    result.current.searchListItems[4].onActionPress();
  });
  expect(createFriendRequest).not.toHaveBeenCalled();
});

test('sends once on a double tap and refreshes both shared caches', async () => {
  const { result } = renderHook(() => useFriendSearch(overview));
  await search(result);
  await act(async () => {
    const action = result.current.searchListItems[4].onActionPress;
    action();
    action();
  });
  expect(createFriendRequest).toHaveBeenCalledTimes(1);
  expect(createFriendRequest).toHaveBeenCalledWith('token', 'new');
  expect(mockInvalidate).toHaveBeenCalledWith({
    queryKey: ['friends', 'account'],
    refetchType: 'all',
  });
  expect(mockInvalidate).toHaveBeenCalledWith({
    queryKey: ['profile', 'account'],
    refetchType: 'all',
  });
});

test('recalls persisted requests only after confirmation using the friendship id', async () => {
  const { result, rerender } = renderHook(
    ({ data }: { data: FriendsOverviewData }) => useFriendSearch(data),
    {
      initialProps: { data: overview },
    }
  );
  expect(result.current.sentRequestItems[0].actionLabel).toBe('Zurueckrufen');
  act(() => {
    result.current.sentRequestItems[0].onActionPress();
  });
  expect(removeFriendship).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Zurueckrufen')!.onPress!();
  });
  expect(removeFriendship).toHaveBeenCalledWith('token', 'friendship');
  expect(mockInvalidate).toHaveBeenCalledTimes(2);
  rerender({ data: { ...overview, outgoingRequests: [] } });
  await search(result);
  expect(result.current.sentRequestItems).toEqual([]);
  expect(result.current.searchListItems.find((item) => item.id === 'sent')?.actionLabel).toBe(
    'Anfrage'
  );
});

test('retains a failed request for retry and prevents writes offline', async () => {
  (createFriendRequest as jest.Mock).mockRejectedValueOnce(new Error('Failed'));
  const { result, rerender } = renderHook(() => useFriendSearch(overview));
  await search(result);
  await act(async () => {
    result.current.searchListItems[4].onActionPress();
  });
  expect(Alert.alert).toHaveBeenCalledWith('Anfrage konnte nicht gesendet werden', 'Failed');
  expect(result.current.searchQuery).toBe('us');
  expect(result.current.searchListItems[4].actionDisabled).toBe(false);
  await act(async () => {
    result.current.searchListItems[4].onActionPress();
  });
  expect(createFriendRequest).toHaveBeenCalledTimes(2);
  mockAuth.canPerformWrites = false;
  rerender({});
  await act(async () => {
    result.current.searchListItems[4].onActionPress();
  });
  expect(createFriendRequest).toHaveBeenCalledTimes(2);
});

test('ignores stale searches after closing the dialog', async () => {
  let resolve!: (value: typeof users) => void;
  (searchUsers as jest.Mock).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { result } = renderHook(() => useFriendSearch(overview));
  await search(result);
  act(() => {
    result.current.closeSearchModal();
  });
  await act(async () => {
    resolve(users);
  });
  expect(result.current.searchResults).toEqual([]);
  expect(result.current.isSearchModalVisible).toBe(false);
});
