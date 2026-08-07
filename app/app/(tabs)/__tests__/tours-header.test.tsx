import { render, screen, within } from '@testing-library/react-native';
import React from 'react';

import type { Tour } from '@/lib/api';

const mockUseToursOverviewQuery = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    accessToken: 'access-token',
    canPerformWrites: true,
    isAuthenticated: true,
    isOffline: false,
  }),
  useIdTokenClaims: () => ({ sub: 'user-1' }),
}));

jest.mock('@/lib/auth-actions', () => ({
  useRequireSignInAction: () => jest.fn(),
}));

jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => ({
    clearGroup: jest.fn(),
    groupUserIds: ['user-1'],
    isLoading: false,
    members: [],
    selectedFriendIds: [],
    selectedMembers: [],
    toggleFriend: jest.fn(),
  }),
}));

jest.mock('@/lib/queries', () => ({
  useCreateTourMutation: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
  useToursOverviewQuery: (...args: unknown[]) => mockUseToursOverviewQuery(...args),
}));

// Imported after the mocks so the screen uses the isolated auth and query state.
// eslint-disable-next-line import/first
import ToursTabScreen from '@/app/(tabs)/tours';

function createTour(): Tour {
  return {
    ID: 'tour-1',
    name: 'Brockenrunde',
    distance: 12_300,
    duration: 8_100,
    stampCount: 8,
    newStampCountForUser: 3,
    idListTravelTimes: '',
    totalElevationGain: 420,
    totalElevationLoss: 415,
    averageGroupStampings: 0,
  };
}

describe('ToursTabScreen header', () => {
  beforeEach(() => {
    mockUseToursOverviewQuery.mockReturnValue({
      data: [createTour()],
      error: null,
      isFetching: false,
      isPending: false,
      refetch: jest.fn(),
    });
  });

  it('places title, total and group selector in the same header row', () => {
    render(<ToursTabScreen />);

    const titleRow = screen.getByTestId('tours-title-row');

    expect(within(titleRow).getByText('Touren')).toBeOnTheScreen();
    expect(within(titleRow).getByText('1 gesamt')).toBeOnTheScreen();
    expect(within(titleRow).getByTestId('tours-header-group-selector')).toBeOnTheScreen();
    expect(screen.getAllByTestId('tours-header-group-selector')).toHaveLength(1);
    expect(screen.queryByText('Wandergruppe')).toBeNull();
  });
});
