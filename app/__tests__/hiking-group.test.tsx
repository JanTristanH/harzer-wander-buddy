import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { HikingGroupProvider, useHikingGroup } from '@/lib/hiking-group';

let mockAuthState: {
  isAuthenticated: boolean;
  currentUserProfile: { id: string } | null;
};
let mockClaims: { sub?: string } | null;
let mockFriendsQuery: {
  data?: {
    currentUserId: string;
    friends: {
      id: string;
      name: string;
      picture?: string;
      friendshipId: string;
      isAllowedToStampForMe: boolean;
      isAllowedToStampForFriend: boolean;
      visitedCount: number;
      completionPercent: number;
    }[];
  };
  isPending: boolean;
  isFetching: boolean;
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuthState,
  useIdTokenClaims: () => mockClaims,
}));

jest.mock('@/lib/queries', () => ({
  useFriendsOverviewQuery: () => mockFriendsQuery,
}));

function friend(id: string, name: string) {
  return {
    id,
    name,
    friendshipId: `friendship-${id}`,
    isAllowedToStampForMe: false,
    isAllowedToStampForFriend: true,
    visitedCount: 12,
    completionPercent: 5,
  };
}

function GroupHarness() {
  const {
    addFriend,
    clearGroup,
    groupUserIds,
    members,
    removeFriend,
    selectedFriendIds,
    selectedMembers,
    toggleFriend,
  } = useHikingGroup();

  return (
    <>
      <Text testID="selected-friend-ids">{selectedFriendIds.join(',')}</Text>
      <Text testID="group-user-ids">{groupUserIds.join(',')}</Text>
      <Text testID="member-ids">{members.map((member) => member.id).join(',')}</Text>
      <Text testID="selected-member-ids">
        {selectedMembers.map((member) => member.id).join(',')}
      </Text>
      <Pressable onPress={() => addFriend('friend-1')} testID="add-friend-1" />
      <Pressable onPress={() => addFriend('not-a-friend')} testID="add-unknown" />
      <Pressable onPress={() => toggleFriend('friend-2')} testID="toggle-friend-2" />
      <Pressable onPress={() => removeFriend('friend-1')} testID="remove-friend-1" />
      <Pressable onPress={clearGroup} testID="clear-group" />
    </>
  );
}

function renderGroup() {
  return render(
    <HikingGroupProvider>
      <GroupHarness />
    </HikingGroupProvider>
  );
}

function readText(testID: string) {
  return screen.getByTestId(testID).props.children as string;
}

describe('HikingGroupProvider', () => {
  beforeEach(() => {
    mockAuthState = {
      isAuthenticated: true,
      currentUserProfile: { id: 'user-1' },
    };
    mockClaims = { sub: 'user-1' };
    mockFriendsQuery = {
      data: {
        currentUserId: 'user-1',
        friends: [friend('friend-1', 'Anna'), friend('friend-2', 'Berta')],
      },
      isPending: false,
      isFetching: false,
    };
  });

  it('keeps only accepted overview friends selectable and adds self only to groupUserIds', () => {
    renderGroup();

    expect(readText('selected-friend-ids')).toBe('');
    expect(readText('group-user-ids')).toBe('user-1');
    expect(readText('member-ids')).toBe('friend-1,friend-2');

    fireEvent.press(screen.getByTestId('add-unknown'));
    expect(readText('selected-friend-ids')).toBe('');

    fireEvent.press(screen.getByTestId('add-friend-1'));
    fireEvent.press(screen.getByTestId('toggle-friend-2'));

    expect(readText('selected-friend-ids')).toBe('friend-1,friend-2');
    expect(readText('selected-member-ids')).toBe('friend-1,friend-2');
    expect(readText('group-user-ids')).toBe('user-1,friend-1,friend-2');

    fireEvent.press(screen.getByTestId('remove-friend-1'));
    expect(readText('selected-friend-ids')).toBe('friend-2');

    fireEvent.press(screen.getByTestId('clear-group'));
    expect(readText('selected-friend-ids')).toBe('');
    expect(readText('group-user-ids')).toBe('user-1');
  });

  it('resets the transient selection when the authenticated user changes', async () => {
    const view = renderGroup();
    fireEvent.press(screen.getByTestId('add-friend-1'));
    expect(readText('selected-friend-ids')).toBe('friend-1');

    mockAuthState = {
      isAuthenticated: true,
      currentUserProfile: { id: 'user-2' },
    };
    mockClaims = { sub: 'user-2' };
    mockFriendsQuery = {
      data: {
        currentUserId: 'user-2',
        friends: [friend('friend-3', 'Clara')],
      },
      isPending: false,
      isFetching: false,
    };
    view.rerender(
      <HikingGroupProvider>
        <GroupHarness />
      </HikingGroupProvider>
    );

    await waitFor(() => {
      expect(readText('selected-friend-ids')).toBe('');
      expect(readText('group-user-ids')).toBe('user-2');
      expect(readText('member-ids')).toBe('friend-3');
    });
  });

  it('clears selection and implicit self on logout', async () => {
    const view = renderGroup();
    fireEvent.press(screen.getByTestId('toggle-friend-2'));
    expect(readText('group-user-ids')).toBe('user-1,friend-2');

    mockAuthState = {
      isAuthenticated: false,
      currentUserProfile: null,
    };
    mockClaims = null;
    mockFriendsQuery = {
      data: undefined,
      isPending: false,
      isFetching: false,
    };
    view.rerender(
      <HikingGroupProvider>
        <GroupHarness />
      </HikingGroupProvider>
    );

    await waitFor(() => {
      expect(readText('selected-friend-ids')).toBe('');
      expect(readText('group-user-ids')).toBe('');
      expect(readText('member-ids')).toBe('');
    });
  });
});
