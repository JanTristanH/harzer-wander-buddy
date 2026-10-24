import { act, render } from '@testing-library/react-native';
import React from 'react';

import MapView, { Marker } from '@/components/maps/map-primitives.web';

const mockDivIcon = jest.fn((options: unknown) => ({ options, type: 'div-icon' }));
const mockIcon = jest.fn((options: unknown) => ({ options, type: 'icon' }));
const mockMaplibreGL = jest.fn((_options: unknown) => ({ addTo: jest.fn(() => ({ remove: jest.fn() })) }));
const mockMapContainer = jest.fn((_props: unknown) => null);

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    divIcon: (options: unknown) => mockDivIcon(options),
    icon: (options: unknown) => mockIcon(options),
    latLngBounds: jest.fn(),
    maplibreGL: (options: unknown) => mockMaplibreGL(options),
  },
}));

jest.mock('@maplibre/maplibre-gl-leaflet', () => ({}));

jest.mock('react-leaflet', () => {
  return {
    MapContainer: (props: unknown) => mockMapContainer(props),
    Marker: () => null,
    Polyline: () => null,
    useMap: jest.fn(),
    useMapEvents: jest.fn(),
  };
});

describe('web map primitives', () => {
  const watchPosition = jest.fn();
  const clearWatch = jest.fn();
  let injectedStyle: { id: string; textContent: string } | null;
  let originalNavigatorDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    injectedStyle = null;
    watchPosition.mockReturnValue(73);
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');
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
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        geolocation: {
          clearWatch,
          watchPosition,
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: undefined,
    });
    if (originalNavigatorDescriptor) {
      Object.defineProperty(global, 'navigator', originalNavigatorDescriptor);
    } else {
      Reflect.deleteProperty(global, 'navigator');
    }
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
    expect(options.html).toContain('--hwb-marker-badge-width:21.8px');
    expect(options.html).not.toMatch(/<svg\b/i);
    expect(options.html).not.toMatch(/<filter\b/i);
    expect(options.html).not.toMatch(/feDropShadow/i);
  });

  it('adds the warning badge while preserving the marker number and escaping image attributes', () => {
    render(<Marker noticeBadge coordinate={{ latitude: 51.75, longitude: 10.61 }} pinColor="#2e6b4b">146</Marker>);
    const css = mockDivIcon.mock.calls[0][0] as { html: string };
    expect(css.html).toContain('⚡');
    expect(css.html).toContain('146');
    render(<Marker noticeBadge coordinate={{ latitude: 51.76, longitude: 10.62 }} image={{ uri: 'https://example.test/pin.png?name="quoted"' }} />);
    const image = mockDivIcon.mock.calls[1][0] as { html: string };
    expect(image.html).toContain('<img');
    expect(image.html).toContain('&quot;quoted&quot;');
    expect(image.html).toContain('⚡');
  });

  it('uses lightweight CSS zoom animations and batches wheel zoom input', () => {
    render(<MapView />);

    const markerCss = global.document.getElementById('hwb-leaflet-runtime-css')?.textContent;
    expect(markerCss).toMatch(/\.hwb-css-marker \{[^}]*display: block;/s);
    expect(markerCss).toContain('mask-image: url("data:image/svg+xml,');
    expect(markerCss).toContain('transform: scale(var(--hwb-marker-scale-x), var(--hwb-marker-scale-y))');
    expect(markerCss).toContain('font: 700 var(--hwb-marker-font-size)/1 Arial, Helvetica, sans-serif');
    expect(markerCss).toContain('width: var(--hwb-marker-badge-width)');
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
