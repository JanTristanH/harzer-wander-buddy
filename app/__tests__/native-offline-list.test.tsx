import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import StampsScreen from '@/app/(tabs)/index';
const mockRecord = jest.fn(async () => undefined);
const stamp = { ID: 'stamp', number: '1', name: 'Brocken', hasVisited: false };
jest.mock('@/lib/offline-visits', () => ({ useOfflineVisits: () => ({ canRecord: true, entries: [], record: mockRecord }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn(async () => undefined) }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ accessToken: 'expired-offline-token', isAuthenticated: true, canPerformWrites: false, currentUserProfile: null }) }));
jest.mock('@/lib/hiking-group', () => ({ useHikingGroup: () => ({ groupUserIds: [], selectedFriendIds: [], selectedMembers: [] }) }));
jest.mock('@/lib/queries', () => ({
  useFilteredStampsOverviewQuery: () => ({ data: { stamps: [{ ID: 'stamp', number: '1', name: 'Brocken', hasVisited: false }] } }),
  useGuestFilteredStampsOverviewQuery: () => ({ data: { stamps: [] } }),
}));
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: async () => ({ granted: false, status: 'undetermined' }) }));
jest.mock('@/components/group-selector', () => ({ GroupSelector: () => null }));
jest.mock('@/components/completion-confetti', () => ({ CompletionConfetti: () => null, useCompletionConfetti: () => ({ isVisible: false, play: jest.fn() }) }));
jest.mock('@/components/stamping-success-toast', () => ({ StampingSuccessToast: () => null }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('allows native bulk recording while normal server writes remain disabled', async () => {
  render(<StampsScreen />);
  fireEvent(screen.getByTestId('stamp-list-item-stamp'), 'longPress');
  const button = screen.getByText('Stempeln (1)'); expect(button).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Entfernen (0)' })).toBeDisabled();
  fireEvent.press(button);
  await waitFor(() => expect(mockRecord).toHaveBeenCalledWith(stamp));
});
