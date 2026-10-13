import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import StampsScreen from '@/app/(tabs)/index';
import { triggerHaptic } from '@/lib/haptics-preferences';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: true, canPerformWrites: true }),
}));
jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => ({ groupUserIds: [], selectedFriendIds: [], selectedMembers: [] }),
}));
jest.mock('@/lib/queries', () => {
  const result = {
    data: {
      stamps: [
        { ID: 'brocken', number: '1', name: 'Brocken', hasVisited: false },
        { ID: 'torfhaus', number: '2', name: 'Torfhaus', hasVisited: false },
      ],
    },
  };
  return {
    useFilteredStampsOverviewQuery: () => result,
    useGuestFilteredStampsOverviewQuery: () => result,
  };
});
jest.mock('@/lib/haptics-preferences', () => ({
  triggerHaptic: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => Promise.resolve({ granted: false, status: 'undetermined' }),
}));
jest.mock('@/components/group-selector', () => ({ GroupSelector: () => null }));
jest.mock('@/components/completion-confetti', () => ({
  CompletionConfetti: () => null,
  useCompletionConfetti: () => ({ isVisible: false, play: jest.fn() }),
}));
jest.mock('@/components/stamping-success-toast', () => ({ StampingSuccessToast: () => null }));

describe('Main list selection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps selection while searching for and selecting other stamps', async () => {
    render(<StampsScreen />);
    const search = screen.getByPlaceholderText('Suche nach Nummer oder Ort');
    fireEvent(screen.getByTestId('stamp-list-item-brocken'), 'longPress');
    expect(screen.getByText('1 ausgewählt')).toBeTruthy();

    fireEvent.changeText(search, 'Torfhaus');
    expect(screen.getByText('1 ausgewählt')).toBeTruthy();
    expect(screen.queryByTestId('stamp-list-item-brocken')).toBeNull();
    fireEvent.press(screen.getByTestId('stamp-list-item-torfhaus'));
    expect(screen.getByText('2 ausgewählt')).toBeTruthy();

    fireEvent.changeText(search, 'kein Treffer');
    expect(screen.getByText('2 ausgewählt')).toBeTruthy();
    fireEvent.changeText(search, '');
    expect(screen.getByTestId('stamp-list-item-brocken')).toBeChecked();
    expect(screen.getByTestId('stamp-list-item-torfhaus')).toBeChecked();
    fireEvent.press(screen.getByTestId('stamp-list-item-brocken'));
    expect(screen.getByText('1 ausgewählt')).toBeTruthy();
    expect(triggerHaptic).toHaveBeenCalledTimes(3);
    expect(triggerHaptic).toHaveBeenLastCalledWith('selectionChange');
    // Let the initial location permission request settle.
    await screen.findByText('1 ausgewählt');
  });
});
