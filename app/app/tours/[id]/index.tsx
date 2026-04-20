import { Feather } from '@expo/vector-icons';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  type ImageRequireSource,
  Linking,
  Modal,
  Pressable,
  Animated as RNAnimated,
  Easing as RNEasing,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MapView, { Marker, Polyline, type MapViewRef, type Region } from '@/components/maps/map-primitives';
import { SkeletonBlock } from '@/components/skeleton';
import {
  HttpStatusError,
  type PlaceSearchResult,
  type Tour,
  type TourPathEntry,
  type TourUpdateResponse,
  searchPlacesByName,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { triggerHaptic } from '@/lib/haptics-preferences';
import {
  getPreGeneratedMapMarkerFallbackImageSource,
  getPreGeneratedMapMarkerImageSource,
} from '@/lib/map-marker-images.generated';
import {
  isNetworkUnavailableError,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import {
  useDeleteTourMutation,
  useMapDataQuery,
  useTourDetailQuery,
  useUpdateTourByPOIListMutation,
  useUpdateTourNameMutation,
} from '@/lib/queries';

const HARZ_REGION: Region = {
  latitude: 51.7544,
  longitude: 10.6182,
  latitudeDelta: 0.42,
  longitudeDelta: 0.42,
};

const MAP_EDGE_PADDING = {
  top: 70,
  right: 70,
  bottom: 70,
  left: 70,
};

const MIN_ZOOM_DELTA = 0.008;
const MAX_ZOOM_DELTA = 1.2;
const CAMERA_MIN_ZOOM = 2;
const CAMERA_MAX_ZOOM = 19;
const FOCUS_TARGET_DELTA = 0.08;
const SEARCH_RESULT_LIMIT = 5;
const REMOTE_SEARCH_DEBOUNCE_MS = 350;
const POI_AUTOSAVE_DEBOUNCE_MS = 300;
const TOUR_NAME_AUTOSAVE_DEBOUNCE_MS = 2000;
const MARKER_OVERLAY_TRACKS_VIEW_CHANGES_MS = 250;
const MARKER_Z_INDEX_BASE = 20;
const MARKER_Z_INDEX_BADGE = 30;
const MARKER_Z_INDEX_SELECTED_HALO = 59;
const MARKER_Z_INDEX_SELECTED_BADGE = 61;
const MARKER_Z_INDEX_PARKING_BASE = 10;
const MARKER_Z_INDEX_PARKING_BADGE = 13;
const MARKER_Z_INDEX_PARKING_SELECTED_HALO = 12;
const MARKER_Z_INDEX_PARKING_SELECTED_BADGE = 14;
const WEBSITE_BASE_URL = 'https://www.harzer-wander-buddy.de';
const DIGITS_ONLY_PATTERN = /^\d+$/;
const STAMP_TOKEN_PATTERN = /\b(?:[A-Za-z]{1,3}\d{1,4}|\d{1,4}[A-Za-z]{1,3}|\d{1,4}|[A-Za-z]{1,3})\b/g;
const STAMP_TOKEN_IGNORED = new Set(['P', 'POI']);

type Coordinate = {
  latitude: number;
  longitude: number;
};

type TourMapMarkerKind = 'visited-stamp' | 'open-stamp' | 'parking' | 'poi';

type TourMapItem = {
  ID: string;
  name: string;
  typeLabel: string;
  markerLabel: string;
  stampNumber?: string;
  kind: TourMapMarkerKind;
  latitude: number;
  longitude: number;
  description?: string;
  imageUrl?: string;
};

type LiveTourMetrics = {
  distance: number | null;
  duration: number | null;
  stampCount: number | null;
  newStampCountForUser: number | null;
  totalElevationGain: number | null;
  totalElevationLoss: number | null;
};

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type SearchCandidate = TourMapItem & {
  distanceKm: number;
};

type ExternalPlaceSearchCandidate = PlaceSearchResult & {
  distanceKm: number;
};

type SearchResultRank = {
  matchTier: number;
  matchIndex: number;
  numberDelta: number;
  nameLength: number;
};

type ExpoImageSource = React.ComponentProps<typeof Image>['source'];

type MarkerBaseImageKind = 'visited-stamp' | 'open-stamp' | 'parking';
type MarkerOverlayKind = 'none' | 'badge';

type MarkerRenderState = {
  id: string;
  item: TourMapItem;
  coordinate: Coordinate;
  kind: TourMapMarkerKind;
  isInTour: boolean;
  routeOrderLabel: string | null;
  baseImageKind: MarkerBaseImageKind;
  baseImageLabel: string;
  baseImage: ImageRequireSource;
  overlayKind: MarkerOverlayKind;
  baseKey: string;
  overlayKey: string;
};

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return '-- km';
  }

  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatDuration(durationSeconds: number | null) {
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) {
    return '--:-- h';
  }

  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours}:${String(minutes).padStart(2, '0')} h`;
}

function formatElevation(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-- m';
  }

  return `${Math.round(value)} m`;
}

function formatDistanceKm(distanceKm: number) {
  if (!Number.isFinite(distanceKm)) {
    return '-- km';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function buildGoogleMapsDirectionsUrl(locations: string[]) {
  if (locations.length === 0) {
    return null;
  }

  const formatLocation = (value: string) => {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }

    return encodeURIComponent(trimmed);
  };

  const destination = locations[locations.length - 1];
  const waypoints = locations.slice(0, -1);
  const queryParts = [
    'api=1',
    `destination=${formatLocation(destination)}`,
    `travelmode=walking`,
  ];

  if (waypoints.length > 0) {
    queryParts.push(`waypoints=${waypoints.map((value) => formatLocation(value)).join('|')}`);
  }

  return `https://www.google.com/maps/dir/?${queryParts.join('&')}`;
}

function formatAlphabeticOrder(position: number) {
  if (!Number.isFinite(position) || position <= 0) {
    return '?';
  }

  let value = Math.floor(position);
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return label;
}

function resolveRouteOrderLabel(positions: number[]) {
  const labels = Array.from(
    new Set(
      [...positions]
        .filter((position) => Number.isFinite(position) && position > 0)
        .sort((left, right) => left - right)
        .map((position) => formatAlphabeticOrder(position))
    )
  );

  if (labels.length === 0) {
    return '--';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return labels.join('/');
}

function deriveBaseMarkerImageKind(kind: TourMapMarkerKind): MarkerBaseImageKind {
  if (kind === 'visited-stamp') {
    return 'visited-stamp';
  }

  if (kind === 'open-stamp') {
    return 'open-stamp';
  }

  if (kind === 'parking') {
    return 'parking';
  }

  return 'open-stamp';
}

function deriveBaseMarkerImageLabel(item: TourMapItem, baseImageKind: MarkerBaseImageKind) {
  if (baseImageKind === 'parking') {
    return 'P';
  }

  if (item.kind === 'poi') {
    return '--';
  }

  return extractStampToken(item.markerLabel) || '--';
}

function selectMarkerImage(baseImageKind: MarkerBaseImageKind, baseImageLabel: string): ImageRequireSource {
  const exactMatch = getPreGeneratedMapMarkerImageSource({
    kind: baseImageKind,
    label: baseImageLabel,
  });
  if (exactMatch) {
    return exactMatch;
  }

  if (baseImageKind !== 'parking') {
    const kindFallback = getPreGeneratedMapMarkerImageSource({
      kind: baseImageKind,
      label: '--',
    });
    if (kindFallback) {
      return kindFallback;
    }
  }

  const openStampFallback = getPreGeneratedMapMarkerImageSource({
    kind: 'open-stamp',
    label: '--',
  });
  if (openStampFallback) {
    return openStampFallback;
  }

  return getPreGeneratedMapMarkerFallbackImageSource('open-stamp');
}

function createMarkerKeys(input: {
  id: string;
  baseImageKind: MarkerBaseImageKind;
  baseImageLabel: string;
}) {
  const normalizedId = input.id.trim().toLowerCase();
  const normalizedBaseImageLabel = input.baseImageLabel.trim().toUpperCase() || '--';

  return {
    baseKey: `${normalizedId}:base:${input.baseImageKind}:${normalizedBaseImageLabel}`,
    overlayKey: `${normalizedId}:overlay`,
  };
}

function deriveMarkerRenderState(
  item: TourMapItem,
  positionsById: Map<string, number[]>
): MarkerRenderState {
  const normalizedItemId = item.ID.toLowerCase();
  const routePositions = positionsById.get(normalizedItemId) ?? [];
  const isInTour = routePositions.length > 0;
  const routeOrderLabel = isInTour ? resolveRouteOrderLabel(routePositions) : null;
  const baseImageKind = deriveBaseMarkerImageKind(item.kind);
  const baseImageLabel = deriveBaseMarkerImageLabel(item, baseImageKind);
  const baseImage = selectMarkerImage(baseImageKind, baseImageLabel);
  const overlayKind: MarkerOverlayKind = isInTour ? 'badge' : 'none';
  const { baseKey, overlayKey } = createMarkerKeys({
    id: item.ID,
    baseImageKind,
    baseImageLabel,
  });

  return {
    id: item.ID,
    item,
    coordinate: {
      latitude: item.latitude,
      longitude: item.longitude,
    },
    kind: item.kind,
    isInTour,
    routeOrderLabel,
    baseImageKind,
    baseImageLabel,
    baseImage,
    overlayKind,
    baseKey,
    overlayKey,
  };
}

function markerBaseZIndex(kind: TourMapMarkerKind) {
  if (kind === 'parking') {
    return MARKER_Z_INDEX_PARKING_BASE;
  }

  return MARKER_Z_INDEX_BASE;
}

function markerHaloZIndex(kind: TourMapMarkerKind) {
  if (kind === 'parking') {
    return MARKER_Z_INDEX_PARKING_SELECTED_HALO;
  }

  return MARKER_Z_INDEX_SELECTED_HALO;
}

function markerBadgeZIndex(kind: TourMapMarkerKind, isSelected: boolean) {
  if (kind === 'parking') {
    return isSelected ? MARKER_Z_INDEX_PARKING_SELECTED_BADGE : MARKER_Z_INDEX_PARKING_BADGE;
  }

  return isSelected ? MARKER_Z_INDEX_SELECTED_BADGE : MARKER_Z_INDEX_BADGE;
}

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

function cleanText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeUserId(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function derivePoiSequence(
  path: {
    rank: number;
    travelTime?: {
      fromPoi?: string;
      toPoi?: string;
    };
  }[]
) {
  const sorted = [...path].sort((left, right) => left.rank - right.rank);
  const result: string[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    const fromPoi = entry.travelTime?.fromPoi?.trim();
    const toPoi = entry.travelTime?.toPoi?.trim();

    if (index === 0 && fromPoi) {
      result.push(fromPoi);
    }

    if (toPoi) {
      result.push(toPoi);
    }
  }

  return result;
}

function clampDelta(value: number) {
  return Math.min(MAX_ZOOM_DELTA, Math.max(MIN_ZOOM_DELTA, value));
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStampToken(value?: string | null) {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  if (upper === '--' || STAMP_TOKEN_IGNORED.has(upper)) {
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

  return null;
}

function extractStampToken(value?: string | null) {
  const direct = normalizeStampToken(value);
  if (direct) {
    return direct;
  }

  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const matches = normalized.match(STAMP_TOKEN_PATTERN);
  if (!matches || matches.length === 0) {
    return null;
  }

  const tokens = matches
    .map((token) => normalizeStampToken(token))
    .filter((token): token is string => Boolean(token));

  if (tokens.length === 0) {
    return null;
  }

  const tokenWithDigits = tokens.find((token) => /\d/.test(token));
  return tokenWithDigits ?? tokens[0];
}

function haversineDistanceKm(from: Coordinate, to: Coordinate) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
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

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function createLiveTourMetrics(tour: Tour): LiveTourMetrics {
  return {
    distance: tour.distance,
    duration: tour.duration,
    stampCount: tour.stampCount,
    newStampCountForUser: tour.newStampCountForUser,
    totalElevationGain: tour.totalElevationGain,
    totalElevationLoss: tour.totalElevationLoss,
  };
}

function updateMetricsFromResponse(current: LiveTourMetrics, response: TourUpdateResponse): LiveTourMetrics {
  return {
    distance: response.distance ?? current.distance,
    duration: response.duration ?? current.duration,
    stampCount: response.stampCount ?? current.stampCount,
    newStampCountForUser: response.newStampCountForUser ?? current.newStampCountForUser,
    totalElevationGain: response.totalElevationGain ?? current.totalElevationGain,
    totalElevationLoss: response.totalElevationLoss ?? current.totalElevationLoss,
  };
}

function createEmptyLiveTourMetrics(): LiveTourMetrics {
  return {
    distance: null,
    duration: null,
    stampCount: null,
    newStampCountForUser: null,
    totalElevationGain: null,
    totalElevationLoss: null,
  };
}

function buildLegMetricsByArrivalIndex(draftPoiIds: string[], path: TourPathEntry[]) {
  const legsByArrivalIndex: (TourPathEntry['travelTime'] | null)[] = draftPoiIds.map(() => null);
  if (draftPoiIds.length < 2 || path.length === 0) {
    return legsByArrivalIndex;
  }

  const sortedPath = [...path].sort((left, right) => left.rank - right.rank);
  const queueByPair = new Map<string, TourPathEntry['travelTime'][]>();

  for (const entry of sortedPath) {
    const travelTime = entry.travelTime;
    const fromPoi = travelTime?.fromPoi?.trim().toLowerCase();
    const toPoi = travelTime?.toPoi?.trim().toLowerCase();
    if (!travelTime || !fromPoi || !toPoi) {
      continue;
    }

    const pairKey = `${fromPoi}->${toPoi}`;
    const queue = queueByPair.get(pairKey) ?? [];
    queue.push(travelTime);
    queueByPair.set(pairKey, queue);
  }

  for (let index = 1; index < draftPoiIds.length; index += 1) {
    const fromPoi = draftPoiIds[index - 1]?.trim().toLowerCase();
    const toPoi = draftPoiIds[index]?.trim().toLowerCase();
    if (!fromPoi || !toPoi) {
      continue;
    }

    const pairKey = `${fromPoi}->${toPoi}`;
    const queue = queueByPair.get(pairKey);
    if (queue && queue.length > 0) {
      legsByArrivalIndex[index] = queue.shift() ?? null;
      continue;
    }

    legsByArrivalIndex[index] = sortedPath[index - 1]?.travelTime ?? null;
  }

  return legsByArrivalIndex;
}

function rankSearchItem(item: TourMapItem, normalizedQuery: string): SearchResultRank | null {
  const name = normalizeSearchValue(item.name);
  const description = normalizeSearchValue(item.description ?? '');
  const nameIndex = name.indexOf(normalizedQuery);
  const descriptionIndex = description.indexOf(normalizedQuery);

  if (nameIndex < 0 && descriptionIndex < 0) {
    return null;
  }

  const normalizedStampNumber = normalizeSearchValue(item.stampNumber || '');
  const normalizedMarkerNumber =
    item.kind === 'parking' ? '' : normalizeSearchValue(extractStampToken(item.markerLabel) || '');
  const normalizedNumber = normalizedStampNumber || normalizedMarkerNumber;

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
    return { matchTier: 0, matchIndex: 0, numberDelta, nameLength: name.length };
  }

  if (name === normalizedQuery) {
    return { matchTier: 1, matchIndex: 0, numberDelta, nameLength: name.length };
  }

  if (normalizedNumber && normalizedNumber.startsWith(normalizedQuery)) {
    return { matchTier: 2, matchIndex: 0, numberDelta, nameLength: name.length };
  }

  if (nameIndex === 0) {
    return { matchTier: 3, matchIndex: 0, numberDelta, nameLength: name.length };
  }

  if (nameIndex > 0) {
    return { matchTier: 4, matchIndex: nameIndex, numberDelta, nameLength: name.length };
  }

  return { matchTier: 5, matchIndex: descriptionIndex, numberDelta, nameLength: name.length };
}

function getStampNumber(item?: TourMapItem | null) {
  if (!item) {
    return null;
  }

  const explicitStampNumber = extractStampToken(item.stampNumber);
  if (explicitStampNumber) {
    return explicitStampNumber;
  }

  if (
    item.kind !== 'visited-stamp' &&
    item.kind !== 'open-stamp' &&
    item.kind !== 'poi'
  ) {
    return null;
  }

  const markerLabel = extractStampToken(item.markerLabel);
  if (!markerLabel || markerLabel === '--') {
    return null;
  }

  return markerLabel;
}

function getMapItemGradientColors(kind: TourMapMarkerKind): readonly [string, string] {
  if (kind === 'visited-stamp') {
    return ['#4b875f', '#8fd2a4'] as const;
  }

  if (kind === 'open-stamp') {
    return ['#ab8d7d', '#dbc6b7'] as const;
  }

  if (kind === 'parking') {
    return ['#2f7dd7', '#6cb1ff'] as const;
  }

  return ['#5c7f62', '#9fc3a5'] as const;
}

function resolveMapItemImageSource(
  imageUrl: string | undefined,
  accessToken: string | null
): ExpoImageSource | null {
  if (!imageUrl) {
    return null;
  }

  return buildAuthenticatedImageSource(imageUrl, accessToken);
}

export default function TourDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const currentUserId = claims?.sub;
  const normalizedCurrentUserId = normalizeUserId(currentUserId);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[]; edit?: string | string[] }>();
  const tourId = Array.isArray(params.id) ? params.id[0] : params.id;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const shouldStartInEditMode = editParam === '1' || editParam === 'true';
  const { data, error, isPending, isFetching, refetch } = useTourDetailQuery(tourId);
  const { data: mapData } = useMapDataQuery();
  const deleteTourMutation = useDeleteTourMutation(tourId);
  const updateTourNameMutation = useUpdateTourNameMutation(tourId);
  const updateTourMutation = useUpdateTourByPOIListMutation(tourId);

  const [draftPoiIds, setDraftPoiIds] = useState<string[]>([]);
  const [lastPersistedPoiIds, setLastPersistedPoiIds] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [selectedMapItemId, setSelectedMapItemId] = useState<string | null>(null);
  const [selectedExternalPlace, setSelectedExternalPlace] = useState<ExternalPlaceSearchCandidate | null>(null);
  const [poiSearchQuery, setPoiSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [remoteSearchResults, setRemoteSearchResults] = useState<ExternalPlaceSearchCandidate[]>([]);
  const [isRemoteSearchLoading, setIsRemoteSearchLoading] = useState(false);
  const [remoteSearchError, setRemoteSearchError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapCenter, setMapCenter] = useState<Coordinate>({
    latitude: HARZ_REGION.latitude,
    longitude: HARZ_REGION.longitude,
  });
  const [liveTourMetrics, setLiveTourMetrics] = useState<LiveTourMetrics | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [livePathEntries, setLivePathEntries] = useState<TourPathEntry[]>([]);
  const [lastSaveErrorCode, setLastSaveErrorCode] = useState<403 | 404 | 422 | null>(null);
  const [blockingErrorCode, setBlockingErrorCode] = useState<403 | 404 | null>(null);
  const [, setStatusMessage] = useState<string | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewOverflowOpen, setIsViewOverflowOpen] = useState(false);
  const [isRemoveVisitDialogOpen, setIsRemoveVisitDialogOpen] = useState(false);
  const [tourNameDraft, setTourNameDraft] = useState('');
  const [tracksOverlayViewChanges, setTracksOverlayViewChanges] = useState(true);
  const [showPoiAddedFeedback, setShowPoiAddedFeedback] = useState(false);

  const mapRef = useRef<MapViewRef | null>(null);
  const hasAppliedAutoStartEditModeRef = useRef(false);
  const regionRef = useRef<Region>(HARZ_REGION);
  const lastMarkerPressAtRef = useRef(0);
  const activeSaveRequestIdRef = useRef(0);
  const queuedPoiIdsRef = useRef<string[] | null>(null);
  const latestDraftPoiIdsRef = useRef<string[]>([]);
  const poiAutosaveDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoSaveRunningRef = useRef(false);
  const wasEditModeRef = useRef(false);
  const renameDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTracksViewChangesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiAddedFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poiAddedFeedbackProgress = useRef(new RNAnimated.Value(1)).current;
  const tourMetricsGlowProgress = useRef(new RNAnimated.Value(0)).current;
  const fullscreenProgress = useSharedValue(0);
  const addPoiButtonScale = useSharedValue(1);
  const fullscreenAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + fullscreenProgress.value * 0.06 }],
  }));
  const addPoiButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addPoiButtonScale.value }],
  }));
  const shouldShowTourMetricsGlow = isEditMode && (saveStatus === 'saving' || updateTourMutation.isPending);
  const tourMetricsGlowTranslateX = useMemo(
    () =>
      tourMetricsGlowProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-140, 360],
      }),
    [tourMetricsGlowProgress]
  );

  const openMapFullscreen = useCallback(() => {
    setIsMapFullscreen(true);
  }, []);

  const closeMapFullscreen = useCallback(() => {
    fullscreenProgress.value = withTiming(
      0,
      {
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setIsMapFullscreen)(false);
        }
      }
    );
  }, [fullscreenProgress]);

  useEffect(() => {
    if (!tourId) {
      return;
    }

    hasAppliedAutoStartEditModeRef.current = false;
    setHasInitialized(false);
    setBlockingErrorCode(null);
    setLastSaveErrorCode(null);
    setStatusMessage(null);
    setSaveStatus('idle');
    setIsEditMode(false);
    setSelectedExternalPlace(null);
    setRemoteSearchResults([]);
    setRemoteSearchError(null);
    setIsRemoteSearchLoading(false);
    activeSaveRequestIdRef.current = 0;
    queuedPoiIdsRef.current = null;
    latestDraftPoiIdsRef.current = [];
    isAutoSaveRunningRef.current = false;
    if (poiAutosaveDebounceTimeoutRef.current) {
      clearTimeout(poiAutosaveDebounceTimeoutRef.current);
      poiAutosaveDebounceTimeoutRef.current = null;
    }
    if (renameDebounceTimeoutRef.current) {
      clearTimeout(renameDebounceTimeoutRef.current);
      renameDebounceTimeoutRef.current = null;
    }
    if (poiAddedFeedbackTimeoutRef.current) {
      clearTimeout(poiAddedFeedbackTimeoutRef.current);
      poiAddedFeedbackTimeoutRef.current = null;
    }
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    poiAddedFeedbackProgress.stopAnimation();
    poiAddedFeedbackProgress.setValue(1);
    tourMetricsGlowProgress.stopAnimation();
    tourMetricsGlowProgress.setValue(0);
    setShowPoiAddedFeedback(false);
    addPoiButtonScale.value = 1;
  }, [addPoiButtonScale, poiAddedFeedbackProgress, tourId, tourMetricsGlowProgress]);

  useEffect(() => {
    return () => {
      if (poiAddedFeedbackTimeoutRef.current) {
        clearTimeout(poiAddedFeedbackTimeoutRef.current);
        poiAddedFeedbackTimeoutRef.current = null;
      }
      if (searchBlurTimeoutRef.current) {
        clearTimeout(searchBlurTimeoutRef.current);
        searchBlurTimeoutRef.current = null;
      }
      poiAddedFeedbackProgress.stopAnimation();
      tourMetricsGlowProgress.stopAnimation();
    };
  }, [poiAddedFeedbackProgress, tourMetricsGlowProgress]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (poiAddedFeedbackTimeoutRef.current) {
      clearTimeout(poiAddedFeedbackTimeoutRef.current);
      poiAddedFeedbackTimeoutRef.current = null;
    }
    poiAddedFeedbackProgress.stopAnimation();
    poiAddedFeedbackProgress.setValue(1);
    setShowPoiAddedFeedback(false);
    addPoiButtonScale.value = 1;
  }, [addPoiButtonScale, isEditMode, poiAddedFeedbackProgress]);

  useEffect(() => {
    if (!shouldShowTourMetricsGlow) {
      tourMetricsGlowProgress.stopAnimation();
      tourMetricsGlowProgress.setValue(0);
      return;
    }

    tourMetricsGlowProgress.setValue(0);
    const animation = RNAnimated.loop(
      RNAnimated.timing(tourMetricsGlowProgress, {
        toValue: 1,
        duration: 1100,
        easing: RNEasing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => {
      animation.stop();
      tourMetricsGlowProgress.stopAnimation();
    };
  }, [shouldShowTourMetricsGlow, tourMetricsGlowProgress]);

  useEffect(() => {
    if (!isMapFullscreen) {
      return;
    }

    fullscreenProgress.value = 0;
    fullscreenProgress.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [fullscreenProgress, isMapFullscreen]);

  const originalPoiIds = useMemo(() => derivePoiSequence(data?.path ?? []), [data?.path]);

  useEffect(() => {
    if (!data || hasInitialized) {
      return;
    }

    // Skip placeholder tour detail state (cached tour with empty path) while
    // the real tour detail request is still in flight.
    if (isFetching && originalPoiIds.length === 0) {
      return;
    }

    setDraftPoiIds(originalPoiIds);
    setLastPersistedPoiIds(originalPoiIds);
    setLivePathEntries(data.path ?? []);
    setLiveTourMetrics(createLiveTourMetrics(data.tour));
    setHasInitialized(true);
  }, [data, hasInitialized, isFetching, originalPoiIds]);

  useEffect(() => {
    if (!data || isEditMode) {
      return;
    }

    setTourNameDraft(data.tour.name);
  }, [data, isEditMode]);

  const allMapItems = useMemo<TourMapItem[]>(() => {
    const itemsById = new Map<string, TourMapItem>();

    for (const stamp of mapData?.stamps ?? []) {
      const coordinate = extractCoordinate(stamp);
      if (!coordinate) {
        continue;
      }

      const markerLabel = cleanText(stamp.number) || '--';
      itemsById.set(stamp.ID.toLowerCase(), {
        ID: stamp.ID,
        name: cleanText(stamp.name) || stamp.ID,
        typeLabel: stamp.kind === 'visited-stamp' ? 'Besucht' : 'Unbesucht',
        markerLabel,
        stampNumber: extractStampToken(markerLabel) || undefined,
        kind: stamp.kind,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        description: cleanText(stamp.description),
        imageUrl: cleanText(stamp.heroImageUrl || stamp.image),
      });
    }

    for (const parkingSpot of mapData?.parkingSpots ?? []) {
      const coordinate = extractCoordinate(parkingSpot);
      if (!coordinate) {
        continue;
      }

      itemsById.set(parkingSpot.ID.toLowerCase(), {
        ID: parkingSpot.ID,
        name: cleanText(parkingSpot.name) || 'Parkplatz',
        typeLabel: 'Parkplatz',
        markerLabel: 'P',
        kind: 'parking',
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        description: cleanText(parkingSpot.description),
        imageUrl: cleanText(parkingSpot.image),
      });
    }

    return Array.from(itemsById.values());
  }, [mapData?.parkingSpots, mapData?.stamps]);

  const mapItemById = useMemo(() => {
    const nextMap = new Map<string, TourMapItem>();
    for (const item of allMapItems) {
      nextMap.set(item.ID.toLowerCase(), item);
    }

    return nextMap;
  }, [allMapItems]);

  const draftPoiStats = useMemo(() => {
    const positionsById = new Map<string, number[]>();
    draftPoiIds.forEach((poiId, index) => {
      const normalizedId = poiId.toLowerCase();
      const positions = positionsById.get(normalizedId) ?? [];
      positions.push(index + 1);
      positionsById.set(normalizedId, positions);
    });

    return { positionsById };
  }, [draftPoiIds]);

  const selectedMapItem = useMemo(() => {
    if (!selectedMapItemId) {
      return null;
    }

    return mapItemById.get(selectedMapItemId.toLowerCase()) ?? null;
  }, [mapItemById, selectedMapItemId]);
  const normalizedSelectedMapItemId = useMemo(
    () => selectedMapItemId?.toLowerCase() ?? null,
    [selectedMapItemId]
  );

  const mapItemsForRendering = useMemo(() => {
    return allMapItems;
  }, [allMapItems]);

  const markerRenderStates = useMemo(
    () =>
      mapItemsForRendering.map((item) => deriveMarkerRenderState(item, draftPoiStats.positionsById)),
    [draftPoiStats.positionsById, mapItemsForRendering]
  );
  const overlayRenderSignature = useMemo(
    () =>
      markerRenderStates
        .filter((state) => state.overlayKind !== 'none')
        .map((state) => `${state.id}:${state.overlayKind}:${state.routeOrderLabel ?? ''}`)
        .join('|'),
    [markerRenderStates]
  );

  const routeCoordinates = useMemo(
    () =>
      draftPoiIds
        .map((poiId) => mapItemById.get(poiId.toLowerCase()))
        .filter((item): item is TourMapItem => Boolean(item))
        .map((item) => ({ latitude: item.latitude, longitude: item.longitude })),
    [draftPoiIds, mapItemById]
  );

  useEffect(() => {
    if (overlayTracksViewChangesTimeoutRef.current) {
      clearTimeout(overlayTracksViewChangesTimeoutRef.current);
    }

    setTracksOverlayViewChanges(true);
    overlayTracksViewChangesTimeoutRef.current = setTimeout(() => {
      setTracksOverlayViewChanges(false);
      overlayTracksViewChangesTimeoutRef.current = null;
    }, MARKER_OVERLAY_TRACKS_VIEW_CHANGES_MS);

    return () => {
      if (overlayTracksViewChangesTimeoutRef.current) {
        clearTimeout(overlayTracksViewChangesTimeoutRef.current);
        overlayTracksViewChangesTimeoutRef.current = null;
      }
    };
  }, [normalizedSelectedMapItemId, overlayRenderSignature]);

  const hasPendingChanges = useMemo(
    () => !arraysEqual(draftPoiIds, lastPersistedPoiIds),
    [draftPoiIds, lastPersistedPoiIds]
  );

  useEffect(() => {
    latestDraftPoiIdsRef.current = draftPoiIds;
  }, [draftPoiIds]);

  useEffect(() => {
    if (!hasInitialized || !data || isEditMode) {
      return;
    }

    if (saveStatus === 'saving' || saveStatus === 'pending' || hasPendingChanges) {
      return;
    }

    setLiveTourMetrics(createLiveTourMetrics(data.tour));
    if (!arraysEqual(draftPoiIds, originalPoiIds)) {
      setDraftPoiIds(originalPoiIds);
    }
    if (!arraysEqual(lastPersistedPoiIds, originalPoiIds)) {
      setLastPersistedPoiIds(originalPoiIds);
    }
  }, [data, draftPoiIds, hasInitialized, hasPendingChanges, isEditMode, lastPersistedPoiIds, originalPoiIds, saveStatus]);

  const normalizedTourOwnerId = normalizeUserId(data?.tour.createdBy);
  const ownershipResolved = Boolean(normalizedCurrentUserId && normalizedTourOwnerId);
  const canEnterEditMode = ownershipResolved && normalizedTourOwnerId === normalizedCurrentUserId;
  const editingBlocked =
    !isEditMode ||
    !canPerformWrites ||
    blockingErrorCode === 403 ||
    blockingErrorCode === 404;
  const selectedItemInTourCount = selectedMapItem
    ? (draftPoiStats.positionsById.get(selectedMapItem.ID.toLowerCase()) ?? []).length
    : 0;
  const selectedItemVisitOptions = useMemo(() => {
    if (!selectedMapItem) {
      return [] as { draftIndex: number; orderLabel: string }[];
    }

    const normalizedSelectedId = selectedMapItem.ID.toLowerCase();
    const options: { draftIndex: number; orderLabel: string }[] = [];

    draftPoiIds.forEach((poiId, index) => {
      if (poiId.toLowerCase() !== normalizedSelectedId) {
        return;
      }

      options.push({
        draftIndex: index,
        orderLabel: formatAlphabeticOrder(index + 1),
      });
    });

    return options;
  }, [draftPoiIds, selectedMapItem]);
  const selectedRouteOrderLabel = useMemo(() => {
    if (!selectedMapItem) {
      return null;
    }

    const positions = draftPoiStats.positionsById.get(selectedMapItem.ID.toLowerCase()) ?? [];
    if (positions.length === 0) {
      return null;
    }

    return resolveRouteOrderLabel(positions);
  }, [draftPoiStats.positionsById, selectedMapItem]);
  const selectedStampNumber = getStampNumber(selectedMapItem);
  const selectedMapItemImageSource = useMemo<ExpoImageSource | null>(
    () => resolveMapItemImageSource(selectedMapItem?.imageUrl, accessToken),
    [accessToken, selectedMapItem?.imageUrl]
  );
  const routeLocationValues = useMemo(
    () =>
      draftPoiIds
        .map((poiId) => mapItemById.get(poiId.toLowerCase()))
        .filter((item): item is TourMapItem => Boolean(item))
        .map((item) => `${item.latitude},${item.longitude}`),
    [draftPoiIds, mapItemById]
  );
  const mapsDirectionsUrl = useMemo(
    () => buildGoogleMapsDirectionsUrl(routeLocationValues),
    [routeLocationValues]
  );
  const routeLegMetricsByArrivalIndex = useMemo(
    () => buildLegMetricsByArrivalIndex(draftPoiIds, livePathEntries),
    [draftPoiIds, livePathEntries]
  );
  const showDeferredTourSections = !hasInitialized && isFetching;

  useEffect(() => {
    if (isEditMode && selectedItemVisitOptions.length > 1) {
      return;
    }

    setIsRemoveVisitDialogOpen(false);
  }, [isEditMode, selectedItemVisitOptions.length]);

  const resetDraftToPersistedState = useCallback(() => {
    queuedPoiIdsRef.current = null;
    isAutoSaveRunningRef.current = false;
    if (poiAutosaveDebounceTimeoutRef.current) {
      clearTimeout(poiAutosaveDebounceTimeoutRef.current);
      poiAutosaveDebounceTimeoutRef.current = null;
    }
    setDraftPoiIds(lastPersistedPoiIds);
    setLastSaveErrorCode(null);
    setSaveStatus('idle');
    setStatusMessage(null);

    if (data?.tour) {
      setLivePathEntries(data.path ?? []);
      setLiveTourMetrics(createLiveTourMetrics(data.tour));
    }
  }, [data?.path, data?.tour, lastPersistedPoiIds]);
  const handleEnterEditMode = useCallback(() => {
    if (!canEnterEditMode || isEditMode) {
      return;
    }

    if (!canPerformWrites) {
      Alert.alert('Offline', 'Touren koennen nur online bearbeitet werden.');
      return;
    }

    setDraftPoiIds(lastPersistedPoiIds);
    setTourNameDraft(data?.tour.name ?? '');
    setLastSaveErrorCode(null);
    setSaveStatus('idle');
    setStatusMessage(null);
    setIsEditMode(true);
  }, [canEnterEditMode, canPerformWrites, data?.tour.name, isEditMode, lastPersistedPoiIds]);
  useEffect(() => {
    if (hasAppliedAutoStartEditModeRef.current) {
      return;
    }

    if (!shouldStartInEditMode) {
      hasAppliedAutoStartEditModeRef.current = true;
      return;
    }

    if (!hasInitialized) {
      return;
    }

    if (!canEnterEditMode) {
      if (ownershipResolved) {
        hasAppliedAutoStartEditModeRef.current = true;
      }
      return;
    }

    handleEnterEditMode();
    hasAppliedAutoStartEditModeRef.current = true;
  }, [canEnterEditMode, handleEnterEditMode, hasInitialized, ownershipResolved, shouldStartInEditMode]);
  const exitEditMode = useCallback(() => {
    setTourNameDraft(data?.tour.name ?? '');
    setIsEditMode(false);
  }, [data?.tour.name]);
  useEffect(() => {
    const wasEditMode = wasEditModeRef.current;
    wasEditModeRef.current = isEditMode;
    if (!wasEditMode || isEditMode) {
      return;
    }

    void refetch();
  }, [isEditMode, refetch]);
  const navigateBackToTours = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/tours' as never);
  }, [router]);
  const handleBackPress = useCallback(() => {
    if (updateTourMutation.isPending || updateTourNameMutation.isPending) {
      return;
    }

    if (!isEditMode) {
      navigateBackToTours();
      return;
    }

    if (!hasPendingChanges) {
      navigateBackToTours();
      return;
    }

    Alert.alert(
      'Ungespeicherte Aenderungen',
      'Du hast ungespeicherte Aenderungen an der Tour. Ohne Speichern verwerfen?',
      [
        {
          text: 'Weiter bearbeiten',
          style: 'cancel',
        },
        {
          text: 'Verwerfen',
          style: 'destructive',
          onPress: () => {
            resetDraftToPersistedState();
            exitEditMode();
            skipNextPreventRemoveRef.current = true;
            navigateBackToTours();
          },
        },
      ]
    );
  }, [
    exitEditMode,
    hasPendingChanges,
    isEditMode,
    navigateBackToTours,
    resetDraftToPersistedState,
    updateTourMutation.isPending,
    updateTourNameMutation.isPending,
  ]);
  const handleShareTour = useCallback(async () => {
    if (!data?.tour?.ID) {
      return;
    }

    const tourName = data.tour.name?.trim() || 'Tour';
    const shareParams = new URLSearchParams({
      id: data.tour.ID,
      title: tourName,
      description: `${tourName} in der Harzer Wanderbuddy App teilen.`,
      image: 'assets/images/BuddyWithMap.webp',
    });
    const shareUrl = `${WEBSITE_BASE_URL}/share/tour/?${shareParams.toString()}`;

    try {
      await Share.share({
        message: `${tourName}\n${shareUrl}`,
        title: tourName,
        url: shareUrl,
      });
    } catch (nextError) {
      Alert.alert('Teilen nicht moeglich', nextError instanceof Error ? nextError.message : 'Unknown error');
    }
  }, [data?.tour?.ID, data?.tour?.name]);
  const handleStartWholeTour = useCallback(async () => {
    if (!mapsDirectionsUrl) {
      Alert.alert('Route kann nicht gestartet werden', 'Bitte mindestens zwei Punkte zur Tour hinzufuegen.');
      return;
    }

    try {
      await ExpoLinking.openURL(mapsDirectionsUrl);
    } catch (nextError) {
      Alert.alert(
        'Google Maps konnte nicht geoeffnet werden',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    }
  }, [mapsDirectionsUrl]);
  useEffect(() => {
    if (!isEditMode || canEnterEditMode) {
      return;
    }

    resetDraftToPersistedState();
    setIsEditMode(false);
  }, [canEnterEditMode, isEditMode, resetDraftToPersistedState]);
  const skipNextPreventRemoveRef = useRef(false);

  usePreventRemove(isEditMode && hasPendingChanges && !updateTourMutation.isPending, (event) => {
    if (skipNextPreventRemoveRef.current) {
      skipNextPreventRemoveRef.current = false;
      return;
    }

    Alert.alert(
      'Ungespeicherte Aenderungen',
      'Du hast ungespeicherte Aenderungen an der Tour. Ohne Speichern verwerfen?',
      [
        {
          text: 'Weiter bearbeiten',
          style: 'cancel',
        },
        {
          text: 'Verwerfen',
          style: 'destructive',
          onPress: () => {
            skipNextPreventRemoveRef.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ]
    );
  });

  const localSearchResults = useMemo<SearchCandidate[]>(() => {
    if (!isSearchFocused || allMapItems.length === 0) {
      return [];
    }

    const normalizedQuery = normalizeSearchValue(poiSearchQuery);
    if (!normalizedQuery) {
      return [];
    }

    return allMapItems
      .map((item, originalIndex) => {
        const rank = rankSearchItem(item, normalizedQuery);
        if (!rank) {
          return null;
        }

        return {
          item,
          originalIndex,
          rank,
          distanceKm: haversineDistanceKm(mapCenter, {
            latitude: item.latitude,
            longitude: item.longitude,
          }),
        };
      })
      .filter(
        (
          entry
        ): entry is { item: TourMapItem; originalIndex: number; rank: SearchResultRank; distanceKm: number } =>
          entry !== null
      )
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

        if (left.rank.nameLength !== right.rank.nameLength) {
          return left.rank.nameLength - right.rank.nameLength;
        }

        if (left.distanceKm !== right.distanceKm) {
          return left.distanceKm - right.distanceKm;
        }

        if (left.originalIndex !== right.originalIndex) {
          return left.originalIndex - right.originalIndex;
        }

        return left.item.name.localeCompare(right.item.name, 'de');
      })
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((entry) => ({
        ...entry.item,
        distanceKm: entry.distanceKm,
      }));
  }, [allMapItems, isSearchFocused, mapCenter, poiSearchQuery]);
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchValue(poiSearchQuery),
    [poiSearchQuery]
  );

  useEffect(() => {
    if (!isSearchFocused) {
      setRemoteSearchResults([]);
      setRemoteSearchError(null);
      setIsRemoteSearchLoading(false);
      return;
    }

    if (normalizedSearchQuery.length < 3 || !accessToken || isOffline) {
      setRemoteSearchResults([]);
      setRemoteSearchError(null);
      setIsRemoteSearchLoading(false);
      return;
    }

    let isCancelled = false;
    setIsRemoteSearchLoading(true);
    setRemoteSearchError(null);

    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const places = await searchPlacesByName(accessToken, {
            query: poiSearchQuery,
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            limit: SEARCH_RESULT_LIMIT,
          });
          if (isCancelled) {
            return;
          }

          const withDistance = places.map((place) => ({
            ...place,
            distanceKm: haversineDistanceKm(mapCenter, {
              latitude: place.latitude,
              longitude: place.longitude,
            }),
          }));
          setRemoteSearchResults(withDistance);
          setRemoteSearchError(null);
        } catch (nextError) {
          if (isCancelled) {
            return;
          }

          if (isOffline || isNetworkUnavailableError(nextError) || nextError instanceof TypeError) {
            setRemoteSearchResults([]);
            setRemoteSearchError(null);
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
  }, [accessToken, isOffline, isSearchFocused, logout, mapCenter, normalizedSearchQuery, poiSearchQuery]);

  useEffect(() => {
    if (!isMapReady || isEditMode) {
      return;
    }

    const coordinatesToFit =
      routeCoordinates.length > 0
        ? routeCoordinates
        : allMapItems
            .slice(0, 16)
            .map((item) => ({ latitude: item.latitude, longitude: item.longitude }));

    if (coordinatesToFit.length === 0 || !mapRef.current) {
      return;
    }

    if (coordinatesToFit.length === 1) {
      const coordinate = coordinatesToFit[0];
      const nextRegion: Region = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: Math.min(regionRef.current.latitudeDelta, FOCUS_TARGET_DELTA),
        longitudeDelta: Math.min(regionRef.current.longitudeDelta, FOCUS_TARGET_DELTA),
      };
      regionRef.current = nextRegion;
      setMapCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
      mapRef.current.animateToRegion(nextRegion, 240);
      return;
    }

    mapRef.current.fitToCoordinates(coordinatesToFit, {
      edgePadding: MAP_EDGE_PADDING,
      animated: true,
    });
  }, [allMapItems, isEditMode, isMapReady, routeCoordinates]);

  const handleZoomBy = useCallback((factor: number) => {
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

      const nextRegion: Region = {
        ...regionRef.current,
        latitudeDelta: clampDelta(regionRef.current.latitudeDelta * factor),
        longitudeDelta: clampDelta(regionRef.current.longitudeDelta * factor),
      };

      regionRef.current = nextRegion;
      setMapCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
      map.animateToRegion(nextRegion, 180);
    })();
  }, []);

  const focusMapItemOnMap = useCallback((item: TourMapItem, options?: { updateSearchQuery?: boolean }) => {
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    lastMarkerPressAtRef.current = Date.now();

    const nextRegion: Region = {
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: Math.min(regionRef.current.latitudeDelta, FOCUS_TARGET_DELTA),
      longitudeDelta: Math.min(regionRef.current.longitudeDelta, FOCUS_TARGET_DELTA),
    };

    setSelectedMapItemId(item.ID);
    setSelectedExternalPlace(null);
    if (options?.updateSearchQuery) {
      setPoiSearchQuery(item.name);
    }
    setIsSearchFocused(false);
    regionRef.current = nextRegion;
    setMapCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
    mapRef.current?.animateToRegion(nextRegion, 220);
  }, []);

  const focusExternalPlaceOnMap = useCallback((place: ExternalPlaceSearchCandidate) => {
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current);
      searchBlurTimeoutRef.current = null;
    }
    lastMarkerPressAtRef.current = Date.now();

    const nextRegion: Region = {
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: Math.min(regionRef.current.latitudeDelta, FOCUS_TARGET_DELTA),
      longitudeDelta: Math.min(regionRef.current.longitudeDelta, FOCUS_TARGET_DELTA),
    };

    setSelectedMapItemId(null);
    setSelectedExternalPlace(place);
    setPoiSearchQuery(place.name);
    setIsSearchFocused(false);
    regionRef.current = nextRegion;
    setMapCenter({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
    mapRef.current?.animateToRegion(nextRegion, 220);
  }, []);

  const openExternalPlaceInGoogleMaps = useCallback(async () => {
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

  const performSave = useCallback(
    async function saveDraft(poiIds: string[], options?: { manual?: boolean }) {
      if (editingBlocked) {
        return false;
      }

      if (poiIds.length < 2) {
        if (options?.manual) {
          Alert.alert(
            'Zu wenige Punkte',
            'Mindestens zwei Punkte benoetigt (Start und Ziel), bevor gespeichert werden kann.'
          );
        }
        return false;
      }

      setSaveStatus('saving');
      setStatusMessage('Wird gespeichert...');
      setLastSaveErrorCode(null);

      try {
        requireOnlineForWrite(canPerformWrites, 'Tour kann nur online gespeichert werden.');
        const response = await updateTourMutation.mutateAsync({ poiIds });
        const draftChangedSinceRequest = !arraysEqual(latestDraftPoiIdsRef.current, poiIds);
        if (!draftChangedSinceRequest) {
          setLivePathEntries(response.path ?? []);
        }
        setLiveTourMetrics((current) =>
          updateMetricsFromResponse(
            current || createEmptyLiveTourMetrics(),
            response
          )
        );
        setLastPersistedPoiIds(poiIds);
        if (draftChangedSinceRequest) {
          setSaveStatus('pending');
          setStatusMessage('Aenderungen ausstehend...');
        } else {
          setSaveStatus('saved');
          setStatusMessage('Alle Aenderungen gespeichert');
        }
        setLastSaveErrorCode(null);
        const refreshed = await refetch();
        if (refreshed.data?.tour) {
          setLiveTourMetrics(createLiveTourMetrics(refreshed.data.tour));
          if (!isEditMode) {
            setLivePathEntries(refreshed.data.path ?? []);
            const refreshedPoiIds = derivePoiSequence(refreshed.data.path ?? []);
            setDraftPoiIds(refreshedPoiIds);
            setLastPersistedPoiIds(refreshedPoiIds);
          }
        }
        return true;
      } catch (nextError) {
        setSaveStatus('error');

        if (isNetworkUnavailableError(nextError)) {
          setStatusMessage(nextError.message);
          return false;
        }

        if (nextError instanceof HttpStatusError) {
          if (nextError.status === 403) {
            setBlockingErrorCode(403);
            setLastSaveErrorCode(403);
            setStatusMessage('Bearbeitung gesperrt');
            return false;
          }

          if (nextError.status === 404) {
            setBlockingErrorCode(404);
            setLastSaveErrorCode(404);
            setStatusMessage('Tour nicht mehr vorhanden');
            return false;
          }

          if (nextError.status === 422) {
            setLastSaveErrorCode(422);
            setStatusMessage('Route unvollstaendig berechenbar');
            return false;
          }
        }

        setStatusMessage('Speichern fehlgeschlagen');
        return false;
      }
    },
    [canPerformWrites, editingBlocked, isEditMode, refetch, updateTourMutation]
  );

  const triggerAutoSave = useCallback(
    async (nextPoiIds: string[]) => {
      if (isAutoSaveRunningRef.current) {
        queuedPoiIdsRef.current = nextPoiIds;
        setSaveStatus((current) => (current === 'saving' ? current : 'pending'));
        setStatusMessage('Aenderungen ausstehend...');
        return;
      }

      isAutoSaveRunningRef.current = true;
      let poiIdsToSave = nextPoiIds;
      let saveFailed = false;

      try {
        while (true) {
          activeSaveRequestIdRef.current += 1;
          const requestId = activeSaveRequestIdRef.current;
          const didSave = await performSave(poiIdsToSave);
          if (!didSave || activeSaveRequestIdRef.current !== requestId) {
            saveFailed = !didSave;
            break;
          }

          const queuedPoiIds = queuedPoiIdsRef.current;
          queuedPoiIdsRef.current = null;

          if (!queuedPoiIds || arraysEqual(queuedPoiIds, poiIdsToSave)) {
            break;
          }

          poiIdsToSave = queuedPoiIds;
          setSaveStatus('pending');
          setStatusMessage('Aenderungen ausstehend...');
        }
      } finally {
        isAutoSaveRunningRef.current = false;
        if (!saveFailed) {
          queuedPoiIdsRef.current = null;
        }
      }
    },
    [performSave]
  );

  useEffect(() => {
    if (!isEditMode) {
      queuedPoiIdsRef.current = null;
      if (poiAutosaveDebounceTimeoutRef.current) {
        clearTimeout(poiAutosaveDebounceTimeoutRef.current);
        poiAutosaveDebounceTimeoutRef.current = null;
      }
      return;
    }

    if (!hasInitialized || editingBlocked) {
      return;
    }

    if (!hasPendingChanges) {
      if (poiAutosaveDebounceTimeoutRef.current) {
        clearTimeout(poiAutosaveDebounceTimeoutRef.current);
        poiAutosaveDebounceTimeoutRef.current = null;
      }
      return;
    }

    if (draftPoiIds.length < 2) {
      setLastSaveErrorCode(null);
      if (poiAutosaveDebounceTimeoutRef.current) {
        clearTimeout(poiAutosaveDebounceTimeoutRef.current);
        poiAutosaveDebounceTimeoutRef.current = null;
      }
      return;
    }

    if (poiAutosaveDebounceTimeoutRef.current) {
      clearTimeout(poiAutosaveDebounceTimeoutRef.current);
    }

    poiAutosaveDebounceTimeoutRef.current = setTimeout(() => {
      poiAutosaveDebounceTimeoutRef.current = null;
      void triggerAutoSave(draftPoiIds);
    }, POI_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (poiAutosaveDebounceTimeoutRef.current) {
        clearTimeout(poiAutosaveDebounceTimeoutRef.current);
        poiAutosaveDebounceTimeoutRef.current = null;
      }
    };
  }, [
    draftPoiIds,
    isEditMode,
    editingBlocked,
    hasInitialized,
    hasPendingChanges,
    triggerAutoSave,
  ]);

  const handleFinishEditMode = useCallback(() => {
    if (!isEditMode || updateTourMutation.isPending || updateTourNameMutation.isPending) {
      return;
    }

    void (async () => {
      if (hasPendingChanges) {
        if (!canPerformWrites) {
          Alert.alert('Offline', 'Tour kann nur online gespeichert werden.');
          return;
        }

        const didSave = await performSave(draftPoiIds, { manual: true });
        if (!didSave) {
          return;
        }
      }

      exitEditMode();
    })();
  }, [
    draftPoiIds,
    exitEditMode,
    hasPendingChanges,
    isEditMode,
    canPerformWrites,
    performSave,
    updateTourMutation.isPending,
    updateTourNameMutation.isPending,
  ]);

  const triggerPoiAddedFeedback = useCallback(() => {
    if (poiAddedFeedbackTimeoutRef.current) {
      clearTimeout(poiAddedFeedbackTimeoutRef.current);
      poiAddedFeedbackTimeoutRef.current = null;
    }

    setShowPoiAddedFeedback(true);
    poiAddedFeedbackProgress.stopAnimation();
    poiAddedFeedbackProgress.setValue(1);
    RNAnimated.timing(poiAddedFeedbackProgress, {
      toValue: 0,
      duration: 800,
      useNativeDriver: false,
    }).start();
    addPoiButtonScale.value = 1;
    addPoiButtonScale.value = withTiming(
      0.97,
      {
        duration: 70,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (!finished) {
          return;
        }

        addPoiButtonScale.value = withTiming(1, {
          duration: 120,
          easing: Easing.inOut(Easing.cubic),
        });
      }
    );
    poiAddedFeedbackTimeoutRef.current = setTimeout(() => {
      poiAddedFeedbackTimeoutRef.current = null;
      setShowPoiAddedFeedback(false);
      poiAddedFeedbackProgress.stopAnimation();
      poiAddedFeedbackProgress.setValue(1);
    }, 800);

    void triggerHaptic('poiAdded').catch(() => {
      // Ignore non-critical haptic errors to keep add-flow robust.
    });
  }, [addPoiButtonScale, poiAddedFeedbackProgress]);

  const handleAppendSelectedPoi = useCallback(() => {
    if (editingBlocked || !selectedMapItem) {
      return;
    }

    setDraftPoiIds((current) => [...current, selectedMapItem.ID]);
    triggerPoiAddedFeedback();
  }, [editingBlocked, selectedMapItem, triggerPoiAddedFeedback]);

  const closeRemoveVisitDialog = useCallback(() => {
    setIsRemoveVisitDialogOpen(false);
  }, []);

  const removeSelectedPoiVisitAtIndex = useCallback(
    (draftIndex: number) => {
      if (editingBlocked) {
        return;
      }

      setDraftPoiIds((current) => current.filter((_, currentIndex) => currentIndex !== draftIndex));
      closeRemoveVisitDialog();
    },
    [closeRemoveVisitDialog, editingBlocked]
  );

  const handleRemoveSelectedPoi = useCallback(() => {
    if (editingBlocked || selectedItemVisitOptions.length === 0) {
      return;
    }

    if (selectedItemVisitOptions.length === 1) {
      removeSelectedPoiVisitAtIndex(selectedItemVisitOptions[0].draftIndex);
      return;
    }

    setIsRemoveVisitDialogOpen(true);
  }, [editingBlocked, removeSelectedPoiVisitAtIndex, selectedItemVisitOptions]);

  const openMapItemDetailPage = useCallback(
    (item: TourMapItem) => {
      if (item.kind === 'parking') {
        router.push({
          pathname: '/parking/[id]',
          params: {
            id: item.ID,
          },
        } as never);
        return;
      }

      const stampNumber = getStampNumber(item);
      if (
        item.kind === 'visited-stamp' ||
        item.kind === 'open-stamp' ||
        stampNumber
      ) {
        router.push({
          pathname: '/stamps/[id]',
          params: {
            id: item.ID,
          },
        } as never);
        return;
      }

      Alert.alert(
        'Keine Detailseite verfuegbar',
        'Fuer diesen Punkt ist aktuell keine separate Detailseite vorhanden.'
      );
    },
    [router]
  );

  const openSelectedItemDetailPage = useCallback(() => {
    if (!selectedMapItem) {
      return;
    }

    openMapItemDetailPage(selectedMapItem);
  }, [openMapItemDetailPage, selectedMapItem]);

  async function handleStartNavigation(item: TourMapItem) {
    if (!item.latitude || !item.longitude) {
      Alert.alert('Navigation nicht moeglich', 'Diese Stempelstelle hat keine Koordinaten.');
      return;
    }

    const url = buildGoogleMapsDirectionsUrl([`${item.latitude},${item.longitude}`]);
    if (!url) {
      Alert.alert('Navigation nicht moeglich', 'Diese Stempelstelle hat keine gueltige Route.');
      return;
    }

    await Linking.openURL(url);
  }

  const openListItemDetailPage = useCallback(
    (item?: TourMapItem) => {
      if (!item) {
        return;
      }

      openMapItemDetailPage(item);
    },
    [openMapItemDetailPage]
  );

  const movePoi = useCallback(
    (index: number, direction: -1 | 1) => {
      if (editingBlocked) {
        return;
      }

      setDraftPoiIds((current) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= current.length) {
          return current;
        }

        const next = [...current];
        const temp = next[targetIndex];
        next[targetIndex] = next[index];
        next[index] = temp;
        return next;
      });
    },
    [editingBlocked]
  );

  const removePoiAtIndex = useCallback(
    (index: number) => {
      if (editingBlocked) {
        return;
      }

      setDraftPoiIds((current) => current.filter((_, currentIndex) => currentIndex !== index));
    },
    [editingBlocked]
  );

  const handleDeleteTour = useCallback(() => {
    if (!canEnterEditMode || deleteTourMutation.isPending) {
      return;
    }

    try {
      requireOnlineForWrite(canPerformWrites, 'Touren koennen nur online geloescht werden.');
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      Alert.alert(
        'Tour konnte nicht geloescht werden',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
      return;
    }

    router.replace('/(tabs)/tours' as never);

    void deleteTourMutation.mutateAsync().catch((nextError) => {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof HttpStatusError && nextError.status === 404) {
        return;
      }

      Alert.alert(
        'Tour konnte nicht geloescht werden',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    });
  }, [canEnterEditMode, canPerformWrites, deleteTourMutation, router]);

  const handleCloseViewOverflowMenu = useCallback(() => {
    setIsViewOverflowOpen(false);
  }, []);

  const handleOpenViewOverflowMenu = useCallback(() => {
    if (isEditMode) {
      return;
    }
    setIsViewOverflowOpen(true);
  }, [isEditMode]);

  const handleConfirmDeleteTour = useCallback(() => {
    handleCloseViewOverflowMenu();

    const tourName = (data?.tour.name ?? 'Tour').trim() || 'Tour';

    Alert.alert(
      'Tour endgueltig loeschen?',
      `Du bist dabei, die Tour "${tourName}" zu loeschen. Diese Aktion kann nicht rueckgaengig gemacht werden.`,
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Endgueltig loeschen',
          style: 'destructive',
          onPress: () => {
            void handleDeleteTour();
          },
        },
      ]
    );
  }, [data?.tour.name, handleCloseViewOverflowMenu, handleDeleteTour]);

  const clearRenameDebounce = useCallback(() => {
    if (!renameDebounceTimeoutRef.current) {
      return;
    }

    clearTimeout(renameDebounceTimeoutRef.current);
    renameDebounceTimeoutRef.current = null;
  }, []);

  const handleSubmitRename = useCallback(async (options?: { silent?: boolean }) => {
    clearRenameDebounce();

    if (editingBlocked || updateTourNameMutation.isPending || !data) {
      return;
    }

    const normalizedName = tourNameDraft.trim();
    if (!normalizedName) {
      if (options?.silent) {
        setTourNameDraft(data.tour.name);
        return;
      }
      Alert.alert('Name fehlt', 'Bitte gib einen Namen fuer die Tour ein.');
      return;
    }

    if (normalizedName === data.tour.name) {
      if (tourNameDraft !== normalizedName) {
        setTourNameDraft(normalizedName);
      }
      return;
    }

    try {
      requireOnlineForWrite(canPerformWrites, 'Tourname kann nur online gespeichert werden.');
      setTourNameDraft(normalizedName);
      await updateTourNameMutation.mutateAsync({ name: normalizedName });
      setStatusMessage('Tourname aktualisiert');
      setSaveStatus((current) => (current === 'saving' ? current : 'saved'));
      await refetch();
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      Alert.alert(
        'Name konnte nicht gespeichert werden',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    }
  }, [canPerformWrites, clearRenameDebounce, data, editingBlocked, refetch, tourNameDraft, updateTourNameMutation]);

  const handleTourNameChange = useCallback(
    (nextValue: string) => {
      setTourNameDraft(nextValue);

      if (!isEditMode || !data) {
        return;
      }

      if (nextValue.trim() === data.tour.name) {
        setSaveStatus('idle');
        return;
      }

      setSaveStatus((current) => (current === 'saving' ? current : 'pending'));
    },
    [data, isEditMode]
  );

  useEffect(() => {
    if (!isEditMode || editingBlocked || !data) {
      clearRenameDebounce();
      return;
    }

    const normalizedDraft = tourNameDraft.trim();
    if (!normalizedDraft || normalizedDraft === data.tour.name) {
      clearRenameDebounce();
      return;
    }

    clearRenameDebounce();
    renameDebounceTimeoutRef.current = setTimeout(() => {
      void handleSubmitRename({ silent: true });
    }, TOUR_NAME_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      clearRenameDebounce();
    };
  }, [clearRenameDebounce, data, editingBlocked, handleSubmitRename, isEditMode, tourNameDraft]);

  if (!tourId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Tour-ID fehlt</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tourMetrics = liveTourMetrics ?? (data ? createLiveTourMetrics(data.tour) : null);

  if ((isPending && !data) || !tourMetrics) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingHeaderRow}>
            <Pressable onPress={handleBackPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color="#1e2a1e" name="arrow-left" size={16} />
            </Pressable>
            <SkeletonBlock height={34} radius={12} tone="strong" width="56%" />
          </View>

          <View style={styles.loadingCard}>
            <SkeletonBlock height={18} radius={9} tone="strong" width="42%" />
            <SkeletonBlock height={12} radius={6} width="86%" />
            <SkeletonBlock height={12} radius={6} width="78%" />
            <SkeletonBlock height={12} radius={6} width="68%" />
          </View>

          <View style={styles.loadingMapCard}>
            <SkeletonBlock height={236} radius={18} width="100%" />
          </View>

          <View style={styles.loadingCard}>
            <SkeletonBlock height={18} radius={9} tone="strong" width="48%" />
            <View style={styles.loadingPathRow}>
              <SkeletonBlock height={18} radius={9} width={18} />
              <View style={styles.loadingPathCopy}>
                <SkeletonBlock height={14} radius={7} width="58%" />
                <SkeletonBlock height={12} radius={6} width="72%" />
              </View>
            </View>
            <View style={styles.loadingPathRow}>
              <SkeletonBlock height={18} radius={9} width={18} />
              <View style={styles.loadingPathCopy}>
                <SkeletonBlock height={14} radius={7} width="46%" />
                <SkeletonBlock height={12} radius={6} width="66%" />
              </View>
            </View>
          </View>

          <Text style={styles.helperText}>Lade Tourdetails...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Tour konnte nicht geladen werden</Text>
          <Text style={styles.errorBody}>{error?.message || 'Keine Daten verfuegbar.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const footerSaveLabel = (() => {
    if (!isEditMode) {
      return null;
    }
    if (saveStatus === 'saving' || saveStatus === 'pending') {
      return 'Änderungen werden gespeichert...';
    }
    if (saveStatus === 'saved') {
      return 'Alle Änderungen gespeichert!';
    }
    return null;
  })();
  const renderTourMap = (isFullscreen: boolean) => (
    <View style={[styles.mapCard, isFullscreen && styles.mapCardFullscreen]}>
      <MapView
        ref={mapRef}
        initialRegion={HARZ_REGION}
        onMapReady={() => setIsMapReady(true)}
        onPress={() => {
          if (Date.now() - lastMarkerPressAtRef.current < 250) {
            return;
          }

          setSelectedMapItemId(null);
          setSelectedExternalPlace(null);
          setIsSearchFocused(false);
        }}
        onRegionChangeComplete={(nextRegion) => {
          regionRef.current = nextRegion;
          setMapCenter({
            latitude: nextRegion.latitude,
            longitude: nextRegion.longitude,
          });
        }}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}>
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#2e6b4b" strokeWidth={4} />
        ) : null}

        {markerRenderStates.map((state) => (
          <Marker
            anchor={{ x: 0.5, y: 1 }}
            coordinate={state.coordinate}
            image={state.baseImage}
            key={state.baseKey}
            onPress={() => focusMapItemOnMap(state.item)}
            tracksViewChanges={false}
            zIndex={markerBaseZIndex(state.kind)}
          />
        ))}

        {markerRenderStates.map((state) => {
          const isSelected = normalizedSelectedMapItemId === state.id.toLowerCase();
          if (!isSelected) {
            return null;
          }

          return (
            <Marker
              anchor={{ x: 0.5, y: 1 }}
              coordinate={state.coordinate}
              key={`${state.overlayKey}:halo`}
              tracksViewChanges={tracksOverlayViewChanges}
              zIndex={markerHaloZIndex(state.kind)}>
              <View collapsable={false} pointerEvents="none" style={styles.markerOverlayWrap}>
                <View style={styles.selectedMarkerHalo} />
              </View>
            </Marker>
          );
        })}

        {markerRenderStates.map((state) => {
          if (state.overlayKind !== 'badge') {
            return null;
          }

          const isSelected = normalizedSelectedMapItemId === state.id.toLowerCase();

          return (
            <Marker
              anchor={{ x: 0.5, y: 1 }}
              coordinate={state.coordinate}
              key={`${state.overlayKey}:badge:${state.routeOrderLabel ?? '--'}`}
              onPress={() => focusMapItemOnMap(state.item)}
              tracksViewChanges={tracksOverlayViewChanges}
              zIndex={markerBadgeZIndex(state.kind, isSelected)}>
              <View collapsable={false} pointerEvents="none" style={styles.markerOverlayWrap}>
                <View style={styles.poiInTourMarkerBadge}>
                  <Feather color="#f5f3ee" name="map-pin" size={9} />
                  <Text style={styles.poiInTourMarkerBadgeLabel}>{state.routeOrderLabel ?? '--'}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
        {selectedExternalPlace ? (
          <Marker
            anchor={{ x: 0.5, y: 1 }}
            coordinate={{ latitude: selectedExternalPlace.latitude, longitude: selectedExternalPlace.longitude }}
            key={`external:${selectedExternalPlace.placeId}`}
            pinColor="#8d5f34"
            zIndex={70}
          />
        ) : null}
      </MapView>

      <View style={[styles.mapTopBar, isFullscreen && { top: insets.top + 10 }]}>
        <View style={styles.mapTopControlsRow}>
          <View style={styles.mapSearchWrap}>
            <Feather color="#6d7d6e" name="search" size={14} />
            <TextInput
              onBlur={() => {
                if (searchBlurTimeoutRef.current) {
                  clearTimeout(searchBlurTimeoutRef.current);
                }

                searchBlurTimeoutRef.current = setTimeout(() => {
                  setIsSearchFocused(false);
                  searchBlurTimeoutRef.current = null;
                }, 140);
              }}
              onChangeText={setPoiSearchQuery}
              onFocus={() => {
                if (searchBlurTimeoutRef.current) {
                  clearTimeout(searchBlurTimeoutRef.current);
                  searchBlurTimeoutRef.current = null;
                }

                setIsSearchFocused(true);
              }}
              placeholder="Punkte auf der Karte suchen"
              placeholderTextColor="#7b8776"
              style={styles.mapSearchInput}
              value={poiSearchQuery}
            />
          </View>

          <Pressable
            onPress={isFullscreen ? closeMapFullscreen : openMapFullscreen}
            style={({ pressed }) => [styles.mapFullscreenButton, pressed && styles.pressed]}>
            <Feather color="#2e3a2e" name={isFullscreen ? 'minimize-2' : 'maximize-2'} size={16} />
          </Pressable>
        </View>

        {showSearchPopover ? (
          <View style={styles.searchResultsPopover}>
            {isOffline ? (
              <Text style={styles.searchStatusText}>Offline: nur lokale Treffer werden angezeigt.</Text>
            ) : null}
            {localSearchResults.length > 0 ? <Text style={styles.searchSectionTitle}>Kartenpunkte</Text> : null}
            {localSearchResults.map((item) => {
              const stampNumber = getStampNumber(item);
              return (
                <Pressable
                  key={item.ID}
                  onPress={() => focusMapItemOnMap(item, { updateSearchQuery: true })}
                  style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}>
                  <Text numberOfLines={1} style={styles.searchResultTitle}>
                    {stampNumber ? `#${stampNumber} · ${item.name}` : item.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.searchResultMeta}>
                    {`${stampNumber ? `Stempel ${stampNumber} • ` : ''}${item.typeLabel} • ${formatDistanceKm(item.distanceKm)}`}
                  </Text>
                </Pressable>
              );
            })}
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
                  {`${place.formattedAddress || 'Ort'} • ${formatDistanceKm(place.distanceKm)}`}
                </Text>
              </Pressable>
            ))}
            {isRemoteSearchLoading ? (
              <Text style={styles.searchStatusText}>Suche Orte...</Text>
            ) : null}
            {!isRemoteSearchLoading && remoteSearchError ? (
              <Text style={styles.searchStatusText}>{remoteSearchError}</Text>
            ) : null}
          </View>
        ) : null}
        {isEditMode ? (
          <Text style={styles.externalSearchHint}>
            Externe Orte sind nicht als Tourpunkt speicherbar.
          </Text>
        ) : null}
      </View>

      <View style={[styles.mapZoomControls, isFullscreen && { top: insets.top + 72 }]}>
        <Pressable onPress={() => handleZoomBy(0.65)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
          <Text style={styles.zoomButtonLabel}>+</Text>
        </Pressable>
        <Pressable onPress={() => handleZoomBy(1.55)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}>
          <Text style={styles.zoomButtonLabel}>−</Text>
        </Pressable>
      </View>

      {selectedMapItem ? (
        <View style={[styles.mapBottomSheet, isFullscreen && { bottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={openSelectedItemDetailPage}
            style={({ pressed }) => [styles.mapBottomInfoTap, pressed && styles.pressed]}>
            <View style={styles.mapBottomInfoRow}>
              {selectedMapItemImageSource ? (
                <Image cachePolicy="disk" source={selectedMapItemImageSource} style={styles.mapBottomArtwork} />
              ) : (
                <LinearGradient
                  colors={getMapItemGradientColors(selectedMapItem.kind)}
                  style={styles.mapBottomArtwork}
                />
              )}
              <View style={styles.mapBottomInfoCopy}>
                <Text numberOfLines={1} style={styles.mapBottomTitle}>
                  {`${selectedStampNumber ? `#${selectedStampNumber} · ` : ''}${selectedMapItem.name}`}
                </Text>
                <Text numberOfLines={1} style={styles.mapBottomMeta}>
                  {`${selectedRouteOrderLabel ? `Besuch ${selectedRouteOrderLabel} • ` : ''}${selectedStampNumber ? `Stempel ${selectedStampNumber} • ` : ''}${selectedMapItem.typeLabel}`}
                </Text>
              </View>
              <View style={styles.pathActions}>
                <Pressable
                  onPress={() => handleStartNavigation(selectedMapItem)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                  >
                  <Feather color="#2e3a2e" name="navigation" size={22} />
                </Pressable>
                <Feather color="#4d5b4d" name="chevron-right" size={22} />
              </View>
            </View>
          </Pressable>
          {isEditMode ? (
            <View style={styles.mapBottomActionRow}>
              <Animated.View style={[styles.mapBottomActionButton, addPoiButtonAnimatedStyle]}>
                <Pressable
                  disabled={editingBlocked}
                  onPress={handleAppendSelectedPoi}
                  style={({ pressed }) => [
                    styles.addButton,
                    styles.mapBottomActionButtonFill,
                    editingBlocked && styles.addButtonDisabled,
                    pressed && !editingBlocked && styles.pressed,
                  ]}>
                  <Text style={styles.addButtonLabel}>
                    {showPoiAddedFeedback
                      ? 'Hinzugefügt'
                      : selectedItemInTourCount > 0
                        ? 'Nochmals hinzufügen'
                        : 'Zur Tour hinzufügen'}
                  </Text>
                  {showPoiAddedFeedback ? (
                    <View style={styles.addFeedbackTimerTrack}>
                      <RNAnimated.View
                        style={[
                          styles.addFeedbackTimerBar,
                          {
                            width: poiAddedFeedbackProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>

              {selectedItemInTourCount > 0 ? (
                <Pressable
                  disabled={editingBlocked}
                  onPress={handleRemoveSelectedPoi}
                  style={({ pressed }) => [
                    styles.removeButton,
                    styles.mapBottomActionButton,
                    editingBlocked && styles.removeButtonDisabled,
                    pressed && !editingBlocked && styles.pressed,
                  ]}>
                  <Feather color={editingBlocked ? '#c19f9f' : '#a34e4e'} name="trash-2" size={13} />
                  <Text style={[styles.removeButtonLabel, editingBlocked && styles.removeButtonLabelDisabled]}>
                    Aus Tour entfernen
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {!selectedMapItem && selectedExternalPlace ? (
        <View style={[styles.mapBottomSheet, isFullscreen && { bottom: insets.bottom + 12 }]}>
          <View style={styles.mapBottomInfoRow}>
            <LinearGradient
              colors={['#9d7657', '#d5b18f']}
              style={styles.mapBottomArtwork}
            />
            <View style={styles.mapBottomInfoCopy}>
              <Text numberOfLines={1} style={styles.mapBottomTitle}>
                {selectedExternalPlace.name}
              </Text>
              <Text numberOfLines={2} style={styles.mapBottomMeta}>
                {selectedExternalPlace.formattedAddress || 'Externer Ort'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => void openExternalPlaceInGoogleMaps()}
            style={({ pressed }) => [styles.addButton, styles.mapBottomActionButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonLabel}>In Google Maps oeffnen</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const footerActionsDisabled =
    updateTourMutation.isPending || updateTourNameMutation.isPending || deleteTourMutation.isPending;
  const footerEditActionsDisabled = footerActionsDisabled || !canPerformWrites;
  const footerBottomInset = Math.max(insets.bottom, 12);
  const footerReservedHeight = 88 + footerBottomInset;
  const showSearchPopover =
    isSearchFocused &&
    (localSearchResults.length > 0 ||
      remoteSearchResults.length > 0 ||
      isRemoteSearchLoading ||
      remoteSearchError !== null ||
      (isOffline && normalizedSearchQuery.length > 0));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerReservedHeight }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={handleBackPress}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Feather color="#1e2a1e" name="arrow-left" size={16} />
            </Pressable>

            {!isEditMode ? (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => void handleShareTour()}
                  style={({ pressed }) => [styles.shareHeaderButton, pressed && styles.pressed]}>
                  <Feather color="#3a4f84" name="share-2" size={14} />
                  <Text style={styles.shareHeaderButtonLabel}>Teilen</Text>
                </Pressable>
                {canEnterEditMode ? (
                <Pressable
                  disabled={deleteTourMutation.isPending || !canPerformWrites}
                  onPress={handleOpenViewOverflowMenu}
                  style={({ pressed }) => [
                    styles.overflowHeaderButton,
                    (deleteTourMutation.isPending || !canPerformWrites) && styles.overflowHeaderButtonDisabled,
                    pressed && !deleteTourMutation.isPending && canPerformWrites && styles.pressed,
                  ]}>
                  <Feather
                    color={deleteTourMutation.isPending || !canPerformWrites ? '#9ba59a' : '#2e3a2e'}
                    name="more-horizontal"
                    size={16}
                  />
                </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {isEditMode ? (
            <View style={styles.titleInputShell}>
              <TextInput
                editable={!editingBlocked}
                maxLength={120}
                onBlur={() => void handleSubmitRename({ silent: true })}
                onChangeText={handleTourNameChange}
                onSubmitEditing={() => void handleSubmitRename()}
                placeholder="Tourname"
                placeholderTextColor="#7b8776"
                returnKeyType="done"
                style={[
                  styles.titleInput,
                  editingBlocked && styles.titleInputDisabled,
                ]}
                value={tourNameDraft}
              />
            </View>
          ) : (
            <Text style={styles.title}>{data.tour.name}</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Tourprofil</Text>
          </View>

          <View style={styles.tourMetricsLineWrap}>
            <Text style={styles.cardLine}>
              {`Distanz: ${formatDistance(tourMetrics.distance)} • Dauer: ${formatDuration(tourMetrics.duration)}`}
            </Text>
            {shouldShowTourMetricsGlow ? (
              <RNAnimated.View
                pointerEvents="none"
                style={[styles.tourMetricsLineGlow, { transform: [{ translateX: tourMetricsGlowTranslateX }] }]}>
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(244, 250, 245, 0.62)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tourMetricsLineGlowGradient}
                />
              </RNAnimated.View>
            ) : null}
          </View>

          <View style={styles.tourMetricsLineWrap}>
            <Text style={styles.cardLine}>
              {`Höhenprofil: ↑${formatElevation(tourMetrics.totalElevationGain)} • ↓${formatElevation(tourMetrics.totalElevationLoss)}`}
            </Text>
            {shouldShowTourMetricsGlow ? (
              <RNAnimated.View
                pointerEvents="none"
                style={[styles.tourMetricsLineGlow, { transform: [{ translateX: tourMetricsGlowTranslateX }] }]}>
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(244, 250, 245, 0.62)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tourMetricsLineGlowGradient}
                />
              </RNAnimated.View>
            ) : null}
          </View>

          <View style={styles.tourMetricsLineWrap}>
            <Text style={styles.cardLine}>
              {`Stempel gesamt: ${tourMetrics.stampCount ?? 0} • Neue Stempel für mich: ${tourMetrics.newStampCountForUser ?? 0}`}
            </Text>
            {shouldShowTourMetricsGlow ? (
              <RNAnimated.View
                pointerEvents="none"
                style={[styles.tourMetricsLineGlow, { transform: [{ translateX: tourMetricsGlowTranslateX }] }]}>
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0)',
                    'rgba(244, 250, 245, 0.62)',
                    'rgba(255, 255, 255, 0)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tourMetricsLineGlowGradient}
                />
              </RNAnimated.View>
            ) : null}
          </View>
        </View>

        {blockingErrorCode === 403 ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningTitle}>Bearbeitung gesperrt</Text>
            <Text style={styles.warningBody}>Diese Tour gehoert nicht zum aktuellen Benutzer.</Text>
          </View>
        ) : null}
        {blockingErrorCode === 404 ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningTitle}>Tour nicht mehr vorhanden</Text>
            <Text style={styles.warningBody}>Die Tour wurde entfernt oder ist nicht mehr verfuegbar.</Text>
          </View>
        ) : null}
        {lastSaveErrorCode === 422 ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningTitle}>Route unvollstaendig</Text>
            <Text style={styles.warningBody}>
              Die Route kann mit dieser Reihenfolge nicht vollstaendig berechnet werden. Bitte Reihenfolge
              oder Punkte anpassen.
            </Text>
          </View>
        ) : null}

        {isMapFullscreen ? null : showDeferredTourSections ? (
          <View style={styles.loadingMapCard}>
            <SkeletonBlock height={236} radius={18} width="100%" />
          </View>
        ) : renderTourMap(false)}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aktuelle Reihenfolge</Text>
          {showDeferredTourSections ? (
            <>
              <View style={styles.loadingPathRow}>
                <SkeletonBlock height={18} radius={9} width={18} />
                <View style={styles.loadingPathCopy}>
                  <SkeletonBlock height={14} radius={7} width="58%" />
                  <SkeletonBlock height={12} radius={6} width="72%" />
                </View>
              </View>
              <View style={styles.loadingPathRow}>
                <SkeletonBlock height={18} radius={9} width={18} />
                <View style={styles.loadingPathCopy}>
                  <SkeletonBlock height={14} radius={7} width="46%" />
                  <SkeletonBlock height={12} radius={6} width="66%" />
                </View>
              </View>
            </>
          ) : draftPoiIds.length === 0 ? (
            <Text style={styles.cardLine}>Noch keine Punkte in der Tour.</Text>
          ) : (
            draftPoiIds.map((poiId, index) => {
              const item = mapItemById.get(poiId.toLowerCase());
              const title = item?.name || poiId;
              const stampNumber = getStampNumber(item);
              const legMetrics = routeLegMetricsByArrivalIndex[index] ?? null;
              const legMetaLabel =
                index > 0
                  ? `${formatDuration(legMetrics?.durationSeconds ?? null)} • ${formatDistance(legMetrics?.distanceMeters ?? null)} • ↑${formatElevation(legMetrics?.elevationGain ?? null)} • ↓${formatElevation(legMetrics?.elevationLoss ?? null)}`
                  : 'Startpunkt';
              const pathItemImageSource = resolveMapItemImageSource(item?.imageUrl, accessToken);

              return (
                <View key={`${poiId}-${index}`} style={styles.pathRow}>
                  <Pressable
                    disabled={!item}
                    onPress={() => {
                      if (!item) {
                        return;
                      }

                      focusMapItemOnMap(item);
                    }}
                    style={({ pressed }) => [
                      styles.pathOpenable,
                      pressed && item && styles.pressed,
                    ]}>
                    {pathItemImageSource ? (
                      <Image cachePolicy="disk" source={pathItemImageSource} style={styles.pathArtwork} />
                    ) : item ? (
                      <LinearGradient
                        colors={getMapItemGradientColors(item.kind)}
                        style={styles.pathArtwork}
                      />
                    ) : (
                      <View style={[styles.pathArtwork, styles.pathArtworkFallback]}>
                        <Text style={styles.pathArtworkFallbackLabel}>?</Text>
                      </View>
                    )}

                    <View style={styles.pathCopy}>
                      <Text style={styles.pathTitle}>
                        {`${formatAlphabeticOrder(index + 1)}. ${stampNumber ? `#${stampNumber} · ` : ''}${title}`}
                      </Text>
                      <Text style={styles.pathMeta}>
                        {stampNumber
                          ? `Stempel ${stampNumber} • ${item?.typeLabel || 'Unbekannt'}`
                          : item?.typeLabel || 'Unbekannt'}
                      </Text>
                      <Text style={styles.pathMetaLeg}>{legMetaLabel}</Text>
                    </View>
                  </Pressable>
                  {isEditMode ? (
                    <View style={styles.pathActions}>
                      <Pressable
                        disabled={editingBlocked || index === 0}
                        onPress={() => movePoi(index, -1)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          (editingBlocked || index === 0) && styles.iconButtonDisabled,
                          pressed && !editingBlocked && index !== 0 && styles.pressed,
                        ]}>
                        <Feather
                          color={editingBlocked || index === 0 ? '#9ba59a' : '#2e3a2e'}
                          name="arrow-up"
                          size={14}
                        />
                      </Pressable>

                      <Pressable
                        disabled={editingBlocked || index === draftPoiIds.length - 1}
                        onPress={() => movePoi(index, 1)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          (editingBlocked || index === draftPoiIds.length - 1) && styles.iconButtonDisabled,
                          pressed && !editingBlocked && index !== draftPoiIds.length - 1 && styles.pressed,
                        ]}>
                        <Feather
                          color={editingBlocked || index === draftPoiIds.length - 1 ? '#9ba59a' : '#2e3a2e'}
                          name="arrow-down"
                          size={14}
                        />
                      </Pressable>

                      <Pressable
                        disabled={editingBlocked}
                        onPress={() => removePoiAtIndex(index)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          editingBlocked && styles.iconButtonDisabled,
                          pressed && !editingBlocked && styles.pressed,
                        ]}>
                        <Feather color={editingBlocked ? '#9ba59a' : '#a34e4e'} name="trash-2" size={14} />
                      </Pressable>
                    </View>
                  ) : item ? (
                    <View style={styles.pathActions}>
                      <Pressable
                        onPress={() => handleStartNavigation(item)}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                        >
                        <Feather color="#2e3a2e" name="navigation" size={22} />
                      </Pressable>
                      <Pressable
                        onPress={() => openListItemDetailPage(item)}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                        <Feather color="#8b957f" name="chevron-right" size={22} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {isFetching ? <Text style={styles.refreshHint}>Aktualisiere Tourdaten im Hintergrund...</Text> : null}
      </ScrollView>

      <View style={[styles.floatingFooterShell, { paddingBottom: footerBottomInset }]}>
        <View style={styles.floatingFooterBar}>
          {isEditMode ? (
            footerSaveLabel ? (
              <Text style={styles.footerEditHint}>{footerSaveLabel}</Text>
            ) : (
              <View style={styles.footerEditHintPlaceholder} />
            )
          ) : (
            <Pressable
              disabled={!mapsDirectionsUrl || footerActionsDisabled}
              onPress={() => void handleStartWholeTour()}
              style={({ pressed }) => [
                styles.footerSecondaryButton,
                (!mapsDirectionsUrl || footerActionsDisabled) && styles.footerSecondaryButtonDisabled,
                pressed && mapsDirectionsUrl && !footerActionsDisabled && styles.pressed,
              ]}>
              <Feather color="#8a5a3a" name="navigation" size={14} />
              <Text style={styles.footerSecondaryButtonLabel}>Ganze Tour starten</Text>
            </Pressable>
          )}

          {isEditMode ? (
            <Pressable
              disabled={footerEditActionsDisabled}
              onPress={handleFinishEditMode}
              style={({ pressed }) => [
                styles.footerPrimaryButton,
                styles.footerPrimaryButtonSecondary,
                footerEditActionsDisabled && styles.footerPrimaryButtonDisabled,
                pressed && !footerEditActionsDisabled && styles.pressed,
              ]}>
              <Text style={[styles.footerPrimaryButtonLabel, styles.footerPrimaryButtonLabelSecondary]}>Fertig</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={!canEnterEditMode || footerEditActionsDisabled}
              onPress={handleEnterEditMode}
              style={({ pressed }) => [
                styles.footerPrimaryButton,
                (!canEnterEditMode || footerEditActionsDisabled) && styles.footerPrimaryButtonDisabled,
                pressed && canEnterEditMode && !footerEditActionsDisabled && styles.pressed,
              ]}>
              <Text style={styles.footerPrimaryButtonLabel}>Bearbeiten</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={handleCloseViewOverflowMenu}
        transparent
        visible={isViewOverflowOpen}>
        <View style={styles.overflowModalBackdrop}>
          <Pressable onPress={handleCloseViewOverflowMenu} style={StyleSheet.absoluteFill} />
          <View style={[styles.overflowPopover, { top: insets.top + 58 }]}>
            <Text style={styles.overflowTitle}>Aktionen</Text>

            {canEnterEditMode ? (
              <Pressable
                disabled={deleteTourMutation.isPending || !canPerformWrites}
                onPress={handleConfirmDeleteTour}
                style={({ pressed }) => [
                  styles.overflowActionButton,
                  styles.overflowActionDanger,
                  (deleteTourMutation.isPending || !canPerformWrites) && styles.overflowActionButtonDisabled,
                  pressed && !deleteTourMutation.isPending && canPerformWrites && styles.pressed,
                ]}>
                <Feather
                  color={deleteTourMutation.isPending || !canPerformWrites ? '#b89b9b' : '#a34e4e'}
                  name="trash-2"
                  size={14}
                />
                <Text
                  style={[
                    styles.overflowActionLabel,
                    styles.overflowActionLabelDanger,
                    (deleteTourMutation.isPending || !canPerformWrites) && styles.overflowActionLabelDisabled,
                  ]}>
                  Tour loeschen
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.overflowEmptyHint}>Keine verfuegbaren Aktionen.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeRemoveVisitDialog}
        transparent
        visible={isRemoveVisitDialogOpen}>
        <View style={styles.removeVisitBackdrop}>
          <Pressable onPress={closeRemoveVisitDialog} style={StyleSheet.absoluteFill} />
          <View style={styles.removeVisitDialog}>
            <Text style={styles.removeVisitTitle}>Welchen Besuch entfernen?</Text>
            <Text style={styles.removeVisitSubtitle}>Waehle den Besuch aus, der aus der Tour entfernt werden soll.</Text>

            <View style={styles.removeVisitList}>
              {selectedItemVisitOptions.map((visit) => (
                <Pressable
                  key={visit.draftIndex}
                  onPress={() => removeSelectedPoiVisitAtIndex(visit.draftIndex)}
                  style={({ pressed }) => [styles.removeVisitOption, pressed && styles.pressed]}>
                  <Feather color="#a34e4e" name="map-pin" size={13} />
                  <Text style={styles.removeVisitOptionLabel}>{`Besuch ${visit.orderLabel}`}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={closeRemoveVisitDialog} style={({ pressed }) => [styles.removeVisitCancel, pressed && styles.pressed]}>
              <Text style={styles.removeVisitCancelLabel}>Abbrechen</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        visible={isMapFullscreen}
        onRequestClose={closeMapFullscreen}>
        <View style={styles.mapFullscreenSafeArea}>
          <Animated.View style={[styles.mapFullscreenContent, fullscreenAnimatedStyle]}>
            {renderTourMap(true)}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  loadingMapCard: {
    borderRadius: 18,
    height: 260,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    padding: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  loadingPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingPathCopy: {
    flex: 1,
    gap: 6,
  },
  headerWrap: {
    gap: 6,
    paddingHorizontal: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareHeaderButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: '#edf2fc',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  shareHeaderButtonLabel: {
    color: '#3a4f84',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  backButton: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  overflowHeaderButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eef4ee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  overflowHeaderButtonDisabled: {
    opacity: 0.7,
  },
  overflowModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,30,20,0.16)',
  },
  overflowPopover: {
    position: 'absolute',
    right: 16,
    width: 240,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  overflowTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  overflowActionButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overflowActionDanger: {
    backgroundColor: '#fff0f0',
  },
  overflowActionButtonDisabled: {
    backgroundColor: '#f7f1f1',
  },
  overflowActionLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  overflowActionLabelDanger: {
    color: '#a34e4e',
  },
  overflowActionLabelDisabled: {
    color: '#b89b9b',
  },
  overflowEmptyHint: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  removeVisitBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,30,20,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  removeVisitDialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  removeVisitTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  removeVisitSubtitle: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  removeVisitList: {
    gap: 8,
  },
  removeVisitOption: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff0f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeVisitOptionLabel: {
    color: '#a34e4e',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  removeVisitCancel: {
    borderRadius: 12,
    backgroundColor: '#eef3ed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  removeVisitCancelLabel: {
    color: '#2e6b4b',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  titleInputShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9ddcf',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  titleInput: {
    color: '#2e3a2e',
    fontSize: 23,
    lineHeight: 30,
    fontFamily: 'serif',
    paddingVertical: 0,
  },
  titleInputDisabled: {
    color: '#7f8a7f',
  },
  title: {
    color: '#1e2a1e',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'serif',
  },
  subtitle: {
    color: '#445244',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  cardLine: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  tourMetricsLineWrap: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tourMetricsLineGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 130,
  },
  tourMetricsLineGlowGradient: {
    flex: 1,
  },
  warningBanner: {
    borderRadius: 16,
    backgroundColor: '#fff6ea',
    borderWidth: 1,
    borderColor: '#efd9b7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  warningTitle: {
    color: '#6b4d14',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  warningBody: {
    color: '#7d6a45',
    fontSize: 12,
    lineHeight: 16,
  },
  mapCard: {
    height: 390,
    borderRadius: 22,
    overflow: 'visible',
    backgroundColor: '#e7ebde',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  mapCardFullscreen: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  mapFullscreenSafeArea: {
    flex: 1,
    backgroundColor: '#1e2a1e',
  },
  mapFullscreenContent: {
    flex: 1,
  },
  mapTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  mapTopControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapSearchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  mapFullscreenButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  mapSearchInput: {
    flex: 1,
    color: '#2e3a2e',
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 0,
  },
  searchResultsPopover: {
    marginTop: 8,
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
  externalSearchHint: {
    marginTop: 6,
    marginLeft: 4,
    color: '#6b7a6b',
    fontSize: 11,
    lineHeight: 14,
  },
  mapZoomControls: {
    position: 'absolute',
    right: 12,
    top: 74,
    gap: 8,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  zoomButtonLabel: {
    color: '#2e3a2e',
    fontSize: 20,
    lineHeight: 22,
  },
  markerOverlayWrap: {
    width: 58,
    height: 62,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  selectedMarkerHalo: {
    position: 'absolute',
    top: 5,
    width: 51,
    height: 51,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  poiInTourMarkerBadge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 22,
    borderRadius: 999,
    backgroundColor: '#2f7dd7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  poiInTourMarkerBadgeLabel: {
    color: '#f5f3ee',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
  },
  mapBottomSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  mapBottomInfoTap: {
    borderRadius: 10,
    paddingVertical: 2,
  },
  mapBottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapBottomArtwork: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  mapBottomInfoCopy: {
    flex: 1,
    minWidth: 1,
    gap: 2,
  },
  mapBottomOpenHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
  },
  mapBottomOpenLabel: {
    color: '#4d5b4d',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  mapBottomTitle: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapBottomMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  mapBottomActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mapBottomActionButton: {
    flex: 1,
  },
  mapBottomActionButtonFill: {
    width: '100%',
  },
  addButton: {
    backgroundColor: '#2e6b4b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#b8c7bb',
  },
  addButtonLabel: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  addFeedbackTimerTrack: {
    marginTop: 6,
    width: '100%',
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 243, 238, 0.25)',
    overflow: 'hidden',
  },
  addFeedbackTimerBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f5f3ee',
  },
  removeButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#fff0f0',
  },
  removeButtonDisabled: {
    backgroundColor: '#f7f1f1',
  },
  removeButtonLabel: {
    color: '#a34e4e',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  removeButtonLabelDisabled: {
    color: '#c19f9f',
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#f5f3ee',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pathOpenable: {
    flex: 1,
    minWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 2,
  },
  pathArtwork: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  pathArtworkFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a3aea2',
  },
  pathArtworkFallbackLabel: {
    color: '#f5f3ee',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  pathCopy: {
    flex: 1,
    minWidth: 1,
    gap: 2,
  },
  pathTitle: {
    color: '#2e3a2e',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  pathMeta: {
    color: '#748074',
    fontSize: 11,
    lineHeight: 14,
  },
  pathMetaLeg: {
    color: '#4d6d56',
    fontSize: 10,
    lineHeight: 13,
  },
  pathActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pathNavButtonLabel: {
    color: '#2e3a2e',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    backgroundColor: '#f0f2ee',
  },
  floatingFooterShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
  },
  floatingFooterBar: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e7db',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  footerPrimaryButton: {
    backgroundColor: '#2e6b4b',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryButtonDisabled: {
    backgroundColor: '#b8c7bb',
  },
  footerPrimaryButtonSecondary: {
    backgroundColor: '#eef3ed',
    borderWidth: 1,
    borderColor: '#d9e3d7',
  },
  footerPrimaryButtonLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  footerPrimaryButtonLabelSecondary: {
    color: '#4d6d56',
  },
  footerEditHint: {
    flex: 1,
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  footerEditHintPlaceholder: {
    flex: 1,
  },
  footerSecondaryButton: {
    borderRadius: 12,
    backgroundColor: '#fff4ec',
    paddingVertical: 11,
    paddingHorizontal: 12,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerSecondaryButtonDisabled: {
    opacity: 0.7,
  },
  footerSecondaryButtonLabel: {
    color: '#8a5a3a',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  refreshHint: {
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  helperText: {
    color: '#496149',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#3d2a15',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorBody: {
    color: '#655d4a',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
