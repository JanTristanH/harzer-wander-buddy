import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { Stampbox } from '@/lib/api';

/**
 * Reference component test for the main list ("Liste" tab) in the unauthenticated
 * guest state.
 *
 * Best practices demonstrated here:
 * - Mock at the data boundary (auth + query hooks), not React Native internals.
 * - Render the real screen and assert on user-visible output (text), not on
 *   implementation details.
 * - Keep test data minimal and explicit via a small factory.
 */

const mockUseAuth = jest.fn();
const mockUseFilteredStampsOverviewQuery = jest.fn();
const mockUseGuestFilteredStampsOverviewQuery = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
  useIdTokenClaims: () => null,
}));

jest.mock('@/lib/queries', () => ({
  useFilteredStampsOverviewQuery: (...args: unknown[]) =>
    mockUseFilteredStampsOverviewQuery(...args),
  useGuestFilteredStampsOverviewQuery: (...args: unknown[]) =>
    mockUseGuestFilteredStampsOverviewQuery(...args),
}));

jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => ({
    groupUserIds: [],
    selectedFriendIds: [],
    selectedMembers: [],
  }),
}));

// The screen reads the location permission on mount; default to "not granted"
// so the guest view renders without requesting a real device location.
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false, status: 'undetermined' }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

// Imported after the mocks above so the screen picks up the mocked modules.
// eslint-disable-next-line import/first
import StampsScreen from '@/app/(tabs)/index';

function createStamp(overrides: Partial<Stampbox> = {}): Stampbox {
  return {
    ID: 'stamp-1',
    number: '001',
    name: 'Rabenklippe',
    description: 'Aussichtspunkt im Harz',
    hasVisited: false,
    ...overrides,
  } as Stampbox;
}

function mockGuestData(stamps: Stampbox[]) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    accessToken: null,
    hasCompletedOnboarding: false,
    isLoading: false,
  });

  // Authenticated query is disabled for guests and yields no data.
  mockUseFilteredStampsOverviewQuery.mockReturnValue({
    data: undefined,
    error: null,
    isFetching: false,
    isPending: true,
    refetch: jest.fn(),
  });

  mockUseGuestFilteredStampsOverviewQuery.mockReturnValue({
    data: { stamps, lastVisited: null },
    error: null,
    isFetching: false,
    isPending: false,
    refetch: jest.fn(),
  });
}

describe('StampsScreen (guest / unauthenticated)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fake timers let us settle the on-mount progress animations synchronously,
    // keeping the test free of "not wrapped in act(...)" warnings.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Renders the screen and flushes mount effects: the async location-permission
  // check (a Promise) and the progress-bar animations (timer driven).
  async function renderGuestScreen() {
    render(<StampsScreen />);
    await act(async () => {
      jest.runAllTimers();
    });
  }

  it('renders the list header for guests', async () => {
    mockGuestData([createStamp()]);

    await renderGuestScreen();

    expect(screen.getByText('Stempelstellen')).toBeOnTheScreen();
    expect(screen.getByText('1 gesamt')).toBeOnTheScreen();
  });

  it('shows the stamps returned by the guest query', async () => {
    mockGuestData([
      createStamp({ ID: 'stamp-1', number: '001', name: 'Rabenklippe' }),
      createStamp({ ID: 'stamp-2', number: '002', name: 'Brocken', hasVisited: true }),
    ]);

    await renderGuestScreen();

    expect(screen.getByText(/Rabenklippe/)).toBeOnTheScreen();
    expect(screen.getByText(/Brocken/)).toBeOnTheScreen();
    expect(screen.getByText('2 gesamt')).toBeOnTheScreen();
  });

  it('reflects the visited progress percentage', async () => {
    mockGuestData([
      createStamp({ ID: 'stamp-1', hasVisited: true }),
      createStamp({ ID: 'stamp-2', hasVisited: false }),
    ]);

    await renderGuestScreen();

    // 1 of 2 stamps visited -> 50%.
    expect(screen.getByText('50%')).toBeOnTheScreen();
  });

  it('uses the guest query and disables the authenticated query', async () => {
    mockGuestData([createStamp()]);

    await renderGuestScreen();

    expect(mockUseGuestFilteredStampsOverviewQuery).toHaveBeenCalledWith(
      'validToday',
      expect.objectContaining({ enabled: true })
    );
    expect(mockUseFilteredStampsOverviewQuery).toHaveBeenCalledWith(
      'validToday',
      expect.objectContaining({ enabled: false })
    );
  });
});
