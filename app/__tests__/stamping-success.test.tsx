import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { StampingSuccessCard } from '@/components/stamping-success-card';
import { StampingSuccessHost } from '@/components/stamping-success-host';
import { fetchStampingFeedback } from '@/lib/api';
import { publishStampingSuccess, type StampingFeedback } from '@/lib/stamping-feedback';

let mockOwner = 'alice';
const mockToken = jest.fn(async () => 'local-test');
const mockInvalidate = jest.fn();
const mockClient = { invalidateQueries: mockInvalidate };
const mockPush = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: Boolean(mockOwner), getValidAccessToken: mockToken }),
  useIdTokenClaims: () => ({ sub: mockOwner }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/api', () => ({ fetchStampingFeedback: jest.fn() }));
const summary: StampingFeedback = {
  visitIds: ['v1'], visitCount: 1, beforeCount: 7, afterCount: 8,
  newPlaces: 1, repeatCount: 0, places: ['Brockenhaus'], visitedAt: '2026-11-06',
  newBadges: [], nextGoal: null,
};
beforeEach(() => {
  jest.clearAllMocks(); mockOwner = 'alice';
  (fetchStampingFeedback as jest.Mock).mockResolvedValue(summary);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

test('normal and repeated visits show distinct progress without invented unique stamps', () => {
  const close = jest.fn();
  const view = render(<StampingSuccessCard feedback={summary} onClose={close} onAlbum={jest.fn()} />);
  expect(screen.getByText('Brockenhaus gesammelt!')).toBeTruthy();
  expect(screen.getByText('7 → 8 reguläre Stempel')).toBeTruthy();
  view.rerender(<StampingSuccessCard feedback={{ ...summary, newPlaces: 0, repeatCount: 1, afterCount: 7 }} onClose={close} onAlbum={jest.fn()} />);
  expect(screen.getByText('Besuch festgehalten')).toBeTruthy();
  expect(screen.getByText('7 → 7 reguläre Stempel')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Erfolg schließen'));
  expect(close).toHaveBeenCalledTimes(1);
});

test('one host handles a batch once and ignores another account', async () => {
  render(<StampingSuccessHost />);
  act(() => {
    publishStampingSuccess({ owner: 'bob', visitIds: ['v1'] });
    publishStampingSuccess({ owner: 'alice', visitIds: ['v1', 'v2'] });
    publishStampingSuccess({ owner: 'alice', visitIds: ['v2', 'v1'] });
  });
  await waitFor(() => expect(screen.getByTestId('stamping-success-card')).toBeTruthy());
  expect(fetchStampingFeedback).toHaveBeenCalledTimes(1);
  expect(fetchStampingFeedback).toHaveBeenCalledWith('local-test', ['v1', 'v2']);
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['badgeAlbum', 'alice'] });
});

test('account switch discards a delayed response', async () => {
  let resolve!: (value: StampingFeedback) => void;
  (fetchStampingFeedback as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<StampingSuccessHost />);
  act(() => publishStampingSuccess({ owner: 'alice', visitIds: ['v1'] }));
  await waitFor(() => expect(fetchStampingFeedback).toHaveBeenCalledTimes(1));
  mockOwner = 'bob'; view.rerender(<StampingSuccessHost />);
  await act(async () => resolve(summary));
  expect(screen.queryByTestId('stamping-success-card')).toBeNull();
});

test('a failed feedback lookup acknowledges the saved visit without fabricating progress', async () => {
  (fetchStampingFeedback as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<StampingSuccessHost />);
  act(() => publishStampingSuccess({ owner: 'alice', visitIds: ['v1'] }));
  await waitFor(() => expect(screen.getByText('1 Besuch bestätigt.')).toBeTruthy());
  expect(screen.queryByText('7 → 8 reguläre Stempel')).toBeNull();
});

test('friend-only confirmation keeps personal progress separate', async () => {
  render(<StampingSuccessHost />);
  act(() => publishStampingSuccess({ owner: 'alice', visitIds: [], eventId: 'group-1', friendVisitCount: 2 }));
  await waitFor(() => expect(screen.getByText('2 Besuche für Freunde gespeichert.')).toBeTruthy());
  expect(fetchStampingFeedback).not.toHaveBeenCalled();
});


test('new badges have a single explicit album action', () => {
  const album = jest.fn();
  const badge = { id: 'bronze', name: 'Bronze', category: 'Leistungsabzeichen', frame: 'bronze', icon: 'feather' as const, condition: '8 Stempel', unlocked: true, acquiredAt: null, titles: [], progress: [], required: [] };
  render(<StampingSuccessCard feedback={{ ...summary, newBadges: [badge] }} onClose={jest.fn()} onAlbum={album} />);
  fireEvent.press(screen.getByRole('button', { name: 'Abzeichen ansehen' }));
  expect(album).toHaveBeenCalledTimes(1);
});
