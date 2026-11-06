import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import MapView, { Marker } from '@/components/maps/map-primitives.native';

let mockMapsBlocked = false;
const mockRecord = jest.fn();
jest.mock('@/lib/preview-diagnostics', () => ({
  get isPreviewMapBlocked() { return mockMapsBlocked; },
  recordPreviewEvent: (...args: unknown[]) => mockRecord(...args),
}));
beforeEach(() => { mockMapsBlocked = false; mockRecord.mockClear(); });

// Jest factories load these inside the hoisted mock.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: React.forwardRef(function MockNativeMarker(props: object, ref: unknown) {
      return <View {...props} ref={ref} testID="native-marker" />;
    }),
    Polyline: View,
  };
});

/* eslint-enable @typescript-eslint/no-require-imports */

const coordinate = { latitude: 51.8, longitude: 10.6 };
const baseImage = { uri: 'normal-pin.png' };

it('replaces images and custom children with the selected pin, and restores them on dismissal', () => {
  const onPress = jest.fn();
  const props = { coordinate, image: baseImage, onPress, zIndex: 20, tracksViewChanges: false };
  const child = <View testID="group-number" />;
  const view = render(<Marker {...props}>{child}</Marker>);
  expect(view.getByTestId('group-number')).toBeTruthy();
  view.rerender(<Marker {...props} selected>{child}</Marker>);
  const selected = view.getByTestId('native-marker');
  expect(selected.props.image).not.toEqual(baseImage);
  expect(selected.props.zIndex).toBeGreaterThan(10000);
  expect(selected.props.tracksViewChanges).toBe(false);
  expect(view.queryByTestId('group-number')).toBeNull();
  fireEvent.press(selected);
  expect(onPress).toHaveBeenCalledTimes(1);
  view.rerender(<Marker {...props}>{child}</Marker>);
  expect(view.getByTestId('native-marker').props.image).toEqual(baseImage);
  expect(view.getByTestId('native-marker').props.zIndex).toBe(20);
  expect(view.getByTestId('group-number')).toBeTruthy();
});

it('uses tour accessibility selection and hides its badge until the stop is deselected', () => {
  const view = render(<Marker coordinate={coordinate} selectionOverlay accessibilityState={{ selected: true }}>
    <View testID="tour-order" />
  </Marker>);
  expect(view.queryByTestId('native-marker')).toBeNull();
  view.rerender(<Marker coordinate={coordinate} selectionOverlay accessibilityState={{ selected: false }}>
    <View testID="tour-order" />
  </Marker>);
  expect(view.getByTestId('tour-order')).toBeTruthy();
  view.rerender(<Marker coordinate={coordinate} image={baseImage} accessibilityState={{ selected: true }} />);
  expect(view.getByTestId('native-marker').props.image).not.toEqual(baseImage);
});

it('does not create the native map or its markers when a preview Maps key is missing', () => {
  mockMapsBlocked = true;
  const screen = render(<MapView testID="native-map"><Marker coordinate={coordinate} /></MapView>);
  expect(screen.getByText('Karte in dieser Preview nicht verfügbar')).toBeTruthy();
  expect(screen.queryByTestId('native-map')).toBeNull();
  expect(screen.queryByTestId('native-marker')).toBeNull();
  expect(mockRecord).toHaveBeenCalledWith('map.blocked_missing_key');
});

it('renders a configured map, records readiness and preserves the original callback', () => {
  const ready = jest.fn();
  const screen = render(<MapView testID="native-map" onMapReady={ready} />);
  fireEvent(screen.getByTestId('native-map'), 'mapReady', { nativeEvent: {} });
  expect(mockRecord).toHaveBeenCalledWith('map.opened');
  expect(mockRecord).toHaveBeenCalledWith('map.ready');
  expect(ready).toHaveBeenCalledTimes(1);
});
