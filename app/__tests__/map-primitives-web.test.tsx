import { act, render } from '@testing-library/react-native';
import React from 'react';

import MapView, { Marker } from '@/components/maps/map-primitives.web';

const mockDivIcon = jest.fn((options: unknown) => ({ options, type: 'div-icon' }));
const mockIcon = jest.fn((options: unknown) => ({ options, type: 'icon' }));
const mockMaplibreGL = jest.fn((_options: unknown) => ({ addTo: jest.fn(() => ({ remove: jest.fn() })) }));
const mockTileLayer = jest.fn((_url: string, _options: unknown) => ({ addTo: jest.fn(() => ({ remove: jest.fn() })) }));
const mockMapContainer = jest.fn((_props: unknown) => null);
const mockLeafletMarker = jest.fn((_props: unknown) => null);

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    divIcon: (options: unknown) => mockDivIcon(options),
    icon: (options: unknown) => mockIcon(options),
    latLngBounds: jest.fn(),
    maplibreGL: (options: unknown) => mockMaplibreGL(options),
    tileLayer: (url: string, options: unknown) => mockTileLayer(url, options),
  },
}));

jest.mock('@maplibre/maplibre-gl-leaflet', () => ({}));

jest.mock('react-leaflet', () => {
  return {
    MapContainer: (props: unknown) => mockMapContainer(props),
    Marker: (props: unknown) => mockLeafletMarker(props),
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

  it('highlights selection above other pins and restores the normal icon on close', () => {
    const props = { coordinate: { latitude: 51.7, longitude: 10.6 }, pinColor: '#123abc', zIndex: 12 };
    const view = render(<Marker {...props}>SEL</Marker>);
    const normal = mockLeafletMarker.mock.calls.at(-1)![0] as { icon: unknown; zIndexOffset: number };
    view.rerender(<Marker {...props} selected>SEL</Marker>);
    const selected = mockLeafletMarker.mock.calls.at(-1)![0] as typeof normal;
    expect(selected.zIndexOffset).toBeGreaterThan(10000);
    expect(selected.icon).not.toBe(normal.icon);
    const icon = mockDivIcon.mock.calls.at(-1)![0] as { className: string; html: string };
    expect(icon.className).toContain('hwb-map-marker-selected');
    expect(icon.html).toContain('fill="#ea4335"');
    expect(icon.html).toContain('<circle fill="#a50e0e"');
    expect(icon.html).not.toContain('SEL');
    view.rerender(<Marker {...props}>SEL</Marker>);
    expect(mockLeafletMarker.mock.calls.at(-1)![0]).toEqual(expect.objectContaining(normal));
  });

  it('activates individual keyboard targets once for Enter and Space', () => {
    const onPress = jest.fn();
    render(<Marker coordinate={{ latitude: 51.8, longitude: 10.6 }} onPress={onPress}>9</Marker>);
    const { eventHandlers } = mockLeafletMarker.mock.calls[0][0] as {
      eventHandlers: { keydown: (event: { originalEvent: Partial<KeyboardEvent> }) => void };
    };
    const event = { key: 'Enter', repeat: false, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    eventHandlers.keydown({ originalEvent: event });
    eventHandlers.keydown({ originalEvent: { ...event, repeat: true } });
    eventHandlers.keydown({ originalEvent: { ...event, key: ' ' } });
    eventHandlers.keydown({ originalEvent: { ...event, key: 'ArrowDown' } });
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(event.preventDefault).toHaveBeenCalledTimes(3);
  });

  it('uses raster tiles without initializing GL and cleans up when changing renderer', () => {
    render(<MapView />);
    const container = mockMapContainer.mock.calls[0][0] as { children: React.ReactNode };
    const basemap = React.Children.toArray(container.children).find(
      child => React.isValidElement(child) && typeof child.type === 'function' && child.type.name === 'OpenFreeMapLayer'
    ) as React.ReactElement<{ styleId: 'raster' | 'standard' }>;
    const layer = render(React.cloneElement(basemap, { styleId: 'raster' }));
    expect(mockMaplibreGL).not.toHaveBeenCalled();
    expect(mockTileLayer).toHaveBeenCalledWith('https://tile.openstreetmap.org/{z}/{x}/{y}.png', expect.objectContaining({
      detectRetina: false, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1,
    }));
    const raster = mockTileLayer.mock.results[0].value.addTo.mock.results[0].value;
    layer.rerender(React.cloneElement(basemap, { styleId: 'standard' }));
    expect(raster.remove).toHaveBeenCalledTimes(1);
    expect(mockMaplibreGL).toHaveBeenCalledTimes(1);
    const vector = mockMaplibreGL.mock.results[0].value.addTo.mock.results[0].value;
    layer.unmount();
    expect(vector.remove).toHaveBeenCalledTimes(1);
  });

  it.each([1, 2, 3])('limits only the basemap resolution at device pixel ratio %s', (devicePixelRatio) => {
    const originalRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: devicePixelRatio });
    try {
      render(<MapView />);
      const container = mockMapContainer.mock.calls[0][0] as { children: React.ReactNode };
      const basemap = React.Children.toArray(container.children).find(
        (child) => React.isValidElement(child) && typeof child.type === 'function' && child.type.name === 'OpenFreeMapLayer'
      );
      const layer = render(basemap as React.ReactElement);
      expect(mockMaplibreGL).toHaveBeenCalledWith(expect.objectContaining({
        pixelRatio: Math.min(devicePixelRatio, 1.5),
        fadeDuration: 0,
        style: 'https://tiles.openfreemap.org/styles/liberty',
      }));
      const { remove } = mockMaplibreGL.mock.results[0].value.addTo.mock.results[0].value;
      layer.unmount();
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      if (originalRatio) Object.defineProperty(window, 'devicePixelRatio', originalRatio);
      else Reflect.deleteProperty(window, 'devicePixelRatio');
    }
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
