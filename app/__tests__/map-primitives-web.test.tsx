import { act, render } from '@testing-library/react-native';
import React from 'react';

import MapView, { Marker } from '@/components/maps/map-primitives.web';

const mockDivIcon = jest.fn((options: unknown) => ({ options, type: 'div-icon' }));
const mockIcon = jest.fn((options: unknown) => ({ options, type: 'icon' }));
const mockMapContainer = jest.fn((_props: unknown) => null);

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    divIcon: (options: unknown) => mockDivIcon(options),
    icon: (options: unknown) => mockIcon(options),
    latLngBounds: jest.fn(),
  },
}));

jest.mock('react-leaflet', () => {
  return {
    MapContainer: (props: unknown) => mockMapContainer(props),
    Marker: () => null,
    Polyline: () => null,
    TileLayer: () => null,
    useMap: jest.fn(),
    useMapEvents: jest.fn(),
  };
});

describe('web map primitives', () => {
  const watchPosition = jest.fn();
  const clearWatch = jest.fn();
  let injectedStyle: { id: string; textContent: string } | null;

  beforeEach(() => {
    jest.clearAllMocks();
    injectedStyle = null;
    watchPosition.mockReturnValue(73);
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: {
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: (id: string) => (injectedStyle?.id === id ? injectedStyle : null),
        head: {
          appendChild: (element: { id: string; textContent: string }) => {
            injectedStyle = element;
          },
        },
      },
    });
    Object.defineProperty(global.window, 'location', {
      configurable: true,
      value: { hostname: 'example.test' },
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: {
        clearWatch,
        watchPosition,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
  });

  it('keeps one geolocation watch, calls the newest callback, and deduplicates coordinates', () => {
    const firstCallback = jest.fn();
    const newestCallback = jest.fn();
    const view = render(
      <MapView onUserLocationChange={firstCallback} showsUserLocation />
    );

    expect(watchPosition).toHaveBeenCalledTimes(1);

    view.rerender(
      <MapView onUserLocationChange={newestCallback} showsUserLocation />
    );

    expect(watchPosition).toHaveBeenCalledTimes(1);

    const reportPosition = watchPosition.mock.calls[0][0] as PositionCallback;
    const firstPosition = {
      coords: {
        latitude: 51.7544,
        longitude: 10.6182,
      },
    } as GeolocationPosition;

    act(() => {
      reportPosition(firstPosition);
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(newestCallback).toHaveBeenCalledTimes(1);
    expect(newestCallback).toHaveBeenLastCalledWith({
      nativeEvent: {
        coordinate: {
          latitude: 51.7544,
          longitude: 10.6182,
        },
      },
    });

    act(() => {
      reportPosition(firstPosition);
    });

    expect(newestCallback).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(clearWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(73);
  });

  it('creates marker HTML without SVG filters', () => {
    render(
      <Marker
        coordinate={{ latitude: 51.7544, longitude: 10.6182 }}
        pinColor="#2e6b4b">
        42
      </Marker>
    );

    expect(mockDivIcon).toHaveBeenCalledTimes(1);
    const options = mockDivIcon.mock.calls[0][0] as { html: string };

    expect(options.html).toContain('hwb-css-marker');
    expect(options.html).not.toMatch(/<svg\b/i);
    expect(options.html).not.toMatch(/<filter\b/i);
    expect(options.html).not.toMatch(/feDropShadow/i);
  });

  it('uses lightweight CSS zoom animations and batches wheel zoom input', () => {
    render(<MapView />);

    const markerCss = global.document.getElementById('hwb-leaflet-runtime-css')?.textContent;
    expect(markerCss).toMatch(/\.hwb-css-marker \{[^}]*display: block;/s);
    expect(markerCss).toContain('.leaflet-zoom-anim .leaflet-zoom-hide');
    expect(markerCss).toContain('transition: transform 0.25s');
    expect(markerCss).not.toContain('box-shadow');
    expect(mockMapContainer).toHaveBeenCalledTimes(1);
    expect(mockMapContainer.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        fadeAnimation: false,
        markerZoomAnimation: true,
        wheelDebounceTime: 120,
        wheelPxPerZoomLevel: 100,
        zoomAnimation: true,
        zoomSnap: 1,
      })
    );
  });
});
