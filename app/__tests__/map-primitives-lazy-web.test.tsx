/* eslint-disable @typescript-eslint/no-require-imports -- Deferred Jest module factories. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import MapView, { Marker, Polyline, type MapViewRef } from '@/components/maps/map-primitives.web';

const mockLoaded = jest.fn();
const mockAnimate = jest.fn();
const mockLoad = jest.fn(() => Promise.resolve(require('@/components/maps/map-primitives-leaflet.web')));

jest.mock('@/components/maps/load-web-map', () => ({
  loadWebMap: () => mockLoad(),
}));

jest.mock('@/components/maps/map-primitives-leaflet.web', () => {
  mockLoaded();
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(function MockMap({ children, onMapReady }: any, ref: any) {
      React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      React.useEffect(() => { onMapReady?.(); }, [onMapReady]);
      return <View>{children}</View>;
    }),
    Marker: ({ accessibilityLabel }: any) => <Text>{accessibilityLabel}</Text>,
    Polyline: () => <Text>Tourenlinie</Text>,
  };
});

it('loads the map only when mounted and preserves refs, readiness, markers and lines', async () => {
  expect(mockLoaded).not.toHaveBeenCalled();
  const ref = React.createRef<MapViewRef>();
  const onReady = jest.fn();
  render(
    <MapView ref={ref} onMapReady={onReady}>
      <Marker coordinate={{ latitude: 51.8, longitude: 10.6 }} accessibilityLabel="Brocken" />
      <Polyline coordinates={[{ latitude: 51.8, longitude: 10.6 }]} />
    </MapView>
  );
  expect(screen.getByLabelText('Karte wird geladen')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Brocken')).toBeTruthy());
  expect(screen.getByText('Tourenlinie')).toBeTruthy();
  expect(mockLoaded).toHaveBeenCalledTimes(1);
  expect(onReady).toHaveBeenCalledTimes(1);
  const region = { latitude: 51.8, longitude: 10.6, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  ref.current?.animateToRegion(region);
  expect(mockAnimate).toHaveBeenCalledWith(region);
});

it('lets the user retry a failed map download', async () => {
  mockLoad.mockRejectedValueOnce(new Error('Network unavailable'));
  render(<MapView><Marker coordinate={{ latitude: 51.8, longitude: 10.6 }} accessibilityLabel="Brocken" /></MapView>);
  const retry = await screen.findByRole('button');
  fireEvent.press(retry);
  await waitFor(() => expect(screen.getByText('Brocken')).toBeTruthy());
});

