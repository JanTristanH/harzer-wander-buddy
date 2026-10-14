import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import StampsScreen from '@/app/(tabs)/index';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockVisits = jest.fn();
const mockInvalidate = jest.fn();
const mockPush = jest.fn();
const mockAuth = jest.fn();
const mockClient = { invalidateQueries: mockInvalidate };
const mockGroup = { groupUserIds: [], selectedFriendIds: [], selectedMembers: [] };
const mockStamps = [
  { ID: 'open', number: '2', name: 'Scharfenstein', hasVisited: false },
  { ID: 'visited', number: '3', name: 'Kruzifix', hasVisited: true },
];

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/hiking-group', () => ({ useHikingGroup: () => mockGroup }));
jest.mock('@/components/group-selector', () => ({ GroupSelector: () => null }));
jest.mock('@/lib/api', () => ({
  createStamping: (...args: unknown[]) => mockCreate(...args),
  deleteStamping: (...args: unknown[]) => mockDelete(...args),
  fetchOwnStampings: (...args: unknown[]) => mockVisits(...args),
}));
jest.mock('@/lib/queries', () => ({
  useFilteredStampsOverviewQuery: () => ({ data: { stamps: mockStamps, lastVisited: null } }),
  useGuestFilteredStampsOverviewQuery: () => ({ data: { stamps: mockStamps, lastVisited: null } }),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => Promise.resolve({ granted: false }),
}));

async function openScreen() {
  render(<StampsScreen />);
  await act(async () => { jest.runAllTimers(); });
}
function hold(id: string) {
  fireEvent(screen.getByTestId(`stamp-list-item-${id}`), 'longPress');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAuth.mockReturnValue({ isAuthenticated: true, accessToken: 'test-token', canPerformWrites: true, currentUserProfile: { id: 'self' } });
  mockCreate.mockResolvedValue({});
  mockDelete.mockResolvedValue(null);
  mockInvalidate.mockResolvedValue(undefined);
  mockVisits.mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); });

it('opens details normally, then toggles rows without navigation after holding', async () => {
  await openScreen();
  fireEvent.press(screen.getByTestId('stamp-list-item-open'));
  expect(mockPush).toHaveBeenCalledWith('/stamps/open');
  mockPush.mockClear();
  hold('open');
  expect(screen.getByText('1 ausgewählt')).toBeTruthy();
  fireEvent.press(screen.getByTestId('stamp-list-item-visited'));
  expect(screen.getByText('2 ausgewählt')).toBeTruthy();
  fireEvent.press(screen.getByTestId('stamp-list-item-open'));
  expect(screen.getByText('1 ausgewählt')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Auswahl beenden'));
  expect(screen.queryByTestId('stamp-selection-toolbar')).toBeNull();
});

it('stamps every selected place including existing visits and exits selection', async () => {
  await openScreen();
  hold('open');
  fireEvent.press(screen.getByTestId('stamp-list-item-visited'));
  await act(async () => { fireEvent.press(screen.getByText('Stempeln (2)')); });
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(mockCreate).toHaveBeenCalledWith('test-token', 'open');
  expect(mockCreate).toHaveBeenCalledWith('test-token', 'visited');
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockInvalidate).toHaveBeenCalled();
  expect(screen.getByText('2 Besuche gestempelt.')).toBeTruthy();
  expect(screen.queryByTestId('stamp-selection-toolbar')).toBeNull();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(screen.queryByText('2 Besuche gestempelt.')).toBeNull();
});

it('keeps visits when cancelled and removes all own visits after confirmation', async () => {
  mockVisits.mockResolvedValue([{ ID: 'visit-1' }, { ID: 'visit-2' }]);
  await openScreen();
  hold('visited');
  await act(async () => { fireEvent.press(screen.getByText('Entfernen (1)')); });
  fireEvent.press(screen.getByText('Behalten'));
  expect(mockDelete).not.toHaveBeenCalled();
  expect(screen.getByText('1 ausgewählt')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Entfernen (1)')); });
  await act(async () => { fireEvent.press(screen.getByText('Jetzt entfernen')); });
  expect(mockVisits).toHaveBeenCalledWith('test-token', 'visited', 'self');
  expect(mockDelete.mock.calls).toEqual([['test-token', 'visit-1'], ['test-token', 'visit-2']]);
  expect(screen.queryByTestId('stamp-selection-toolbar')).toBeNull();
});

it('retains failed places for retry and permits an intentional repeated visit', async () => {
  mockCreate.mockRejectedValueOnce(new Error('Network failure'));
  await openScreen();
  hold('open');
  await act(async () => { fireEvent.press(screen.getByText('Stempeln (1)')); });
  expect(screen.getByText('1 ausgewählt')).toBeTruthy();
  expect(screen.getByText('0 erledigt. 1 fehlgeschlagen. Bitte erneut versuchen.')).toBeTruthy();
  mockVisits.mockResolvedValue([{ ID: 'already-created' }]);
  await act(async () => { fireEvent.press(screen.getByText('Stempeln (1)')); });
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('stamp-selection-toolbar')).toBeNull();
});

it('disables mutations while offline', async () => {
  mockAuth.mockReturnValue({ isAuthenticated: true, canPerformWrites: false });
  await openScreen();
  hold('open');
  expect(screen.getByText('Stempeln und Entfernen sind nur online möglich.')).toBeTruthy();
  fireEvent.press(screen.getByText('Stempeln (1)'));
  expect(mockCreate).not.toHaveBeenCalled();
});


it('requires confirmation even for a single visit', async () => {
  mockVisits.mockResolvedValue([{ ID: 'only-visit' }]);
  await openScreen();
  hold('visited');
  await act(async () => { fireEvent.press(screen.getByText('Entfernen (1)')); });
  expect(mockDelete).not.toHaveBeenCalled();
  expect(screen.getByText('1 Besuch an 1 ausgewählter Stempelstelle wird entfernt.')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Jetzt entfernen')); });
  expect(mockDelete).toHaveBeenCalledWith('test-token', 'only-visit');
  expect(screen.queryByText('Stempel entfernen?')).toBeNull();
  expect(screen.getByText('1 Besuch entfernt.')).toBeTruthy();
});

it('confirms the actual visit count even when only one place is selected', async () => {
  mockVisits.mockResolvedValue([{ ID: 'first' }, { ID: 'second' }, { ID: 'third' }]);
  await openScreen();
  hold('visited');
  await act(async () => { fireEvent.press(screen.getByText('Entfernen (1)')); });
  expect(screen.getByText('3 Besuche an 1 ausgewählter Stempelstelle werden entfernt.')).toBeTruthy();
  expect(mockDelete).not.toHaveBeenCalled();
});

it('does not delete any visits if preparation fails', async () => {
  mockVisits.mockRejectedValueOnce(new Error('Offline'));
  await openScreen();
  hold('visited');
  await act(async () => { fireEvent.press(screen.getByText('Entfernen (1)')); });
  expect(mockDelete).not.toHaveBeenCalled();
  expect(screen.getByText('Besuche konnten nicht geladen werden. Bitte erneut versuchen.')).toBeTruthy();
});
