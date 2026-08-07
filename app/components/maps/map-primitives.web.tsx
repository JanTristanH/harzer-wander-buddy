import type { LeafletEventHandlerFnMap, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { areMapCoordinatesEqual } from '@/lib/map-viewport';
import { createCssMapMarkerHtml, normalizeWebMarkerLabel } from '@/lib/web-map-marker';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type Camera = {
  center?: LatLng;
  heading?: number;
  pitch?: number;
  zoom?: number;
};

type EdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FitToCoordinatesOptions = {
  edgePadding?: EdgePadding;
  animated?: boolean;
};

type AnimateCameraOptions = {
  duration?: number;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (coordinates: LatLng[], options?: FitToCoordinatesOptions) => void;
  getCamera: () => Promise<Required<Pick<Camera, 'heading' | 'pitch' | 'zoom'>> & { center: LatLng }>;
  animateCamera: (camera: Camera, options?: AnimateCameraOptions) => void;
};

type MapViewProps = {
  attributionPlacement?: 'bottom-right' | 'below-zoom';
  children?: React.ReactNode;
  initialRegion?: Region;
  onMapReady?: () => void;
  onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
  onRegionChange?: (region: Region) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onUserLocationChange?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
  showsUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
  toolbarEnabled?: boolean;
  showsCompass?: boolean;
  showsMyLocationButton?: boolean;
};

type MarkerProps = {
  accessibilityLabel?: string;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
  coordinate: LatLng;
  image?: unknown;
  onPress?: () => void;
  pinColor?: string;
  tracksViewChanges?: boolean;
  zIndex?: number;
};

type PolylineProps = {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

const DEFAULT_REGION: Region = {
  latitude: 51.7544,
  longitude: 10.6182,
  latitudeDelta: 0.42,
  longitudeDelta: 0.42,
};

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' } as const;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const FALLBACK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const FALLBACK_TILE_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO';
const WEB_MARKER_SIZE = 48;
const WEB_MARKER_SIZE_COMPACT = 24;
const MIN_ZOOM = 2;
const MAX_ZOOM = 19;
const WEB_MAP_DIAGNOSTIC_INTERVAL_MS = 4000;
const LEAFLET_STYLE_TAG_ID = 'hwb-leaflet-runtime-css';
const LEAFLET_RUNTIME_CSS = `
.leaflet-container {
  background: #ddd;
  overflow: hidden;
  outline: 0;
  touch-action: none;
  user-select: none;
}
.leaflet-container * {
  touch-action: none;
}
.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas {
  left: 0;
  position: absolute;
  top: 0;
}
.leaflet-pane { z-index: 400; }
.leaflet-tile-pane { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane { z-index: 500; }
.leaflet-marker-pane { z-index: 600; }
.leaflet-tooltip-pane { z-index: 650; }
.leaflet-popup-pane { z-index: 700; }
.leaflet-top,
.leaflet-bottom {
  pointer-events: none;
  position: absolute;
  z-index: 1000;
}
.leaflet-top { top: 0; }
.leaflet-right { right: 0; }
.leaflet-bottom { bottom: 0; }
.leaflet-left { left: 0; }
.leaflet-control {
  clear: both;
  pointer-events: auto;
  position: relative;
  z-index: 800;
}
.leaflet-right .leaflet-control {
  float: right;
  margin-right: 10px;
}
.leaflet-bottom .leaflet-control {
  margin-bottom: 10px;
}
.leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  color: #333;
  font: 12px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding: 3px 7px;
}
.leaflet-control-attribution a {
  color: #1b63c3;
  text-decoration: none;
}
.leaflet-control-attribution a:hover {
  text-decoration: underline;
}
.hwb-leaflet-map.hwb-attribution-below-zoom .leaflet-bottom.leaflet-right {
  display: none;
}
.hwb-leaflet-map.hwb-attribution-below-zoom .leaflet-bottom.leaflet-left .leaflet-control-attribution {
  margin-bottom: 100px;
  margin-left: 10px;
}
.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg { z-index: 200; }
.leaflet-zoom-box {
  border: 2px dotted #38f;
  height: 0;
  pointer-events: none;
  width: 0;
}
.leaflet-tile {
  user-select: none;
  visibility: hidden;
}
.leaflet-tile-loaded { visibility: inherit; }
.leaflet-zoom-animated { transform-origin: 0 0; }
svg.leaflet-zoom-animated { will-change: transform; }
.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1);
}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
  transition: none;
}
.leaflet-zoom-anim .leaflet-zoom-hide {
  visibility: hidden;
}
.leaflet-container img {
  max-height: none;
  max-width: none !important;
  width: auto;
}
.hwb-leaflet-div-icon {
  background: transparent;
  border: 0;
  overflow: visible;
}
.hwb-css-marker {
  --hwb-marker-color: #2e6b4b;
  display: block;
  height: 52px;
  pointer-events: none;
  position: relative;
  width: 48px;
}
.hwb-css-marker::before {
  background: var(--hwb-marker-color);
  border: 2px solid #fff;
  border-radius: 50% 50% 50% 0;
  box-sizing: border-box;
  content: "";
  height: 34px;
  left: 7px;
  position: absolute;
  top: 5px;
  transform: rotate(-45deg);
  width: 34px;
  z-index: 0;
}
.hwb-css-marker__label {
  align-items: center;
  background: #fff;
  border-radius: 999px;
  box-sizing: border-box;
  color: #111;
  display: flex;
  font: 700 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  height: 18px;
  justify-content: center;
  left: 7px;
  padding: 0 2px;
  position: absolute;
  right: 7px;
  top: 12px;
  z-index: 1;
}
.hwb-css-marker--wide-label .hwb-css-marker__label {
  font-size: 11px;
}
.hwb-css-marker--compact {
  height: 100%;
  width: 100%;
}
.hwb-css-marker--compact::before {
  border-radius: 50%;
  height: auto;
  inset: 2px;
  transform: none;
  width: auto;
}
.hwb-css-marker--compact .hwb-css-marker__label {
  display: none;
}
`;

const iconCache = new Map<string, L.Icon | L.DivIcon>();
const webMapPerfDebugState = {
  iconCacheHits: 0,
  iconCacheMisses: 0,
  markerRenders: 0,
  markerMounts: 0,
  markerUnmounts: 0,
  mapMoveEvents: 0,
  mapMoveEndEvents: 0,
  maxMoveDurationMs: 0,
};

function isLocalhostMapPerfEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostName = window.location.hostname;
  return hostName === 'localhost' || hostName === '127.0.0.1';
}

function ensureLeafletRuntimeCss() {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(LEAFLET_STYLE_TAG_ID)) {
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.id = LEAFLET_STYLE_TAG_ID;
  styleTag.textContent = LEAFLET_RUNTIME_CSS;
  document.head.appendChild(styleTag);
}

function clampZoom(value: number) {
  if (!Number.isFinite(value)) {
    return 12;
  }

  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function zoomFromLongitudeDelta(longitudeDelta: number, viewportWidth = 256) {
  const normalized = Math.max(0.000001, longitudeDelta);
  const normalizedViewportWidth = Number.isFinite(viewportWidth)
    ? Math.max(1, viewportWidth)
    : 256;

  return clampZoom(Math.log2((360 * normalizedViewportWidth) / (256 * normalized)));
}

function regionFromMap(map: LeafletMap): Region {
  const center = map.getCenter();
  const bounds = map.getBounds();

  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: Math.max(0.000001, bounds.getNorth() - bounds.getSouth()),
    longitudeDelta: Math.max(0.000001, bounds.getEast() - bounds.getWest()),
  };
}

function coordinateToTuple(coordinate: LatLng): [number, number] {
  return [coordinate.latitude, coordinate.longitude];
}

function moveMapEfficiently(
  map: LeafletMap,
  center: L.LatLngExpression,
  zoom: number,
  durationMs: number
) {
  if (Math.abs(map.getZoom() - zoom) > 0.000001) {
    map.setView(center, zoom, { animate: durationMs > 0 });
    return;
  }

  map.panTo(center, {
    animate: durationMs > 0,
    duration: Math.max(0, durationMs) / 1000,
  });
}

function extractMarkerLabel(children: React.ReactNode): string | null {
  if (children == null || typeof children === 'boolean') {
    return null;
  }

  if (typeof children === 'string' || typeof children === 'number') {
    const text = String(children).trim();
    return text || null;
  }

  if (Array.isArray(children)) {
    for (const child of children) {
      const nestedText = extractMarkerLabel(child);
      if (nestedText) {
        return nestedText;
      }
    }
    return null;
  }

  if (React.isValidElement(children)) {
    return extractMarkerLabel((children.props as { children?: React.ReactNode }).children);
  }

  return null;
}

type ResolvedImageSource = {
  uri: string;
  width?: number;
  height?: number;
};

function resolveImageSource(source: unknown): ResolvedImageSource | null {
  if (!source) {
    return null;
  }

  if (typeof source === 'string') {
    return { uri: source };
  }

  if (typeof source === 'number') {
    const resolved = Image.resolveAssetSource(source);
    if (!resolved?.uri) {
      return null;
    }

    return {
      height: typeof resolved.height === 'number' ? resolved.height : undefined,
      uri: resolved.uri,
      width: typeof resolved.width === 'number' ? resolved.width : undefined,
    };
  }

  if (typeof source === 'object' && source !== null && 'uri' in source) {
    const candidate = source as { uri?: unknown; width?: unknown; height?: unknown };
    if (typeof candidate.uri !== 'string') {
      return null;
    }

    return {
      height: typeof candidate.height === 'number' ? candidate.height : undefined,
      uri: candidate.uri,
      width: typeof candidate.width === 'number' ? candidate.width : undefined,
    };
  }

  return null;
}

function createIcon(options: {
  anchor?: { x: number; y: number };
  color: string;
  imageUri?: string | null;
  imageSize?: { height?: number; width?: number } | null;
  label?: string | null;
  size: number;
}) {
  const { anchor, color, imageSize, imageUri, label, size } = options;
  const width = size;
  const inferredImageRatio =
    imageSize?.width && imageSize?.height && imageSize.width > 0 && imageSize.height > 0
      ? imageSize.height / imageSize.width
      : null;
  const height = inferredImageRatio
    ? Math.round(width * inferredImageRatio)
    : size <= 18
      ? size
      : Math.round((size * 52) / 48);
  const iconAnchor: [number, number] = [
    Math.round((anchor?.x ?? 0.5) * width),
    Math.round((anchor?.y ?? 1) * height),
  ];

  const normalizedLabel = normalizeWebMarkerLabel(label ?? null);
  const cacheKey = `${imageUri ?? 'css'}:${color}:${size}:${iconAnchor[0]}:${iconAnchor[1]}:${normalizedLabel ?? ''}:${
    imageSize?.width ?? ''
  }x${imageSize?.height ?? ''}`;
  const existing = iconCache.get(cacheKey);
  if (existing) {
    if (isLocalhostMapPerfEnabled()) {
      webMapPerfDebugState.iconCacheHits += 1;
    }
    return existing;
  }

  const icon = imageUri
    ? L.icon({
        iconAnchor,
        iconSize: [width, height],
        iconUrl: imageUri,
      })
    : L.divIcon({
        className: 'hwb-leaflet-div-icon',
        html: createCssMapMarkerHtml({ color, label: normalizedLabel, size }),
        iconAnchor,
        iconSize: [width, height],
      });

  iconCache.set(cacheKey, icon);
  if (isLocalhostMapPerfEnabled()) {
    webMapPerfDebugState.iconCacheMisses += 1;
  }
  return icon;
}

function MapEventBridge(props: {
  onPress?: MapViewProps['onPress'];
  onRegionChange?: MapViewProps['onRegionChange'];
  onRegionChangeComplete?: MapViewProps['onRegionChangeComplete'];
}) {
  const { onPress, onRegionChange, onRegionChangeComplete } = props;
  const moveStartAtRef = useRef<number | null>(null);
  const perfDebugEnabled = isLocalhostMapPerfEnabled();

  useMapEvents({
    click(event) {
      onPress?.({
        nativeEvent: {
          coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng },
        },
      });
    },
    move(event) {
      if (perfDebugEnabled) {
        webMapPerfDebugState.mapMoveEvents += 1;
        if (moveStartAtRef.current === null) {
          moveStartAtRef.current = performance.now();
        }
      }

      if (!onRegionChange) {
        return;
      }

      onRegionChange(regionFromMap(event.target));
    },
    moveend(event) {
      if (perfDebugEnabled) {
        webMapPerfDebugState.mapMoveEndEvents += 1;
        if (moveStartAtRef.current !== null) {
          const durationMs = performance.now() - moveStartAtRef.current;
          webMapPerfDebugState.maxMoveDurationMs = Math.max(
            webMapPerfDebugState.maxMoveDurationMs,
            durationMs
          );
          moveStartAtRef.current = null;
        }
      }

      if (!onRegionChangeComplete) {
        return;
      }

      onRegionChangeComplete(regionFromMap(event.target));
    },
  });

  return null;
}

function MapInstanceBridge(props: { onMapReady?: (map: LeafletMap) => void }) {
  const { onMapReady } = props;
  const map = useMap();
  const hasReportedReadyRef = useRef(false);
  const onMapReadyRef = useRef(onMapReady);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (hasReportedReadyRef.current) {
      return;
    }

    hasReportedReadyRef.current = true;
    onMapReadyRef.current?.(map);
  }, [map]);

  return null;
}

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(props, ref) {
  const {
    attributionPlacement = 'bottom-right',
    children,
    initialRegion,
    onMapReady,
    onPress,
    onRegionChange,
    onRegionChangeComplete,
    onUserLocationChange,
    showsUserLocation,
    style,
  } = props;
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const lastUserLocationRef = useRef<LatLng | null>(null);
  const onUserLocationChangeRef = useRef(onUserLocationChange);
  const [tileSource, setTileSource] = useState<{ attribution: string; url: string }>({
    attribution: TILE_ATTRIBUTION,
    url: TILE_URL,
  });
  const perfDebugEnabled = isLocalhostMapPerfEnabled();

  const effectiveRegion = initialRegion ?? DEFAULT_REGION;
  const centerTuple = useMemo(
    () => coordinateToTuple({ latitude: effectiveRegion.latitude, longitude: effectiveRegion.longitude }),
    [effectiveRegion.latitude, effectiveRegion.longitude]
  );
  const initialZoom = useMemo(
    () => zoomFromLongitudeDelta(effectiveRegion.longitudeDelta),
    [effectiveRegion.longitudeDelta]
  );

  useEffect(() => {
    ensureLeafletRuntimeCss();
  }, []);

  useEffect(() => {
    onUserLocationChangeRef.current = onUserLocationChange;
  }, [onUserLocationChange]);

  useEffect(() => {
    if (!map) {
      return;
    }
    map.attributionControl.setPosition(attributionPlacement === 'below-zoom' ? 'bottomleft' : 'bottomright');
  }, [attributionPlacement, map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const resizeAndInvalidate = () => {
      map.invalidateSize();
    };

    const frameId = requestAnimationFrame(resizeAndInvalidate);
    window.addEventListener('resize', resizeAndInvalidate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeAndInvalidate);
    };
  }, [map]);

  useEffect(() => {
    if (!perfDebugEnabled || typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(() => {
      console.debug(
        `[map perf][leaflet] iconCache(size=${iconCache.size},hits=${webMapPerfDebugState.iconCacheHits},misses=${webMapPerfDebugState.iconCacheMisses}) markers(renders=${webMapPerfDebugState.markerRenders},mounts=${webMapPerfDebugState.markerMounts},unmounts=${webMapPerfDebugState.markerUnmounts}) moves(count=${webMapPerfDebugState.mapMoveEvents},end=${webMapPerfDebugState.mapMoveEndEvents},maxMs=${webMapPerfDebugState.maxMoveDurationMs.toFixed(1)})`
      );

      webMapPerfDebugState.iconCacheHits = 0;
      webMapPerfDebugState.iconCacheMisses = 0;
      webMapPerfDebugState.markerRenders = 0;
      webMapPerfDebugState.markerMounts = 0;
      webMapPerfDebugState.markerUnmounts = 0;
      webMapPerfDebugState.mapMoveEvents = 0;
      webMapPerfDebugState.mapMoveEndEvents = 0;
      webMapPerfDebugState.maxMoveDurationMs = 0;
    }, WEB_MAP_DIAGNOSTIC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [perfDebugEnabled]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion(region, duration = 250) {
        if (!map) {
          return;
        }

        moveMapEfficiently(
          map,
          coordinateToTuple(region),
          zoomFromLongitudeDelta(region.longitudeDelta, map.getSize().x),
          duration
        );
      },
      fitToCoordinates(coordinates, options) {
        if (!map || coordinates.length === 0) {
          return;
        }

        const bounds = L.latLngBounds(coordinates.map((coordinate) => coordinateToTuple(coordinate)));
        const edgePadding = options?.edgePadding ?? {};

        map.fitBounds(bounds, {
          animate: options?.animated ?? true,
          paddingBottomRight: [edgePadding.right ?? 0, edgePadding.bottom ?? 0],
          paddingTopLeft: [edgePadding.left ?? 0, edgePadding.top ?? 0],
        });
      },
      async getCamera() {
        if (!map) {
          return {
            center: {
              latitude: effectiveRegion.latitude,
              longitude: effectiveRegion.longitude,
            },
            heading: 0,
            pitch: 0,
            zoom: initialZoom,
          };
        }

        const center = map.getCenter();
        return {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          heading: 0,
          pitch: 0,
          zoom: map.getZoom(),
        };
      },
      animateCamera(camera, options) {
        if (!map) {
          return;
        }

        const center = camera.center ? coordinateToTuple(camera.center) : map.getCenter();
        const zoom = typeof camera.zoom === 'number' ? clampZoom(camera.zoom) : map.getZoom();

        moveMapEfficiently(map, center, zoom, options?.duration ?? 250);
      },
    }),
    [effectiveRegion.latitude, effectiveRegion.longitude, initialZoom, map]
  );

  useEffect(() => {
    if (!showsUserLocation) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        if (
          !Number.isFinite(coordinate.latitude) ||
          !Number.isFinite(coordinate.longitude) ||
          areMapCoordinatesEqual(lastUserLocationRef.current, coordinate)
        ) {
          return;
        }

        lastUserLocationRef.current = coordinate;
        setUserLocation(coordinate);
        onUserLocationChangeRef.current?.({ nativeEvent: { coordinate } });
      },
      () => {
        // Web geolocation can be denied by browser policy/user settings.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      lastUserLocationRef.current = null;
    };
  }, [showsUserLocation]);

  if (typeof window === 'undefined') {
    return <View style={style} />;
  }

  return (
    <View style={style}>
      <MapContainer
        className={`hwb-leaflet-map ${
          attributionPlacement === 'below-zoom' ? 'hwb-attribution-below-zoom' : 'hwb-attribution-bottom-right'
        }`}
        center={centerTuple}
        fadeAnimation={false}
        markerZoomAnimation
        style={MAP_CONTAINER_STYLE}
        wheelDebounceTime={120}
        wheelPxPerZoomLevel={100}
        zoom={initialZoom}
        zoomAnimation
        zoomSnap={1}
        zoomControl={false}>
        <MapInstanceBridge
          onMapReady={(nextMap) => {
            setMap(nextMap);
            onMapReady?.();
          }}
        />
        <TileLayer
          attribution={tileSource.attribution}
          eventHandlers={{
            tileerror() {
              setTileSource((current) => {
                if (current.url === FALLBACK_TILE_URL) {
                  return current;
                }

                return {
                  attribution: FALLBACK_TILE_ATTRIBUTION,
                  url: FALLBACK_TILE_URL,
                };
              });
            },
          }}
          updateWhenZooming={true}
          url={tileSource.url}
        />
        <MapEventBridge
          onPress={onPress}
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
        />

        {showsUserLocation && userLocation ? (
          <LeafletMarker
            icon={createIcon({
              color: '#2f7dd7',
              size: 14,
            })}
            position={coordinateToTuple(userLocation)}
            zIndexOffset={80}
          />
        ) : null}
        {children}
      </MapContainer>
    </View>
  );
});

type InternalMarkerProps = MarkerProps & {
  children?: React.ReactNode;
};

function Marker(props: InternalMarkerProps) {
  const {
    accessibilityLabel,
    anchor,
    children,
    coordinate,
    image,
    onPress,
    pinColor,
    zIndex,
  } = props;
  const perfDebugEnabled = isLocalhostMapPerfEnabled();
  const markerRef = useRef<L.Marker | null>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const isPressable = Boolean(onPress);
  const markerLatitude = coordinate.latitude;
  const markerLongitude = coordinate.longitude;
  const markerEventHandlers = useMemo<LeafletEventHandlerFnMap | undefined>(
    () =>
      isPressable
        ? {
            click(event) {
              event.originalEvent?.stopPropagation?.();
              onPressRef.current?.();
            },
          }
        : undefined,
    [isPressable]
  );
  const position = useMemo<[number, number]>(
    () => [markerLatitude, markerLongitude],
    [markerLatitude, markerLongitude]
  );

  useEffect(() => {
    if (!perfDebugEnabled) {
      return undefined;
    }

    webMapPerfDebugState.markerMounts += 1;
    return () => {
      webMapPerfDebugState.markerUnmounts += 1;
    };
  }, [perfDebugEnabled]);

  useEffect(() => {
    const markerElement = markerRef.current?.getElement();
    if (!markerElement) {
      return;
    }

    if (accessibilityLabel) {
      markerElement.setAttribute('aria-label', accessibilityLabel);
    } else {
      markerElement.removeAttribute('aria-label');
    }

    if (isPressable) {
      markerElement.setAttribute('role', 'button');
    } else {
      markerElement.removeAttribute('role');
    }
  }, [accessibilityLabel, isPressable]);

  const imageSource = resolveImageSource(image);
  const imageUri = imageSource?.uri ?? null;
  const isDecorativeOverlayMarker = Boolean(children) && !imageUri && !pinColor && !onPress;
  if (isDecorativeOverlayMarker) {
    return null;
  }

  const markerLabel = imageUri ? null : extractMarkerLabel(children);
  const shouldUseCompactMarker = Boolean(children) && !imageUri && !markerLabel;
  const derivedColor =
    pinColor ?? (typeof zIndex === 'number' && zIndex <= 14 ? '#2f7dd7' : '#2e6b4b');
  const icon = createIcon({
    anchor,
    color: derivedColor,
    imageSize: imageSource,
    imageUri,
    label: markerLabel,
    size: shouldUseCompactMarker ? WEB_MARKER_SIZE_COMPACT : WEB_MARKER_SIZE,
  });

  if (perfDebugEnabled) {
    webMapPerfDebugState.markerRenders += 1;
  }

  return (
    <LeafletMarker
      alt={accessibilityLabel}
      eventHandlers={markerEventHandlers}
      icon={icon}
      position={position}
      ref={markerRef}
      title={accessibilityLabel}
      zIndexOffset={typeof zIndex === 'number' ? zIndex : 0}
    />
  );
}

function Polyline(props: PolylineProps) {
  const { coordinates, strokeColor = '#2e6b4b', strokeWidth = 3 } = props;
  if (coordinates.length === 0) {
    return null;
  }

  return (
    <LeafletPolyline
      pathOptions={{ color: strokeColor, weight: strokeWidth }}
      positions={coordinates.map((coordinate) => coordinateToTuple(coordinate))}
    />
  );
}

export default MapView;
export { Marker, Polyline };
