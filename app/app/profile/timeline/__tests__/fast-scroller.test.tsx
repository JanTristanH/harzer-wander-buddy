import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PanResponder, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

import ProfileTimelineScreen from '../[userId]';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ userId: 'self' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: null }),
  useIdTokenClaims: () => null,
}));
jest.mock('@/lib/queries', () => ({
  useProfileOverviewQuery: () => ({
    data: { name: 'Test', stampings: Array.from({ length: 10 }, (_, i) => ({
      id: String(i), stampId: `stamp-${i}`, stampName: `Stempel ${i}`,
      visitedAt: `2026-10-${String(15 - i).padStart(2, '0')}T12:00:00Z`,
    })) },
    isPending: false,
  }),
  useUserProfileOverviewQuery: () => ({}),
}));

it('keeps timeline drags clamped outside the rail despite changing native local coordinates', () => {
  const responderSpy = jest.spyOn(PanResponder, 'create');
  render(<ProfileTimelineScreen />);
  const scroll = screen.UNSAFE_getByType(ScrollView);
  const scrollSpy = jest.spyOn(scroll.instance, 'scrollTo').mockImplementation(() => {});
  fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 400 } } });
  fireEvent(scroll, 'contentSizeChange', 390, 2000);
  const track = screen.UNSAFE_getAllByType(View).find((view) => {
    const style = StyleSheet.flatten(view.props.style);
    return view.props.onLayout && style?.width === 4;
  })!;
  fireEvent(track, 'layout', { nativeEvent: { layout: { height: 400 } } });
  const handlers = responderSpy.mock.calls.at(-1)![0];
  const event = (locationY: number) => ({ nativeEvent: { locationY } }) as GestureResponderEvent;
  const gesture = (dy: number) => ({ dy }) as PanResponderGestureState;
  act(() => handlers.onPanResponderGrant!(event(200), gesture(8)));
  expect(scrollSpy.mock.calls.at(-1)![0]).toEqual({ y: 800, animated: false });
  act(() => handlers.onPanResponderMove!(event(999), gesture(-500)));
  expect(scrollSpy.mock.calls.at(-1)![0]).toEqual({ y: 0, animated: false });
  act(() => handlers.onPanResponderMove!(event(-999), gesture(1000)));
  expect(scrollSpy.mock.calls.at(-1)![0]).toEqual({ y: 1600, animated: false });
  act(() => handlers.onPanResponderMove!(event(-999), gesture(8)));
  expect(scrollSpy.mock.calls.at(-1)![0]).toEqual({ y: 800, animated: false });
  act(() => handlers.onPanResponderRelease!(event(200), gesture(8)));
  responderSpy.mockRestore();
});
