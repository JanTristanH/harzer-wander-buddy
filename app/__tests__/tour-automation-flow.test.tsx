import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import AutomaticTourScreen from '@/app/tours/automatic';
import type { TourSuggestions } from '@/lib/tour-suggestions';

let mockSelectedFriends: string[] = [];
let mockSuggestions: TourSuggestions | undefined;
const mockGenerate = jest.fn();
const mockSave = jest.fn();
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  return { useRouter: () => router };
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    canPerformWrites: true,
    isOffline: false,
    accessToken: 'token',
  }),
}));
jest.mock('@/lib/hiking-group', () => ({
  useHikingGroup: () => ({
    isLoading: false,
    selectedFriendIds: mockSelectedFriends,
    selectedMembers: [],
    groupUserIds: ['alice', ...mockSelectedFriends],
  }),
}));
jest.mock('@/components/group-selector', () => ({ GroupSelector: () => null }));
jest.mock('@/lib/queries', () => ({
  usePointsOfInterestQuery: () => ({
    data: [
      {
        ID: 'p',
        name: 'Parkplatz am Wald',
        poiType: 'parking',
        latitude: 51.8,
        longitude: 10.6,
      },
    ],
  }),
}));
jest.mock('@/lib/tour-suggestions', () => ({
  useTourSuggestions: () => ({
    suggestions: mockSuggestions,
    generation: { isPending: false, mutateAsync: mockGenerate },
    save: { isPending: false, mutateAsync: mockSave, reset: jest.fn() },
  }),
}));
jest.mock('@/components/maps/map-primitives', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: object, _ref: unknown) =>
      React.createElement(View, props)
    ),
    Marker: View,
    Polyline: View,
  };
});

function result(id: string) {
  return {
    id,
    idListTravelTimes: id,
    distance: 1200,
    duration: 2400,
    stampCount: 2,
    matchingStampCount: 2,
    newStampCountForUser: 2,
    groupSize: 1,
    averageGroupStampings: 0,
    totalElevationGain: 30,
    totalElevationLoss: 30,
    path: [
      {
        travelTime_ID: id,
        tour_ID: '',
        rank: 512,
        travelTime: {
          ID: id,
          fromPoi: 'p',
          toPoi: 'p',
          durationSeconds: 2400,
          distanceMeters: 1200,
          elevationGain: 30,
          elevationLoss: 30,
        },
      },
    ],
  };
}

async function openStepTwo() {
  fireEvent.changeText(screen.getByLabelText('Parkplatz suchen'), 'Wald');
  fireEvent.press(screen.getByText('Parkplatz am Wald'));
  fireEvent.press(screen.getByText('Weiter'));
  await waitFor(() =>
    expect(screen.getByText('Für wen planst du?')).toBeTruthy()
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedFriends = [];
  mockSuggestions = undefined;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  mockGenerate.mockImplementation(async (parameters) => {
    mockSuggestions = {
      sessionId: 'session',
      generatedAt: new Date().toISOString(),
      parameters,
      searchLimited: false,
      savedTourIds: {},
      results: [result('first'), result('second')],
    };
    return mockSuggestions;
  });
  mockSave.mockImplementation(async ({ route }) => {
    mockSuggestions!.savedTourIds[route.id] = `saved-${route.id}`;
    return `saved-${route.id}`;
  });
});

test('defaults to an existing group and allows explicit solo generation without sending friends', async () => {
  mockSelectedFriends = ['bob'];
  render(<AutomaticTourScreen />);
  await openStepTwo();
  expect(
    screen.getByRole('radio', { name: /Mit Gruppe/ }).props.accessibilityState
      .checked
  ).toBe(true);
  expect(screen.getByText('Fehlt allen')).toBeTruthy();
  fireEvent.press(screen.getByText('Nur ich'));
  expect(screen.queryByText('Fehlt allen')).toBeNull();
  fireEvent.press(screen.getByText('Touren finden'));
  await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));
  expect(mockGenerate.mock.calls[0][0]).toMatchObject({
    groupFilterStampings: '',
    maxDuration: 7200,
  });
});

test('uses the selected group and missing_all when generating for friends', async () => {
  mockSelectedFriends = ['bob', 'charlie'];
  render(<AutomaticTourScreen />);
  await openStepTwo();
  fireEvent.press(screen.getByText('Fehlt allen'));
  fireEvent.press(screen.getByText('Touren finden'));
  await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));
  expect(mockGenerate.mock.calls[0][0]).toMatchObject({
    groupFilterStampings: 'bob,charlie',
    groupMode: 'missing_all',
  });
});

test('saving stays on the screen, every proposal can be saved, and editing requires another tap', async () => {
  render(<AutomaticTourScreen />);
  await openStepTwo();
  await act(async () => fireEvent.press(screen.getByText('Touren finden')));
  await waitFor(() =>
    expect(screen.getByText('1 / 2 Vorschläge')).toBeTruthy()
  );
  await act(async () =>
    fireEvent.press(screen.getByText('Als Tour speichern'))
  );
  expect(useRouter().push).not.toHaveBeenCalled();
  expect(screen.getByText('Gespeichert · Bearbeiten')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Nächster Vorschlag'));
  expect(screen.getByText('2 / 2 Vorschläge')).toBeTruthy();
  fireEvent.press(screen.getByText('Details und Stationen ansehen'));
  expect(useRouter().push).toHaveBeenLastCalledWith({
    pathname: '/tours/proposal',
    params: { session: 'session', index: '1' },
  });
  jest.mocked(useRouter().push).mockClear();
  await act(async () =>
    fireEvent.press(screen.getByText('Als Tour speichern'))
  );
  expect(mockSave.mock.calls.map(([payload]) => payload.route.id)).toEqual([
    'first',
    'second',
  ]);
  expect(useRouter().push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Gespeichert · Bearbeiten'));
  expect(useRouter().push).toHaveBeenLastCalledWith({
    pathname: '/tours/[id]',
    params: { id: 'saved-second', edit: '1' },
  });
});
