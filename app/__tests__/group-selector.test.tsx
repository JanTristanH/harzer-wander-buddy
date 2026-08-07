import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GroupSelector } from '@/components/group-selector';
import type { HikingGroupContextValue } from '@/lib/hiking-group';

let mockAuthState: {
  accessToken: string | null;
  isAuthenticated: boolean;
};
let mockGroupState: HikingGroupContextValue;

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => mockGroupState,
}));

describe('GroupSelector', () => {
  beforeEach(() => {
    mockAuthState = {
      accessToken: 'access-token',
      isAuthenticated: true,
    };
    mockGroupState = {
      selectedFriendIds: ['friend-1'],
      groupUserIds: ['current-user', 'friend-1'],
      members: [
        {
          id: 'friend-1',
          name: 'Anna',
          friendshipId: 'friendship-1',
          isAllowedToStampForMe: false,
          isAllowedToStampForFriend: true,
          visitedCount: 23,
          completionPercent: 10,
        },
        {
          id: 'friend-2',
          name: 'Berta',
          friendshipId: 'friendship-2',
          isAllowedToStampForMe: true,
          isAllowedToStampForFriend: false,
          visitedCount: 12,
          completionPercent: 5,
        },
      ],
      selectedMembers: [],
      isLoading: false,
      toggleFriend: jest.fn(),
      addFriend: jest.fn(),
      removeFriend: jest.fn(),
      clearGroup: jest.fn(),
    };
  });

  it('does not render for guests', () => {
    mockAuthState = {
      accessToken: null,
      isAuthenticated: false,
    };

    render(<GroupSelector />);

    expect(screen.queryByTestId('group-selector-button')).toBeNull();
  });

  it('opens the German checklist and delegates selection changes', () => {
    render(<GroupSelector />);

    fireEvent.press(screen.getByTestId('group-selector-button'));

    expect(screen.getByText('Wandergruppe auswählen')).toBeTruthy();
    expect(screen.getByText(/Du bist automatisch dabei/)).toBeTruthy();
    expect(
      screen.getByTestId('group-selector-friend-friend-1').props.accessibilityState
    ).toEqual({ checked: true });
    expect(
      screen.getByTestId('group-selector-friend-friend-2').props.accessibilityState
    ).toEqual({ checked: false });

    fireEvent.press(screen.getByTestId('group-selector-friend-friend-2'));
    fireEvent.press(screen.getByTestId('group-selector-clear'));

    expect(mockGroupState.toggleFriend).toHaveBeenCalledWith('friend-2');
    expect(mockGroupState.clearGroup).toHaveBeenCalledTimes(1);
  });
});
