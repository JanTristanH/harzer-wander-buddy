import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapSelectionSheet } from '@/components/map-selection-sheet';
import MapView, { Marker, type MapViewRef, type Region } from '@/components/maps/map-primitives';
import { StampingSuccessToast } from '@/components/stamping-success-toast';
import {
  createStamping,
  fetchRouteMetrics,
  fetchStampDetail,
  searchPlacesByName,
  type LatestVisitedStamp,
  type MapData,
  type MapParkingSpot,
  type MapStamp,
  type PlaceSearchResult,
  type ProfileOverviewData,
  type RouteMetrics,
  type Stampbox,
  type StampDetailData,
  type VisitStamping,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useConnectivity } from '@/lib/connectivity';
import { getPreGeneratedMapMarkerImageSource } from '@/lib/map-marker-images.generated';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { replaceTimelineEntry, upsertTimelineEntry } from '@/lib/profile-timeline';
import { queryKeys, useMapDataQuery } from '@/lib/queries';
import { getMapSheetBottomOffset } from '@/lib/tab-bar-layout';

type VisitFilter = 'all' | 'visited' | 'open';
type MarkerKind = MapStamp['kind'] | MapParkingSpot['kind'];

type Coordinate = {
  latitude: number;
  longitude: number;
};

type LocationState = 'idle' | 'loading' | 'granted' | 'denied';
type SelectionSheetMode = 'expanded' | 'compact';
type AuthClaims = {
  sub?: string;
};

type StampsOverviewData = {
  stamps: Stampbox[];
  lastVisited: LatestVisitedStamp | null;
};

type BaseMarkerItem = {
  id: string;
  kind: MarkerKind;
  coordinate: Coordinate;
  title: string;
  description?: string;
  imageUrl?: string;
};

type StampMarkerItem = BaseMarkerItem & {
  kind: MapStamp['kind'];
  number?: string;
  stampId: string;
  visitedAt?: string;
};

type ParkingMarkerItem = BaseMarkerItem & {
  kind: 'parking';
  parkingId: string;
};

type MarkerItem = StampMarkerItem | ParkingMarkerItem;

type NearestCounterpart = {
  kind: 'parking' | 'stamp';
  title: string;
  fromPoiId: string;
  toPoiId: string;
  distanceKm: number;
};

type ClusterMarkerItem = {
  id: string;
  kind: 'cluster';
  clusterKind: MarkerKind;
  count: number;
  coordinate: Coordinate;
  members: MarkerItem[];
};

const HARZ_REGION: Region = {
  latitude: 51.7544,
  longitude: 10.6182,
  latitudeDelta: 0.42,
  longitudeDelta: 0.42,
};

const CLUSTER_MIN_LONGITUDE_DELTA = 0.16;
const CLUSTER_EXPANDED_LONGITUDE_DELTA = 0.08;
const PARKING_HIDE_LONGITUDE_DELTA = 0.18;
const MIN_ZOOM_DELTA = 0.0018;
const MAX_ZOOM_DELTA = 1.2;
const CAMERA_MIN_ZOOM = 2;
const CAMERA_MAX_ZOOM = 19;
const MAP_EDGE_PADDING = { top: 140, right: 64, bottom: 260, left: 64 };
const ZOOM_CONTROLS_GAP = 16;
const SEARCH_RESULT_LIMIT = 6;
const REMOTE_SEARCH_DEBOUNCE_MS = 350;
const REMOTE_PLACE_SEARCH_MIN_QUERY_LENGTH = 4;
const SEARCH_TARGET_DELTA = 0.02;
const SELECTION_TARGET_DELTA = 0.08;
const LOCATE_ME_TARGET_DELTA = 0.05;
const SELECTION_TARGET_VERTICAL_RATIO = 0.3;
const SINGLE_POINT_FOCUS_OFFSET_RATIO = 0.15;
const NORTH_HEADING_EPSILON = 2;
const PROGRAMMATIC_SELECTION_MOVE_SUPPRESS_MS = 420;
const MARKER_ANCHOR = { x: 0.5, y: 1 };
const MARKER_Z_INDEX_PARKING = 10;
const MARKER_Z_INDEX_STAMP = 20;
const DIGITS_ONLY_PATTERN = /^\d+$/;
const STAMP_MARKER_TOKEN_PATTERN = /\b(?:[A-Za-z]{1,3}\d{1,4}|\d{1,4}[A-Za-z]{1,3}|\d{1,4}|[A-Za-z]{1,3})\b/g;

let lastMapRegion: Region | null = null;

const VISIT_FILTERS: { key: VisitFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'visited', label: 'Besucht' },
  { key: 'open', label: 'Unbesucht' },
];

function toFiniteCoordinateNumber(value?: number | string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractCoordinate(value?: { latitude?: number | string; longitude?: number | string }): Coordinate | null {
  const latitude = toFiniteCoordinateNumber(value?.latitude);
  const longitude = toFiniteCoordinateNumber(value?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function formatVisitDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getProfileTimelineEntries(profile: ProfileOverviewData) {
  const profileWithTimeline = profile as ProfileOverviewData & { stampings?: ProfileOverviewData['latestVisits'] };
  return Array.isArray(profileWithTimeline.stampings)
    ? profileWithTimeline.stampings
    : profile.latestVisits;
}

function markerColors(kind: MarkerKind) {
  if (kind === 'visited-stamp') {
    return {
      fill: '#2e6b4b',
      shadow: 'rgba(20,30,20,0.22)',
      text: '#f5f3ee',
      badgeFill: '#deebe2',
      badgeText: '#2e6b4b',
    };
  }

  if (kind === 'open-stamp') {
    return {
      fill: '#c1a093',
      shadow: 'rgba(20,30,20,0.18)',
      text: '#f5f3ee',
      badgeFill: '#f0e7e0',
      badgeText: '#7d5f52',
    };
  }

  return {
    fill: '#2f7dd7',
    shadow: 'rgba(24,57,99,0.18)',
    text: '#f5f3ee',
    badgeFill: '#e3effc',
    badgeText: '#2f7dd7',
  };
}

function markerZIndex(kind: MarkerKind) {
  return kind === 'parking' ? MARKER_Z_INDEX_PARKING : MARKER_Z_INDEX_STAMP;
}

function clampDelta(value: number) {
  return Math.min(MAX_ZOOM_DELTA, Math.max(MIN_ZOOM_DELTA, value));
}

function normalizeHeading(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function createSinglePointRegion(coordinate: Coordinate, longitudeDelta: number): Region {
  const clampedLongitudeDelta = clampDelta(longitudeDelta);
  const latitudeDelta = clampDelta(clampedLongitudeDelta);

  return {
    latitude: coordinate.latitude - latitudeDelta * SINGLE_POINT_FOCUS_OFFSET_RATIO,
    longitude: coordinate.longitude,
    latitudeDelta,
    longitudeDelta: clampedLongitudeDelta,
  };
}

function createPointRegionAtVerticalRatio(
  coordinate: Coordinate,
  longitudeDelta: number,
  verticalRatio: number
): Region {
  const clampedLongitudeDelta = clampDelta(longitudeDelta);
  const latitudeDelta = clampDelta(clampedLongitudeDelta);
  const centerOffsetRatio = verticalRatio - 0.5;

  return {
    latitude: coordinate.latitude + latitudeDelta * centerOffsetRatio,
    longitude: coordinate.longitude,
    latitudeDelta,
    longitudeDelta: clampedLongitudeDelta,
  };
}

function createClusterMarkers(items: StampMarkerItem[], region: Region, clusteringEnabled: boolean) {
  const shouldCluster =
    clusteringEnabled &&
    region.longitudeDelta >= CLUSTER_MIN_LONGITUDE_DELTA &&
    region.longitudeDelta > CLUSTER_EXPANDED_LONGITUDE_DELTA;

  if (!shouldCluster) {
    return items;
  }

  const latitudeBucketSize = Math.max(region.latitudeDelta / 6, 0.015);
  const longitudeBucketSize = Math.max(region.longitudeDelta / 6, 0.015);
  const buckets = new Map<string, MarkerItem[]>();

  for (const item of items) {
    const latBucket = Math.floor(item.coordinate.latitude / latitudeBucketSize);
    const lngBucket = Math.floor(item.coordinate.longitude / longitudeBucketSize);
    const key = `${item.kind}:${latBucket}:${lngBucket}`;
    const currentBucket = buckets.get(key);

    if (currentBucket) {
      currentBucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }

  return Array.from(buckets.entries()).map(([key, members]) => {
    if (members.length === 1) {
      return members[0];
    }

    const coordinate = members.reduce(
      (accumulator, member) => ({
        latitude: accumulator.latitude + member.coordinate.latitude / members.length,
        longitude: accumulator.longitude + member.coordinate.longitude / members.length,
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      id: `cluster:${key}`,
      kind: 'cluster' as const,
      clusterKind: members[0].kind,
      count: members.length,
      coordinate,
      members,
    };
  });
}

function haversineDistanceKm(from: Coordinate, to: Coordinate) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number) {
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function formatDuration(durationMinutes: number | null) {
  if (durationMinutes === null) {
    return '';
  }

  return `${durationMinutes} Min`;
}

function formatElevationSummary(elevationGainMeters: number | null, elevationLossMeters: number | null) {
  const parts: string[] = [];

  if (typeof elevationGainMeters === 'number' && Number.isFinite(elevationGainMeters)) {
    parts.push(`↑${Math.round(Math.abs(elevationGainMeters))} m`);
  }

  if (typeof elevationLossMeters === 'number' && Number.isFinite(elevationLossMeters)) {
    parts.push(`↓${Math.round(Math.abs(elevationLossMeters))} m`);
  }

  return parts.length > 0 ? ` • ${parts.join(' ')}` : '';
}

function estimateDurationMinutes(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return null;
  }

  return Math.max(1, Math.round((distanceKm / 4) * 60));
}

function createOfflineRouteMetrics(distanceKm: number | null) {
  return {
    distanceKm,
    durationMinutes: estimateDurationMinutes(distanceKm),
    elevationGainMeters: null,
    elevationLossMeters: null,
  } satisfies RouteMetrics;
}

function zoomRegion(region: Region, factor: number) {
  return {
    ...region,
    latitudeDelta: clampDelta(region.latitudeDelta * factor),
    longitudeDelta: clampDelta(region.longitudeDelta * factor),
  };
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function shouldSkipRemotePlaceSearch(normalizedQuery: string) {
  return /^\d{1,3}$/.test(normalizedQuery);
}

function normalizeStampMarkerToken(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  if (upper === '--' || upper === 'P' || upper === 'POI') {
    return null;
  }

  if (/^\d{1,4}$/.test(upper)) {
    const parsed = Number.parseInt(upper, 10);
    return Number.isFinite(parsed) ? String(parsed) : null;
  }

  if (/^[A-Z]{1,3}$/.test(upper)) {
    return upper;
  }

  if (/^[A-Z]{1,3}\d{1,4}$/.test(upper) || /^\d{1,4}[A-Z]{1,3}$/.test(upper)) {
    return upper;
  }

  const matches = upper.match(STAMP_MARKER_TOKEN_PATTERN);
  if (!matches || matches.length === 0) {
    return null;
  }

  for (const token of matches) {
    const normalized = normalizeStampMarkerToken(token);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

type SearchResultRank = {
  matchTier: number;
  matchIndex: number;
  numberDelta: number;
  titleLength: number;
};

function rankSearchResult(item: MarkerItem, normalizedQuery: string): SearchResultRank | null {
  const normalizedTitle = normalizeSearchValue(item.title);
  const normalizedDescription = normalizeSearchValue(item.description || '');
  const titleIndex = normalizedTitle.indexOf(normalizedQuery);
  const descriptionIndex = normalizedDescription.indexOf(normalizedQuery);

  if (titleIndex < 0 && descriptionIndex < 0) {
    return null;
  }

  const normalizedNumber =
    item.kind === 'parking' ? '' : normalizeSearchValue(item.number || '');
  const hasNumericQuery = DIGITS_ONLY_PATTERN.test(normalizedQuery);
  const hasNumericNumber =
    normalizedNumber.length > 0 && DIGITS_ONLY_PATTERN.test(normalizedNumber);
  const queryValue = hasNumericQuery ? Number.parseInt(normalizedQuery, 10) : Number.NaN;
  const numberValue = hasNumericNumber ? Number.parseInt(normalizedNumber, 10) : Number.NaN;
  const numberDelta =
    Number.isFinite(queryValue) && Number.isFinite(numberValue)
      ? Math.abs(numberValue - queryValue)
      : Number.MAX_SAFE_INTEGER;

  if (normalizedNumber && normalizedNumber === normalizedQuery) {
    return { matchTier: 0, matchIndex: 0, numberDelta, titleLength: normalizedTitle.length };
  }

  if (normalizedTitle === normalizedQuery) {
    return { matchTier: 1, matchIndex: 0, numberDelta, titleLength: normalizedTitle.length };
  }

  if (normalizedNumber && normalizedNumber.startsWith(normalizedQuery)) {
    return { matchTier: 2, matchIndex: 0, numberDelta, titleLength: normalizedTitle.length };
  }

  if (titleIndex === 0) {
    return { matchTier: 3, matchIndex: 0, numberDelta, titleLength: normalizedTitle.length };
  }

  if (titleIndex > 0) {
    // reject weak substring hits far inside the title
    if (normalizedQuery.length < 3) {
      return null;
    }

    return {
      matchTier: 4,
      matchIndex: titleIndex,
      numberDelta,
      titleLength: normalizedTitle.length,
    };
  }

  // optionally reject description-only matches completely
  return null;
}

export default function MapScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    stampId?: string | string[];
    parkingId?: string | string[];
  }>();
  const { accessToken, canPerformWrites, logout } = useAuth();
  const { isOnline } = useConnectivity();
  const claims = useIdTokenClaims<AuthClaims>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const mapRef = useRef<MapViewRef | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const requestedStampId = Array.isArray(params.stampId) ? params.stampId[0] : params.stampId;
  const requestedParkingId = Array.isArray(params.parkingId) ? params.parkingId[0] : params.parkingId;
  const initialRegion = lastMapRegion ?? HARZ_REGION;
  const regionRef = useRef<Region>(initialRegion);
  const hasFittedInitialRegion = useRef(lastMapRegion !== null);
  const lastMarkerPressAtRef = useRef(0);
  const handledRequestedStampIdRef = useRef<string | null>(null);
  const handledRequestedParkingIdRef = useRef<string | null>(null);
  const searchBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data, error, isFetching, isPending, isPlaceholderData } = useMapDataQuery();
  const [region, setRegion] = useState<Region>(initialRegion);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedExternalPlace, setSelectedExternalPlace] = useState<PlaceSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [remoteSearchResults, setRemoteSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isRemoteSearchLoading, setIsRemoteSearchLoading] = useState(false);
  const [remoteSearchError, setRemoteSearchError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [showStamps, setShowStamps] = useState(true);
  const [showParking, setShowParking] = useState(true);
  const [clusteringEnabled] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isStamping, setIsStamping] = useState(false);
  const [isStampSuccessToastVisible, setIsStampSuccessToastVisible] = useState(false);
  const [isParkingRevealPending, setIsParkingRevealPending] = useState(false);
  const [selectedSheetHeight, setSelectedSheetHeight] = useState(0);
  const [selectionSheetMode, setSelectionSheetMode] = useState<SelectionSheetMode>('expanded');
  const [mapHeading, setMapHeading] = useState(0);
  const [nearestRouteMetrics, setNearestRouteMetrics] = useState<RouteMetrics | null>(null);
  const suppressSheetCompactUntilRef = useRef(0);
  const showStartupLoading = (isPending && !data) || isPlaceholderData;
  const isMapNorthUp = Math.abs(normalizeHeading(mapHeading)) <= NORTH_HEADING_EPSILON;

  const updateMapRegion = useCallback((nextRegion: Region) => {
    regionRef.current = nextRegion;
    setRegion(nextRegion);
    lastMapRegion = nextRegion;
  }, []);
  const suppressSelectionSheetCompactionForSelectionMove = useCallback((durationMs = PROGRAMMATIC_SELECTION_MOVE_SUPPRESS_MS) => {
    suppressSheetCompactUntilRef.current = Date.now() + durationMs;
  }, []);

  const fitCoordinates = useCallback((coordinates: Coordinate[]) => {
    if (!mapRef.current || coordinates.length === 0) {
      return;
    }

    if (coordinates.length === 1) {
      const [coordinate] = coordinates;
      const nextRegion = createSinglePointRegion(coordinate, 0.08);
      updateMapRegion(nextRegion);
      mapRef.current.animateToRegion(nextRegion, 250);
      return;
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: MAP_EDGE_PADDING,
      animated: true,
    });
  }, [updateMapRegion]);

  const stampItems = useMemo<StampMarkerItem[]>(() => {
    if (!data) {
      return [];
    }

    return data.stamps
      .map((stamp) => {
        const coordinate = extractCoordinate(stamp);
        if (!coordinate) {
          return null;
        }

        return {
          id: `stamp:${stamp.ID}`,
          kind: stamp.kind,
          coordinate,
          title: `${stamp.number || '--'} • ${stamp.name}`,
          description: stamp.description?.trim() || undefined,
          imageUrl: stamp.heroImageUrl?.trim() || stamp.image?.trim() || undefined,
          number: stamp.number,
          stampId: stamp.ID,
          visitedAt: stamp.visitedAt,
        } satisfies StampMarkerItem;
      })
      .filter((item): item is StampMarkerItem => item !== null);
  }, [data]);

  const parkingItems = useMemo<ParkingMarkerItem[]>(() => {
    if (!data) {
      return [];
    }

    return data.parkingSpots
      .map((parkingSpot) => {
        const coordinate = extractCoordinate(parkingSpot);
        if (!coordinate) {
          return null;
        }

        return {
          id: `parking:${parkingSpot.ID}`,
          kind: 'parking',
          coordinate,
          title: parkingSpot.name?.trim() || 'Parkplatz',
          description: parkingSpot.description?.trim() || undefined,
          parkingId: parkingSpot.ID,
        } satisfies ParkingMarkerItem;
      })
      .filter((item): item is ParkingMarkerItem => item !== null);
  }, [data]);

  const visibleStampItems = useMemo(() => {
    return stampItems.filter((item) => {
      if (!showStamps) {
        return false;
      }

      if (visitFilter === 'visited') {
        return item.kind === 'visited-stamp';
      }

      if (visitFilter === 'open') {
        return item.kind === 'open-stamp';
      }

      return true;
    });
  }, [showStamps, stampItems, visitFilter]);

  const visibleParkingItems = useMemo(() => {
    if (!showParking) {
      return [];
    }

    if (isParkingRevealPending) {
      return [];
    }

    if (region.longitudeDelta >= PARKING_HIDE_LONGITUDE_DELTA) {
      return [];
    }

    return parkingItems;
  }, [isParkingRevealPending, parkingItems, region.longitudeDelta, showParking]);

  const visibleItems = useMemo<MarkerItem[]>(
    () => [...visibleStampItems, ...visibleParkingItems],
    [visibleParkingItems, visibleStampItems]
  );

  const renderedStampMarkers = useMemo(
    () => createClusterMarkers(visibleStampItems, region, clusteringEnabled && Platform.OS !== 'web'),
    [clusteringEnabled, region, visibleStampItems]
  );

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, visibleItems]
  );

  useEffect(() => {
    return () => {
      if (searchBlurTimeoutRef.current) {
        clearTimeout(searchBlurTimeoutRef.current);
        searchBlurTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (!isMounted) {
          return;
        }

        if (!permission.granted) {
          setLocationState(permission.status === 'denied' ? 'denied' : 'idle');
          return;
        }

        setLocationState('loading');
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) {
          return;
        }

        setUserLocation({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        });
        setLocationState('granted');
      } catch {
        if (!isMounted) {
          return;
        }

        setLocationState('denied');
      }
    }

    void loadLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    const itemStillVisible = visibleItems.some((item) => item.id === selectedItemId);
    if (!itemStillVisible) {
      setSelectedItemId(null);
    }
  }, [selectedItemId, visibleItems]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectionSheetMode('expanded');
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!isMapReady || !data || hasFittedInitialRegion.current) {
      return;
    }

    const coordinates = [...stampItems, ...parkingItems].map((item) => item.coordinate);
    if (coordinates.length > 0) {
      fitCoordinates(coordinates);
      hasFittedInitialRegion.current = true;
    }
  }, [data, fitCoordinates, isMapReady, parkingItems, stampItems]);

  const localSearchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) {
      return [];
    }

    return visibleItems
      .map((item, originalIndex) => {
        const rank = rankSearchResult(item, normalizedQuery);
        if (!rank) {
          return null;
        }

        return { item, originalIndex, rank };
      })
      .filter((entry): entry is { item: MarkerItem; originalIndex: number; rank: SearchResultRank } => entry !== null)
      .sort((left, right) => {
        if (left.rank.matchTier !== right.rank.matchTier) {
          return left.rank.matchTier - right.rank.matchTier;
        }

        if (left.rank.matchIndex !== right.rank.matchIndex) {
          return left.rank.matchIndex - right.rank.matchIndex;
        }

        if (left.rank.numberDelta !== right.rank.numberDelta) {
          return left.rank.numberDelta - right.rank.numberDelta;
        }

        if (left.rank.titleLength !== right.rank.titleLength) {
          return left.rank.titleLength - right.rank.titleLength;
        }

        return left.originalIndex - right.originalIndex;
      })
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((entry) => entry.item);
  }, [searchQuery, visibleItems]);

  useEffect(() => {
    if (!isSearchFocused) {
      setRemoteSearchResults([]);
      setIsRemoteSearchLoading(false);
      setRemoteSearchError(null);
      return;
    }

    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (
      !isOnline ||
      normalizedQuery.length < REMOTE_PLACE_SEARCH_MIN_QUERY_LENGTH ||
      !accessToken ||
      shouldSkipRemotePlaceSearch(normalizedQuery)
    ) {
      setRemoteSearchResults([]);
      setIsRemoteSearchLoading(false);
      setRemoteSearchError(null);
      return;
    }

    let isCancelled = false;
    setIsRemoteSearchLoading(true);
    setRemoteSearchError(null);

    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const nextResults = await searchPlacesByName(accessToken, {
            query: searchQuery,
            latitude: regionRef.current.latitude,
            longitude: regionRef.current.longitude,
            limit: SEARCH_RESULT_LIMIT,
          });

          if (isCancelled) {
            return;
          }

          setRemoteSearchResults(nextResults);
          setRemoteSearchError(null);
        } catch (nextError) {
          if (isCancelled) {
            return;
          }

          if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
            await logout();
            return;
          }

          setRemoteSearchResults([]);
          setRemoteSearchError('Orte konnten nicht geladen werden.');
        } finally {
          if (!isCancelled) {
            setIsRemoteSearchLoading(false);
          }
        }
      })();
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [accessToken, isOnline, isSearchFocused, logout, searchQuery]);

  const nearestCounterpart = useMemo<NearestCounterpart | null>(() => {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.kind === 'parking') {
      if (stampItems.length === 0) {
        return null;
      }

      let nearestStamp: StampMarkerItem | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const stampItem of stampItems) {
        const distanceKm = haversineDistanceKm(selectedItem.coordinate, stampItem.coordinate);
        if (distanceKm < nearestDistance) {
          nearestDistance = distanceKm;
          nearestStamp = stampItem;
        }
      }

      if (!nearestStamp || !Number.isFinite(nearestDistance)) {
        return null;
      }

      return {
        kind: 'stamp',
        title: nearestStamp.title,
        fromPoiId: selectedItem.parkingId,
        toPoiId: nearestStamp.stampId,
        distanceKm: nearestDistance,
      };
    }

    if (parkingItems.length === 0) {
      return null;
    }

    let nearestParking: ParkingMarkerItem | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const parkingItem of parkingItems) {
      const distanceKm = haversineDistanceKm(selectedItem.coordinate, parkingItem.coordinate);
      if (distanceKm < nearestDistance) {
        nearestDistance = distanceKm;
        nearestParking = parkingItem;
      }
    }

    if (!nearestParking || !Number.isFinite(nearestDistance)) {
      return null;
    }

    return {
      kind: 'parking',
      title: nearestParking.title,
      fromPoiId: selectedItem.stampId,
      toPoiId: nearestParking.parkingId,
      distanceKm: nearestDistance,
    };
  }, [parkingItems, selectedItem, stampItems]);

  useEffect(() => {
    let isMounted = true;
    setNearestRouteMetrics(null);

    if (!selectedItem || !nearestCounterpart) {
      return () => {
        isMounted = false;
      };
    }

    if (!isOnline || !accessToken) {
      setNearestRouteMetrics(createOfflineRouteMetrics(nearestCounterpart.distanceKm));
      return () => {
        isMounted = false;
      };
    }

    const authToken: string = accessToken;
    const counterpart: NearestCounterpart = nearestCounterpart;

    async function loadNearestRouteMetrics() {
      try {
        const metrics = await fetchRouteMetrics(
          authToken,
          counterpart.fromPoiId,
          counterpart.toPoiId,
          counterpart.distanceKm
        );

        if (!isMounted) {
          return;
        }

        setNearestRouteMetrics(metrics);
      } catch {
        if (!isMounted) {
          return;
        }

        setNearestRouteMetrics(createOfflineRouteMetrics(counterpart.distanceKm));
      }
    }

    void loadNearestRouteMetrics();

    return () => {
      isMounted = false;
    };
  }, [accessToken, isOnline, nearestCounterpart, selectedItem]);

  const nearestCounterpartMeta = useMemo(() => {
    if (!nearestCounterpart) {
      return null;
    }

    const distanceKm = nearestRouteMetrics?.distanceKm ?? nearestCounterpart.distanceKm;
    const elevationGainMeters = nearestRouteMetrics?.elevationGainMeters ?? null;
    const elevationLossMeters = nearestRouteMetrics?.elevationLossMeters ?? null;
    const durationText =
      nearestRouteMetrics?.durationMinutes !== null && nearestRouteMetrics?.durationMinutes !== undefined
        ? ` • ${formatDuration(nearestRouteMetrics.durationMinutes)}`
        : '';

    if (nearestCounterpart.kind === 'parking') {
      const hmParts: string[] = [];
      if (typeof elevationGainMeters === 'number' && Number.isFinite(elevationGainMeters)) {
        hmParts.push(`↑${Math.round(Math.abs(elevationGainMeters))} m`);
      }
      if (typeof elevationLossMeters === 'number' && Number.isFinite(elevationLossMeters)) {
        hmParts.push(`↓${Math.round(Math.abs(elevationLossMeters))} m`);
      }

      const distanceAndHm =
        hmParts.length > 0 ? `${formatDistance(distanceKm)} • ${hmParts.join(' ')}` : formatDistance(distanceKm);
      return `Parken: ${distanceAndHm} • ${nearestCounterpart.title}`;
    }

    const infoText = `${formatDistance(distanceKm)}${durationText}${formatElevationSummary(
      elevationGainMeters,
      elevationLossMeters
    )}`;
    return `Stempel: ${nearestCounterpart.title} • ${infoText}`;
  }, [nearestCounterpart, nearestRouteMetrics]);

  const sheetBottomOffset = getMapSheetBottomOffset(insets.bottom);
  const externalSheetHeight = selectedExternalPlace ? 136 : 0;
  const zoomControlsBottomOffset =
    sheetBottomOffset +
    (selectedItem
      ? selectedSheetHeight + ZOOM_CONTROLS_GAP
      : externalSheetHeight > 0
        ? externalSheetHeight + ZOOM_CONTROLS_GAP
        : ZOOM_CONTROLS_GAP);
  const filterPopoverWidth = useMemo(() => Math.min(300, Math.max(windowWidth - 32, 0)), [windowWidth]);
  const compassButtonTopOffset = insets.top + 64;

  const syncMapHeading = useCallback(async () => {
    if (!mapRef.current) {
      return;
    }

    try {
      const camera = await mapRef.current.getCamera();
      setMapHeading(camera.heading);
    } catch {
      // Ignore native map camera read errors.
    }
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      void (async () => {
        try {
          const camera = await map.getCamera();
          if (typeof camera.zoom === 'number' && Number.isFinite(camera.zoom)) {
            const zoomDelta = -Math.log2(Math.max(0.000001, factor));
            const nextZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, camera.zoom + zoomDelta));
            map.animateCamera(
              {
                center: camera.center,
                zoom: nextZoom,
              },
              { duration: 180 }
            );
            return;
          }
        } catch {
          // Fall back to region animation when camera zoom is unavailable.
        }

        const nextRegion = zoomRegion(regionRef.current, factor);
        updateMapRegion(nextRegion);
        map.animateToRegion(nextRegion, 180);
      })();
    },
    [updateMapRegion]
  );

  const handleClusterPress = useCallback(
    (cluster: ClusterMarkerItem) => {
      lastMarkerPressAtRef.current = Date.now();
      fitCoordinates(cluster.members.map((member) => member.coordinate));
    },
    [fitCoordinates]
  );

  const handleMarkerPress = useCallback(
    (item: MarkerItem) => {
      lastMarkerPressAtRef.current = Date.now();
      setSelectedExternalPlace(null);
      const isSameSelectedItem = selectedItemId === item.id;
      if (!isSameSelectedItem) {
        setSelectionSheetMode('expanded');
      }
      setSelectedItemId(item.id);
      const targetDelta = Math.min(regionRef.current.longitudeDelta, SELECTION_TARGET_DELTA);
      const shouldDelayParkingReveal =
        item.kind !== 'parking' &&
        regionRef.current.longitudeDelta >= PARKING_HIDE_LONGITUDE_DELTA &&
        targetDelta < PARKING_HIDE_LONGITUDE_DELTA;
      setIsParkingRevealPending(shouldDelayParkingReveal);
      suppressSelectionSheetCompactionForSelectionMove();
      const nextRegion = createPointRegionAtVerticalRatio(
        item.coordinate,
        targetDelta,
        SELECTION_TARGET_VERTICAL_RATIO
      );
      updateMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
    },
    [selectedItemId, suppressSelectionSheetCompactionForSelectionMove, updateMapRegion]
  );

  const handleLocateMePress = useCallback(() => {
    if (!userLocation) {
      return;
    }

    const targetDelta = Math.min(regionRef.current.longitudeDelta, LOCATE_ME_TARGET_DELTA);
    const nextRegion = createSinglePointRegion(userLocation, targetDelta);
    updateMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 260);
  }, [updateMapRegion, userLocation]);

  const handleStampVisit = useCallback(async () => {
    if (!accessToken || !selectedItem || selectedItem.kind === 'parking' || isStamping) {
      return;
    }

    if (selectedItem.kind === 'visited-stamp') {
      return;
    }

    const stampId = selectedItem.stampId;
    const nowIsoTimestamp = new Date().toISOString();
    const optimisticVisitId = `optimistic-${stampId}-${Date.now()}`;
    const stampSnapshot =
      data?.stamps.find((stamp) => stamp.ID === stampId) ?? null;
    const optimisticVisit: VisitStamping = {
      ID: optimisticVisitId,
      stamp_ID: stampId,
      stamp: {
        ID: stampId,
        number: stampSnapshot?.number || '--',
        name: stampSnapshot?.name || selectedItem.title,
      },
      visitedAt: nowIsoTimestamp,
      createdAt: nowIsoTimestamp,
    };
    const mapDataKey = queryKeys.mapData(claims?.sub);
    const stampsOverviewKey = queryKeys.stampsOverview(claims?.sub);
    const profileOverviewKey = queryKeys.profileOverview(claims?.sub);
    const stampDetailKey = queryKeys.stampDetail(claims?.sub, stampId);
    const optimisticLastVisited: LatestVisitedStamp = {
      stampId,
      stampNumber: stampSnapshot?.number,
      stampName: stampSnapshot?.name || selectedItem.title,
      visitedAt: nowIsoTimestamp,
    };
    let rollbackOptimisticUpdates = () => undefined;

    try {
      requireOnlineForWrite(canPerformWrites);
      setIsStamping(true);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: mapDataKey }),
        queryClient.cancelQueries({ queryKey: stampsOverviewKey }),
        queryClient.cancelQueries({ queryKey: profileOverviewKey }),
        queryClient.cancelQueries({ queryKey: stampDetailKey }),
      ]);

      const previousMapData = queryClient.getQueryData<MapData>(mapDataKey);
      const previousStampsOverview = queryClient.getQueryData<StampsOverviewData>(stampsOverviewKey);
      const previousProfileOverview = queryClient.getQueryData<ProfileOverviewData>(profileOverviewKey);
      const previousStampDetail = queryClient.getQueryData<StampDetailData>(stampDetailKey);

      const rollbackQueryData = <T,>(queryKey: readonly unknown[], previousValue: T | undefined) => {
        if (previousValue === undefined) {
          queryClient.removeQueries({ queryKey, exact: true });
          return;
        }

        queryClient.setQueryData<T>(queryKey, previousValue);
      };

      rollbackOptimisticUpdates = () => {
        rollbackQueryData(mapDataKey, previousMapData);
        rollbackQueryData(stampsOverviewKey, previousStampsOverview);
        rollbackQueryData(profileOverviewKey, previousProfileOverview);
        rollbackQueryData(stampDetailKey, previousStampDetail);
      };

      queryClient.setQueryData<MapData>(mapDataKey, (currentMapData) => {
        if (!currentMapData) {
          return currentMapData;
        }

        let hasUpdatedStamp = false;
        const nextStamps = currentMapData.stamps.map((stamp) => {
          if (stamp.ID !== stampId) {
            return stamp;
          }

          hasUpdatedStamp = true;
          return {
            ...stamp,
            hasVisited: true,
            visitedAt: nowIsoTimestamp,
            kind: 'visited-stamp' as const,
          };
        });

        if (!hasUpdatedStamp) {
          return currentMapData;
        }

        return {
          ...currentMapData,
          stamps: nextStamps,
        };
      });

      queryClient.setQueryData<StampsOverviewData>(stampsOverviewKey, (currentStampsOverview) => {
        if (!currentStampsOverview) {
          return currentStampsOverview;
        }

        let hasUpdatedStamp = false;
        const nextStamps = currentStampsOverview.stamps.map((stamp) => {
          if (stamp.ID !== stampId) {
            return stamp;
          }

          hasUpdatedStamp = true;
          return {
            ...stamp,
            hasVisited: true,
          };
        });

        if (!hasUpdatedStamp) {
          return currentStampsOverview;
        }

        return {
          ...currentStampsOverview,
          stamps: nextStamps,
          lastVisited: optimisticLastVisited,
        };
      });

      queryClient.setQueryData<ProfileOverviewData>(profileOverviewKey, (currentProfileOverview) => {
        if (!currentProfileOverview) {
          return currentProfileOverview;
        }

        const stampBeforeUpdate = currentProfileOverview.stamps.find((stamp) => stamp.ID === stampId);
        const wasVisited = Boolean(stampBeforeUpdate?.hasVisited);
        let hasUpdatedStamp = false;
        const nextStamps = currentProfileOverview.stamps.map((stamp) => {
          if (stamp.ID !== stampId) {
            return stamp;
          }

          hasUpdatedStamp = true;
          return {
            ...stamp,
            hasVisited: true,
          };
        });

        const nextVisitedCount = !wasVisited && hasUpdatedStamp
          ? Math.min(currentProfileOverview.totalCount, currentProfileOverview.visitedCount + 1)
          : currentProfileOverview.visitedCount;
        const nextOpenCount = Math.max(0, currentProfileOverview.totalCount - nextVisitedCount);
        const nextCompletionPercent =
          currentProfileOverview.totalCount > 0
            ? Math.round((nextVisitedCount / currentProfileOverview.totalCount) * 100)
            : 0;
        const nextLatestVisit = {
          id: optimisticVisitId,
          stampId,
          stampNumber: stampSnapshot?.number,
          stampName: stampSnapshot?.name || selectedItem.title,
          visitedAt: nowIsoTimestamp,
          heroImageUrl: stampSnapshot?.heroImageUrl || stampSnapshot?.image,
        };
        const nextStampings = upsertTimelineEntry(getProfileTimelineEntries(currentProfileOverview), nextLatestVisit);

        return {
          ...currentProfileOverview,
          visitedCount: nextVisitedCount,
          openCount: nextOpenCount,
          completionPercent: nextCompletionPercent,
          stamps: nextStamps,
          stampings: nextStampings,
          latestVisits: nextStampings.slice(0, 3),
        };
      });

      queryClient.setQueryData<StampDetailData>(stampDetailKey, (currentDetail) => {
        if (currentDetail) {
          const hasVisitAlready = currentDetail.myVisits.some((visit) => visit.ID === optimisticVisit.ID);
          return {
            ...currentDetail,
            stamp: {
              ...currentDetail.stamp,
              hasVisited: true,
              visitedAt: nowIsoTimestamp,
            },
            myVisits: hasVisitAlready ? currentDetail.myVisits : [optimisticVisit, ...currentDetail.myVisits],
          };
        }

        if (!stampSnapshot) {
          return currentDetail;
        }

        return {
          stamp: {
            ...stampSnapshot,
            hasVisited: true,
            visitedAt: nowIsoTimestamp,
          },
          nearbyStamps: [],
          nearbyParking: [],
          friendVisits: [],
          myVisits: [optimisticVisit],
          myNote: null,
        };
      });

      const createdStamping = await createStamping(accessToken, stampId);
      const persistedVisitTimestamp =
        createdStamping.visitedAt || createdStamping.createdAt || nowIsoTimestamp;
      const persistedVisit: VisitStamping = {
        ...createdStamping,
        stamp_ID: createdStamping.stamp_ID || stampId,
        stamp: createdStamping.stamp || optimisticVisit.stamp,
        visitedAt: createdStamping.visitedAt || persistedVisitTimestamp,
        createdAt: createdStamping.createdAt || persistedVisitTimestamp,
      };
      const persistedLastVisited: LatestVisitedStamp = {
        ...optimisticLastVisited,
        visitedAt: persistedVisit.visitedAt,
      };

      queryClient.setQueryData<MapData>(mapDataKey, (currentMapData) => {
        if (!currentMapData) {
          return currentMapData;
        }

        return {
          ...currentMapData,
          stamps: currentMapData.stamps.map((stamp) => {
            if (stamp.ID !== stampId) {
              return stamp;
            }

            return {
              ...stamp,
              hasVisited: true,
              visitedAt: persistedVisit.visitedAt,
              kind: 'visited-stamp' as const,
            };
          }),
        };
      });

      queryClient.setQueryData<StampsOverviewData>(stampsOverviewKey, (currentStampsOverview) => {
        if (!currentStampsOverview) {
          return currentStampsOverview;
        }

        return {
          ...currentStampsOverview,
          lastVisited: persistedLastVisited,
        };
      });

      queryClient.setQueryData<ProfileOverviewData>(profileOverviewKey, (currentProfileOverview) => {
        if (!currentProfileOverview) {
          return currentProfileOverview;
        }

        const nextStampings = replaceTimelineEntry(
          getProfileTimelineEntries(currentProfileOverview),
          optimisticVisitId,
          {
            id: persistedVisit.ID,
            stampId,
            stampNumber: stampSnapshot?.number,
            stampName: stampSnapshot?.name || selectedItem.title,
            visitedAt: persistedVisit.visitedAt,
            heroImageUrl: stampSnapshot?.heroImageUrl || stampSnapshot?.image,
          }
        );

        return {
          ...currentProfileOverview,
          stampings: nextStampings,
          latestVisits: nextStampings.slice(0, 3),
        };
      });

      queryClient.setQueryData<StampDetailData>(stampDetailKey, (currentDetail) => {
        if (currentDetail) {
          const visitsWithoutOptimistic = currentDetail.myVisits.filter(
            (visit) => visit.ID !== optimisticVisitId
          );
          const hasPersistedVisitAlready = visitsWithoutOptimistic.some(
            (visit) => visit.ID === persistedVisit.ID
          );
          const nextVisits = hasPersistedVisitAlready
            ? visitsWithoutOptimistic
            : [persistedVisit, ...visitsWithoutOptimistic];

          return {
            ...currentDetail,
            stamp: {
              ...currentDetail.stamp,
              hasVisited: true,
              visitedAt: persistedVisit.visitedAt,
            },
            myVisits: nextVisits,
          };
        }

        if (!stampSnapshot) {
          return currentDetail;
        }

        return {
          stamp: {
            ...stampSnapshot,
            hasVisited: true,
            visitedAt: persistedVisit.visitedAt,
          },
          nearbyStamps: [],
          nearbyParking: [],
          friendVisits: [],
          myVisits: [persistedVisit],
          myNote: null,
        };
      });

      await queryClient.invalidateQueries();
      queryClient.removeQueries({ type: 'inactive' });
      void queryClient
        .prefetchQuery({
          queryKey: stampDetailKey,
          queryFn: () => fetchStampDetail(accessToken, stampId, claims?.sub),
        })
        .catch(() => undefined);
      setIsStampSuccessToastVisible(true);
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      rollbackOptimisticUpdates();
      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      Alert.alert(
        'Stempeln fehlgeschlagen',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    } finally {
      setIsStamping(false);
    }
  }, [accessToken, canPerformWrites, claims?.sub, data?.stamps, isStamping, logout, queryClient, selectedItem]);

  const focusItemOnMap = useCallback((item: MarkerItem) => {
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    lastMarkerPressAtRef.current = Date.now();
    setSelectedExternalPlace(null);
    if (selectedItemId !== item.id) {
      setSelectionSheetMode('expanded');
    }
    setSelectedItemId(item.id);
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
    const shouldDelayParkingReveal =
      item.kind !== 'parking' &&
      regionRef.current.longitudeDelta >= PARKING_HIDE_LONGITUDE_DELTA &&
      SEARCH_TARGET_DELTA < PARKING_HIDE_LONGITUDE_DELTA;
    setIsParkingRevealPending(shouldDelayParkingReveal);

    const nextRegion = {
      ...createPointRegionAtVerticalRatio(
        item.coordinate,
        SEARCH_TARGET_DELTA,
        SELECTION_TARGET_VERTICAL_RATIO
      ),
    };

    suppressSelectionSheetCompactionForSelectionMove();
    updateMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 260);
  }, [selectedItemId, suppressSelectionSheetCompactionForSelectionMove, updateMapRegion]);

  const focusExternalPlaceOnMap = useCallback((place: PlaceSearchResult) => {
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    lastMarkerPressAtRef.current = Date.now();
    setSelectedItemId(null);
    setSelectedExternalPlace(place);
    setIsSearchFocused(false);
    setSearchQuery(place.name);
    searchInputRef.current?.blur();
    setIsParkingRevealPending(false);
    const nextRegion = createPointRegionAtVerticalRatio(
      { latitude: place.latitude, longitude: place.longitude },
      SEARCH_TARGET_DELTA,
      SELECTION_TARGET_VERTICAL_RATIO
    );
    updateMapRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 260);
  }, [updateMapRegion]);

  const handleOpenExternalPlaceInGoogleMaps = useCallback(async () => {
    if (!selectedExternalPlace) {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedExternalPlace.latitude},${selectedExternalPlace.longitude}`
    )}`;

    try {
      await Linking.openURL(url);
    } catch (nextError) {
      Alert.alert(
        'Google Maps konnte nicht geoeffnet werden',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    }
  }, [selectedExternalPlace]);

  const handleStartSelectedParkingNavigation = useCallback(async () => {
    if (!selectedItem || selectedItem.kind !== 'parking') {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${selectedItem.coordinate.latitude},${selectedItem.coordinate.longitude}`
    )}`;

    try {
      await Linking.openURL(url);
    } catch (nextError) {
      Alert.alert(
        'Google Maps konnte nicht geoeffnet werden',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!requestedStampId) {
      handledRequestedStampIdRef.current = null;
      return;
    }

    if (!isMapReady || handledRequestedStampIdRef.current === requestedStampId) {
      return;
    }

    const requestedItem = stampItems.find((item) => item.stampId === requestedStampId);
    if (!requestedItem) {
      return;
    }

    setShowStamps(true);
    setVisitFilter('all');
    focusItemOnMap(requestedItem);
    handledRequestedStampIdRef.current = requestedStampId;
  }, [focusItemOnMap, isMapReady, requestedStampId, stampItems]);

  useEffect(() => {
    if (!requestedParkingId) {
      handledRequestedParkingIdRef.current = null;
      return;
    }

    if (!isMapReady || handledRequestedParkingIdRef.current === requestedParkingId) {
      return;
    }

    const requestedItem = parkingItems.find((item) => item.parkingId === requestedParkingId);
    if (!requestedItem) {
      return;
    }

    setShowParking(true);
    focusItemOnMap(requestedItem);
    handledRequestedParkingIdRef.current = requestedParkingId;
  }, [focusItemOnMap, isMapReady, parkingItems, requestedParkingId]);

  const handleRegionChangeComplete = useCallback((nextRegion: Region) => {
    updateMapRegion(nextRegion);
    setIsParkingRevealPending(false);
    void syncMapHeading();
  }, [syncMapHeading, updateMapRegion]);

  const handleRegionChange = useCallback(() => {
    if (!selectedItem || selectionSheetMode === 'compact') {
      return;
    }

    if (Date.now() < suppressSheetCompactUntilRef.current) {
      return;
    }

    setSelectionSheetMode('compact');
  }, [selectedItem, selectionSheetMode]);

  const handleSelectionSheetToggleExpand = useCallback(() => {
    setSelectionSheetMode('expanded');
  }, []);

  const handleResetNorthPress = useCallback(() => {
    mapRef.current?.animateCamera(
      {
        heading: 0,
        pitch: 0,
      },
      { duration: 220 }
    );
    setMapHeading(0);
  }, []);

  const selectionPrimaryActionLabel = useMemo(() => {
    if (!selectedItem) {
      return undefined;
    }

    if (selectedItem.kind === 'parking') {
      return 'Navigation starten';
    }

    if (isStamping) {
      return 'Registriere Besuch...';
    }

    return selectedItem.kind === 'visited-stamp' ? 'Bereits gestempelt' : 'Besuch registrieren';
  }, [isStamping, selectedItem]);

  const selectionPrimaryActionDisabled = useMemo(() => {
    if (!selectedItem) {
      return true;
    }

    if (selectedItem.kind === 'parking') {
      return false;
    }

    return isStamping || selectedItem.kind === 'visited-stamp' || !accessToken || !canPerformWrites;
  }, [accessToken, canPerformWrites, isStamping, selectedItem]);

  const selectionPrimaryActionPress = useMemo(() => {
    if (!selectedItem) {
      return undefined;
    }

    if (selectedItem.kind === 'parking') {
      return handleStartSelectedParkingNavigation;
    }

    return handleStampVisit;
  }, [handleStampVisit, handleStartSelectedParkingNavigation, selectedItem]);

  const handleManualRefresh = useCallback(() => {
    if (!isOnline) {
      Alert.alert('Offline', OFFLINE_REFRESH_MESSAGE);
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.stampsOverview(claims?.sub) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.mapData(claims?.sub) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
    ]);
  }, [claims?.sub, isOnline, queryClient]);

  const showOfflineSearchHint =
    isSearchFocused &&
    !isOnline &&
    normalizeSearchValue(searchQuery).length >= REMOTE_PLACE_SEARCH_MIN_QUERY_LENGTH &&
    !shouldSkipRemotePlaceSearch(normalizeSearchValue(searchQuery));

  return (
    <View style={styles.screen}>
      {showStartupLoading || isFetching ? (
        <View style={styles.refreshBadge}>
          <Text style={styles.refreshBadgeText}>
            {showStartupLoading ? 'Lade Kartenpunkte...' : 'Aktualisiere Kartenpunkte...'}
          </Text>
        </View>
      ) : null}
      <StampingSuccessToast
        message="Stempel erfolgreich gesetzt."
        onHide={() => setIsStampSuccessToastVisible(false)}
        topOffset={insets.top + 64}
        visible={isStampSuccessToastVisible}
      />
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        onMapReady={() => {
          setIsMapReady(true);
          void syncMapHeading();
        }}
        onUserLocationChange={(event) => {
          if (!event.nativeEvent.coordinate) {
            return;
          }

          setUserLocation({
            latitude: event.nativeEvent.coordinate.latitude,
            longitude: event.nativeEvent.coordinate.longitude,
          });
          setLocationState('granted');
        }}
        onPress={() => {
          if (Date.now() - lastMarkerPressAtRef.current < 250) {
            return;
          }

          setSelectedItemId(null);
          setSelectedExternalPlace(null);
          setIsSearchFocused(false);
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
        onRegionChange={handleRegionChange}
        showsCompass={false}
        showsUserLocation={locationState !== 'denied'}
        showsMyLocationButton={false}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}>
        {renderedStampMarkers.map((item) => {
          if (item.kind === 'cluster') {
            const colors = markerColors(item.clusterKind);
            return (
              <Marker
                anchor={MARKER_ANCHOR}
                coordinate={item.coordinate}
                key={item.id}
                onPress={() => handleClusterPress(item)}
                zIndex={markerZIndex(item.clusterKind)}>
                <View collapsable={false} style={styles.pinMarker}>
                  <View
                    style={[
                      styles.pinHead,
                      styles.clusterMarkerHead,
                      { backgroundColor: colors.fill, shadowColor: colors.shadow },
                    ]}>
                    <Text style={[styles.clusterMarkerText, { color: colors.text }]}>{item.count}</Text>
                  </View>
                  <View style={styles.pinTipWrap}>
                    <View style={[styles.pinTip, { backgroundColor: colors.fill }]} />
                  </View>
                </View>
              </Marker>
            );
          }

          const stampItem = item as StampMarkerItem;
          const colors = markerColors(stampItem.kind);
          const markerLabel = normalizeStampMarkerToken(stampItem.number) || '--';
          const markerImage = getPreGeneratedMapMarkerImageSource({
            kind: stampItem.kind,
            label: markerLabel,
          });

          if (!markerImage) {
            return (
              <Marker
                anchor={MARKER_ANCHOR}
                coordinate={stampItem.coordinate}
                key={stampItem.id}
                onPress={() => handleMarkerPress(stampItem)}
                zIndex={markerZIndex(stampItem.kind)}>
                <View collapsable={false} style={styles.pinMarker}>
                  <View
                    style={[
                      styles.pinHead,
                      styles.stampMarkerHead,
                      { backgroundColor: colors.fill, shadowColor: colors.shadow },
                    ]}>
                    <Text style={[styles.stampMarkerText, { color: colors.text }]}>{markerLabel}</Text>
                  </View>
                  <View style={styles.pinTipWrap}>
                    <View style={[styles.pinTip, { backgroundColor: colors.fill }]} />
                  </View>
                </View>
              </Marker>
            );
          }

          return (
            <Marker
              anchor={MARKER_ANCHOR}
              coordinate={stampItem.coordinate}
              image={markerImage}
              key={stampItem.id}
              onPress={() => handleMarkerPress(stampItem)}
              pinColor={markerImage ? undefined : colors.fill}
              tracksViewChanges={false}
              zIndex={markerZIndex(stampItem.kind)}
            />
          );
        })}
        {visibleParkingItems.map((item) => {
          const colors = markerColors(item.kind);
          const markerImage = getPreGeneratedMapMarkerImageSource({
            kind: item.kind,
            label: 'P',
          });

          if (!markerImage) {
            return (
              <Marker
                anchor={MARKER_ANCHOR}
                coordinate={item.coordinate}
                key={item.id}
                onPress={() => handleMarkerPress(item)}
                zIndex={markerZIndex(item.kind)}>
                <View collapsable={false} style={styles.pinMarker}>
                  <View
                    style={[
                      styles.pinHead,
                      styles.parkingMarkerHead,
                      { backgroundColor: colors.fill, shadowColor: colors.shadow },
                    ]}>
                    <Text style={[styles.parkingMarkerText, { color: colors.text }]}>P</Text>
                  </View>
                  <View style={styles.pinTipWrap}>
                    <View style={[styles.pinTip, styles.pinTipCompact, { backgroundColor: colors.fill }]} />
                  </View>
                </View>
              </Marker>
            );
          }

          return (
            <Marker
              anchor={MARKER_ANCHOR}
              coordinate={item.coordinate}
              image={markerImage}
              key={item.id}
              onPress={() => handleMarkerPress(item)}
              pinColor={markerImage ? undefined : colors.fill}
              tracksViewChanges={false}
              zIndex={markerZIndex(item.kind)}
            />
          );
        })}
        {selectedExternalPlace ? (
          <Marker
            anchor={MARKER_ANCHOR}
            coordinate={{
              latitude: selectedExternalPlace.latitude,
              longitude: selectedExternalPlace.longitude,
            }}
            key={`external-selected:${selectedExternalPlace.placeId}`}
            pinColor="#8d5f34"
            zIndex={40}
          />
        ) : null}
      </MapView>

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlayUiLayer]}>
        <View style={[styles.topControls, { top: insets.top + 12 }]}>
          <View style={styles.searchBarWrap}>
            <View style={styles.searchBar}>
              <TextInput
                ref={searchInputRef}
                onBlur={() => {
                  if (searchBlurTimeoutRef.current) {
                    clearTimeout(searchBlurTimeoutRef.current);
                  }

                  searchBlurTimeoutRef.current = setTimeout(() => {
                    setIsSearchFocused(false);
                    searchBlurTimeoutRef.current = null;
                  }, 140);
                }}
                onChangeText={setSearchQuery}
                onFocus={() => {
                  if (searchBlurTimeoutRef.current) {
                    clearTimeout(searchBlurTimeoutRef.current);
                    searchBlurTimeoutRef.current = null;
                  }

                  setIsSearchFocused(true);
                }}
                placeholder="Suche Stempel oder Parkplatz"
                placeholderTextColor="#7b8776"
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            {isSearchFocused &&
            (localSearchResults.length > 0 ||
              remoteSearchResults.length > 0 ||
              isRemoteSearchLoading ||
              remoteSearchError ||
              showOfflineSearchHint) ? (
              <View style={styles.searchResultsPopover}>
                {localSearchResults.length > 0 ? <Text style={styles.searchSectionTitle}>Kartenpunkte</Text> : null}
                {localSearchResults.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => focusItemOnMap(item)}
                    style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}>
                    <Text numberOfLines={1} style={styles.searchResultTitle}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.searchResultMeta}>
                      {item.kind === 'parking' ? 'Parkplatz' : item.kind === 'visited-stamp' ? 'Besucht' : 'Unbesucht'}
                    </Text>
                  </Pressable>
                ))}
                {remoteSearchResults.length > 0 ? <Text style={styles.searchSectionTitle}>Orte</Text> : null}
                {remoteSearchResults.map((place) => (
                  <Pressable
                    key={`external:${place.placeId}`}
                    onPress={() => focusExternalPlaceOnMap(place)}
                    style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}>
                    <Text numberOfLines={1} style={styles.searchResultTitle}>
                      {place.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.searchResultMeta}>
                      {place.formattedAddress || 'Ort'}
                    </Text>
                  </Pressable>
                ))}
                {isRemoteSearchLoading ? (
                  <Text style={styles.searchStatusText}>Suche Orte...</Text>
                ) : null}
                {showOfflineSearchHint ? (
                  <Text style={styles.searchStatusText}>Offline: nur lokale Treffer werden angezeigt.</Text>
                ) : null}
                {!isRemoteSearchLoading && remoteSearchError ? (
                  <Text style={styles.searchStatusText}>{remoteSearchError}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <Pressable onPress={() => setIsFilterOpen(true)} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
            <Feather color="#1e2a1e" name="sliders" size={14} />
            <Text style={styles.filterButtonLabel}>Filter</Text>
          </Pressable>
          <Pressable onPress={handleManualRefresh} style={({ pressed }) => [styles.quickRefreshButton, pressed && styles.pressed]}>
            <Feather color="#1e2a1e" name="refresh-cw" size={14} />
          </Pressable>
        </View>

        {!isMapNorthUp ? (
          <View style={[styles.compassControl, { top: compassButtonTopOffset }]}>
            <Pressable onPress={handleResetNorthPress} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
              <Feather color="#2e3a2e" name="compass" size={18} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.zoomControls, { bottom: zoomControlsBottomOffset }]}>
          <Pressable
            disabled={!userLocation}
            onPress={handleLocateMePress}
            style={({ pressed }) => [
              styles.zoomButton,
              !userLocation && styles.disabledControl,
              pressed && userLocation && styles.pressed,
            ]}>
            <Feather color={userLocation ? '#2e3a2e' : '#9ba59a'} name="crosshair" size={19} />
          </Pressable>
          <Pressable onPress={() => zoomBy(0.8)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
            <Text style={styles.zoomButtonLabel}>+</Text>
          </Pressable>
          <Pressable onPress={() => zoomBy(1.25)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
            <Text style={styles.zoomButtonLabel}>−</Text>
          </Pressable>
        </View>

        {selectedItem ? (
          <MapSelectionSheet
            bottomOffset={sheetBottomOffset}
            mode={selectionSheetMode}
            item={{
              kind: selectedItem.kind,
              title: selectedItem.title,
              description: selectedItem.kind === 'parking' ? undefined : selectedItem.description,
              imageUrl: selectedItem.imageUrl,
            }}
            metadata={
              nearestCounterpartMeta ||
              (selectedItem.kind === 'parking'
                ? selectedItem.description?.trim()
                : formatVisitDate(selectedItem.visitedAt)
                  ? `Besucht am ${formatVisitDate(selectedItem.visitedAt)}`
                  : 'Noch kein Besuchsdatum vorhanden.')
            }
            onPrimaryActionPress={selectionPrimaryActionPress}
            primaryActionDisabled={selectionPrimaryActionDisabled}
            primaryActionLabel={selectionPrimaryActionLabel}
            onDetailsPress={() =>
              selectedItem.kind === 'parking'
                ? router.push(`/parking/${selectedItem.parkingId}` as never)
                : router.push(`/stamps/${selectedItem.stampId}` as never)
            }
            onHeightChange={setSelectedSheetHeight}
            onToggleExpand={handleSelectionSheetToggleExpand}
          />
        ) : null}
        {!selectedItem && selectedExternalPlace ? (
          <View style={[styles.externalPlaceSheet, { bottom: sheetBottomOffset }]}>
            <Text numberOfLines={1} style={styles.externalPlaceTitle}>
              {selectedExternalPlace.name}
            </Text>
            <Text numberOfLines={2} style={styles.externalPlaceMeta}>
              {selectedExternalPlace.formattedAddress || 'Externer Ort'}
            </Text>
            <Pressable
              onPress={() => void handleOpenExternalPlaceInGoogleMaps()}
              style={({ pressed }) => [styles.externalPlaceButton, pressed && styles.pressed]}>
              <Text style={styles.externalPlaceButtonLabel}>In Google Maps oeffnen</Text>
            </Pressable>
          </View>
        ) : null}

        {error && !data ? (
          <View style={[styles.errorBanner, { bottom: sheetBottomOffset }]}>
            <Text style={styles.errorBannerTitle}>Karte konnte nicht geladen werden</Text>
            <Text style={styles.errorBannerBody}>{error.message}</Text>
          </View>
        ) : null}
      </View>

      <Modal animationType="fade" onRequestClose={() => setIsFilterOpen(false)} transparent visible={isFilterOpen}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setIsFilterOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.filterPopover, { top: insets.top + 72, width: filterPopoverWidth }]}>
            <Text style={styles.filterTitle}>Filter</Text>

            <Text style={styles.filterSectionLabel}>Status</Text>
            <View style={styles.filterChipRow}>
              {VISIT_FILTERS.map((filter) => {
                const disabled = !showStamps;
                const isActive = visitFilter === filter.key;

                return (
                  <Pressable
                    disabled={disabled}
                    key={filter.key}
                    onPress={() => setVisitFilter(filter.key)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                      disabled && styles.filterChipDisabled,
                      pressed && !disabled && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.filterChipLabel,
                        isActive && styles.filterChipLabelActive,
                        disabled && styles.filterChipLabelDisabled,
                      ]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Inhalt</Text>
            <View style={styles.toggleList}>
              <Pressable
                onPress={() => setShowStamps((current) => !current)}
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}>
                <Text style={styles.toggleLabel}>Stempel</Text>
                <View style={[styles.togglePill, showStamps && styles.togglePillActive]}>
                  <View style={[styles.toggleThumb, showStamps && styles.toggleThumbActive]} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setShowParking((current) => !current)}
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}>
                <Text style={styles.toggleLabel}>Parkplaetze</Text>
                <View style={[styles.togglePill, showParking && styles.togglePillActive]}>
                  <View style={[styles.toggleThumb, showParking && styles.toggleThumbActive]} />
                </View>
              </Pressable>

            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e7ebde',
  },
  refreshBadge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,243,238,0.96)',
    shadowColor: '#141e14',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  refreshBadgeText: {
    color: '#2e6b4b',
    fontSize: 13,
    fontWeight: '600',
  },
  overlayUiLayer: {
    zIndex: 1000,
    elevation: 1000,
  },
  errorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,250,240,0.97)',
    shadowColor: '#141e14',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  errorBannerTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorBannerBody: {
    color: '#6b7a6b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  topControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarWrap: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    zIndex: 2,
  },
  filterButton: {
    width: 92,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  quickRefreshButton: {
    width: 44,
    height: 40,
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  searchBar: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  searchInput: {
    width: '100%',
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
  },
  searchResultsPopover: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 6,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  searchSectionTitle: {
    color: '#5f6f5f',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchResultRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  searchResultTitle: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  searchResultMeta: {
    color: '#6b7a6b',
    fontSize: 11,
    lineHeight: 14,
  },
  searchStatusText: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  externalPlaceSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,250,240,0.97)',
    shadowColor: '#141e14',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    gap: 8,
  },
  externalPlaceTitle: {
    color: '#1e2a1e',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  externalPlaceMeta: {
    color: '#627262',
    fontSize: 12,
    lineHeight: 16,
  },
  externalPlaceButton: {
    borderRadius: 12,
    backgroundColor: '#f2e6d8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  externalPlaceButtonLabel: {
    color: '#6b4d31',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  filterButtonLabel: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    gap: 10,
  },
  compassControl: {
    position: 'absolute',
    right: 16,
  },
  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  disabledControl: {
    opacity: 0.6,
  },
  zoomButtonLabel: {
    color: '#2e3a2e',
    fontSize: 24,
    lineHeight: 28,
  },
  pinMarker: {
    width: 56,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinHead: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
  },
  pinTipWrap: {
    marginTop: -5,
    height: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pinTip: {
    width: 14,
    height: 14,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  pinTipCompact: {
    width: 12,
    height: 12,
  },
  stampMarkerHead: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 10,
  },
  stampMarkerText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  parkingMarkerHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  parkingMarkerText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  clusterMarkerHead: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 11,
  },
  clusterMarkerText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  bottomSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  bottomSheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d8ded6',
    alignSelf: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailArtwork: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  detailCopy: {
    flex: 1,
    minWidth: 1,
  },
  detailTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  detailDescription: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  detailBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailBadgeVisited: {
    backgroundColor: '#deebe2',
  },
  detailBadgeOpen: {
    backgroundColor: '#f0e7e0',
  },
  detailBadgeParking: {
    backgroundColor: '#e3effc',
  },
  detailBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  detailBadgeTextVisited: {
    color: '#2e6b4b',
  },
  detailBadgeTextOpen: {
    color: '#7d5f52',
  },
  detailBadgeTextParking: {
    color: '#2f7dd7',
  },
  detailMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailAction: {
    backgroundColor: '#2e6b4b',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,30,20,0.16)',
  },
  filterPopover: {
    position: 'absolute',
    right: 16,
    width: 300,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 6,
  },
  filterTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  filterSectionLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#f2f0ea',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#2e6b4b',
  },
  filterChipDisabled: {
    opacity: 0.5,
  },
  filterChipLabel: {
    color: '#4a574a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  filterChipLabelActive: {
    color: '#f5f3ee',
  },
  filterChipLabelDisabled: {
    color: '#8b957f',
  },
  toggleList: {
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 1,
    gap: 2,
  },
  toggleLabel: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  toggleHint: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  togglePill: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#d5ddd4',
    padding: 3,
    justifyContent: 'center',
  },
  togglePillActive: {
    backgroundColor: '#2e6b4b',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  pressed: {
    opacity: 0.85,
  },
});
