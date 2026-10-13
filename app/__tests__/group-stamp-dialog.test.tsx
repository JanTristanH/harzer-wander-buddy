import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { GroupStampDialog, type GroupStampDialogProps } from '@/components/group-stamp-dialog';
import * as api from '@/lib/api';
import type { HikingGroupContextValue, HikingGroupMember } from '@/lib/hiking-group';

let mockAuthState: {
  accessToken: string | null;
  canPerformWrites: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  logout: jest.MockedFunction<() => Promise<void>>;
};
let mockGroupState: HikingGroupContextValue;

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => mockGroupState,
}));

jest.mock('@/lib/api', () => ({
  stampForGroup: jest.fn(),
}));

const mockStampForGroup = api.stampForGroup as jest.MockedFunction<
  typeof api.stampForGroup
>;

function member(
  id: string,
  name: string,
  isAllowedToStampForFriend: boolean
): HikingGroupMember {
  return {
    id,
    name,
    friendshipId: `friendship-${id}`,
    isAllowedToStampForFriend,
    isAllowedToStampForMe: false,
    visitedCount: 14,
    completionPercent: 6,
  };
}

function buildGroupState(
  members: HikingGroupMember[],
  selectedFriendIds: string[]
): HikingGroupContextValue {
  return {
    members,
    selectedFriendIds,
    groupUserIds: ['current-user', ...selectedFriendIds],
    selectedMembers: members.filter((item) => selectedFriendIds.includes(item.id)),
    isLoading: false,
    toggleFriend: jest.fn(),
    addFriend: jest.fn(),
    removeFriend: jest.fn(),
    clearGroup: jest.fn(),
  };
}

function renderDialog(overrides: Partial<GroupStampDialogProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueries = jest
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue(undefined);
  const props: GroupStampDialogProps = {
    visible: true,
    stampId: 'stamp-123',
    stampName: 'Brockenhaus',
    includeCurrentUser: true,
    currentUserAlreadyStamped: false,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides,
  };

  const view = render(
    <QueryClientProvider client={queryClient}>
      <GroupStampDialog {...props} />
    </QueryClientProvider>
  );

  return { ...view, invalidateQueries, props };
}

describe('GroupStampDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      accessToken: 'access-token',
      canPerformWrites: true,
      isAuthenticated: true,
      isOffline: false,
      logout: jest.fn().mockResolvedValue(undefined),
    };
    mockGroupState = buildGroupState(
      [
        member('allowed-selected', 'Anna', true),
        member('denied-selected', 'Berta', false),
        member('allowed-extra', 'Clara', true),
      ],
      ['allowed-selected', 'denied-selected']
    );
    mockStampForGroup.mockResolvedValue('ok');
  });

  it('preselects only permitted global members and allows further permitted friends', async () => {
    const { invalidateQueries, props } = renderDialog();

    await waitFor(() => {
      expect(
        screen.getByTestId('group-stamp-friend-allowed-selected').props
          .accessibilityState
      ).toEqual({ checked: true, disabled: false });
    });
    expect(
      screen.getByTestId('group-stamp-friend-denied-selected').props
        .accessibilityState
    ).toEqual({ checked: false, disabled: true });
    expect(
      screen.getByTestId('group-stamp-friend-allowed-extra').props
        .accessibilityState
    ).toEqual({ checked: false, disabled: false });
    expect(
      screen.getByTestId('group-stamp-include-current-user').props
        .accessibilityState
    ).toEqual({ checked: true, disabled: false });

    fireEvent.press(screen.getByTestId('group-stamp-friend-allowed-extra'));
    fireEvent.press(screen.getByTestId('group-stamp-confirm'));

    await waitFor(() => {
      expect(mockStampForGroup).toHaveBeenCalledWith('access-token', {
        stampId: 'stamp-123',
        friendIds: ['allowed-selected', 'allowed-extra'],
        includeCurrentUser: true,
      });
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(props.onSuccess).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('allows a self-only visit when no selected friend is permitted', async () => {
    mockGroupState = buildGroupState(
      [
        member('denied-selected', 'Berta', false),
        member('allowed-extra', 'Clara', true),
      ],
      ['denied-selected']
    );
    renderDialog();

    await waitFor(() => {
      expect(
        screen.getByTestId('group-stamp-confirm').props.accessibilityState
      ).toEqual({ disabled: false });
    });
    expect(
      screen.getByTestId('group-stamp-include-current-user').props
        .accessibilityState
    ).toEqual({ checked: true, disabled: false });

    fireEvent.press(screen.getByTestId('group-stamp-confirm'));

    await waitFor(() => {
      expect(mockStampForGroup).toHaveBeenCalledWith('access-token', {
        stampId: 'stamp-123',
        friendIds: [],
        includeCurrentUser: true,
      });
    });
  });

  it('allows another self visit when the current user already stamped', async () => {
    renderDialog({ currentUserAlreadyStamped: true });

    await waitFor(() => {
      expect(
        screen.getByTestId('group-stamp-include-current-user').props
          .accessibilityState
      ).toEqual({ checked: false, disabled: false });
    });

    fireEvent.press(screen.getByTestId('group-stamp-include-current-user'));
    fireEvent.press(screen.getByTestId('group-stamp-confirm'));

    await waitFor(() => {
      expect(mockStampForGroup).toHaveBeenCalledWith('access-token', {
        stampId: 'stamp-123',
        friendIds: ['allowed-selected'],
        includeCurrentUser: true,
      });
    });
  });

  it('shows an offline error without calling the action', async () => {
    mockAuthState = {
      ...mockAuthState,
      canPerformWrites: false,
      isOffline: true,
    };
    renderDialog();

    await waitFor(() => {
      expect(
        screen.getByTestId('group-stamp-confirm').props.accessibilityState
      ).toEqual({ disabled: false });
    });
    fireEvent.press(screen.getByTestId('group-stamp-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('group-stamp-error').props.children).toContain(
        'Du bist offline'
      );
    });
    expect(mockStampForGroup).not.toHaveBeenCalled();
  });

  it('logs out and closes on an authorization error', async () => {
    const unauthorizedError = new Error('Unauthorized');
    unauthorizedError.name = 'UnauthorizedError';
    mockStampForGroup.mockRejectedValueOnce(unauthorizedError);
    const { props } = renderDialog();

    await waitFor(() => {
      expect(
        screen.getByTestId('group-stamp-confirm').props.accessibilityState
      ).toEqual({ disabled: false });
    });
    fireEvent.press(screen.getByTestId('group-stamp-confirm'));

    await waitFor(() => {
      expect(mockAuthState.logout).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
