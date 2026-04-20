import { Feather } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthGuard } from '@/components/auth-guard';
import { CurrentPositionDistanceSection } from '@/components/current-position-distance-section';
import { DetailOverflowMenu } from '@/components/detail-overflow-menu';
import { FriendsList } from '@/components/friends-list';
import { SkeletonBlock } from '@/components/skeleton';
import { StampNoteSection } from '@/components/stamp-note-section';
import { StampingSuccessToast } from '@/components/stamping-success-toast';
import {
  createStamping,
  deleteStamping,
  type LatestVisitedStamp,
  type MapData,
  type ProfileOverviewData,
  type Stampbox,
  type StampDetailData,
  updateStamping,
  upsertStampNote,
  type VisitStamping,
} from '@/lib/api';
import { useAdminAccess, useAuth, useIdTokenClaims } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import {
  replaceTimelineEntry,
  updateTimelineEntryTimestamp,
  upsertTimelineEntry,
} from '@/lib/profile-timeline';
import { queryKeys, useRouteToStampFromPositionQuery, useStampDetailQuery } from '@/lib/queries';

type IdClaims = {
  sub?: string;
};

type StampsOverviewData = {
  stamps: Stampbox[];
  lastVisited: LatestVisitedStamp | null;
};

type CarouselImageItem = {
  id: string;
  uri: string;
  title: string;
  kind: 'current' | 'nearby';
  subtitle?: string;
  imageCaption?: string;
};

const CAROUSEL_DOUBLE_TAP_DELAY_MS = 280;
const CAROUSEL_ZOOM_SCALE = 2;
const CAROUSEL_PAN_THRESHOLD = 2;
const WEB_CAROUSEL_MIN_HEIGHT = 320;
const WEBSITE_BASE_URL = 'https://www.harzer-wander-buddy.de';
const STAMP_NOTE_MAX_LENGTH = 500;
const emptyNearbyStampsIllustration = require('@/assets/images/buddy/telescope.png');

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return '';
  }

  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function formatDistanceMeters(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return '';
  }

  return formatDistance(distanceMeters / 1000);
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

function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_KM * centralAngle;
}

function estimateDurationMinutes(distanceKm: number) {
  const WALKING_SPEED_KMH = 4.6;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 1;
  }

  return Math.max(1, Math.round((distanceKm / WALKING_SPEED_KMH) * 60));
}

function createOfflineRouteToStampMetrics(distanceKm: number) {
  const safeDistanceKm = Number.isFinite(distanceKm) ? Math.max(distanceKm, 0) : 0;
  const durationMinutes = estimateDurationMinutes(safeDistanceKm);
  return {
    distanceMeters: Math.round(safeDistanceKm * 1000),
    durationSeconds: Math.max(60, durationMinutes * 60),
    elevationGainMeters: 0,
    elevationLossMeters: 0,
  };
}

function formatVisitDate(value?: string) {
  if (!value) {
    return 'Unbekanntes Datum';
  }

  return new Date(value).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getVisitTimestamp(visit: { visitedAt?: string; createdAt?: string }) {
  return visit.visitedAt || visit.createdAt;
}

function getProfileTimelineEntries(profile: ProfileOverviewData) {
  const profileWithTimeline = profile as ProfileOverviewData & { stampings?: ProfileOverviewData['latestVisits'] };
  return Array.isArray(profileWithTimeline.stampings)
    ? profileWithTimeline.stampings
    : profile.latestVisits;
}

function formatEditableVisitDate(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const yyyy = date.getFullYear();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function heroGradient(visited: boolean) {
  return visited
    ? (['#4f8b67', '#79af82', '#d8c88f'] as const)
    : (['#b8bdb1', '#cfd3c8', '#e1d7c5'] as const);
}

function SkeletonLine({
  width,
  height = 14,
}: {
  width: number | `${number}%`;
  height?: number;
}) {
  return <SkeletonBlock height={height} radius={999} width={width} />;
}

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonBadge} />
      <View style={styles.skeletonColumn}>
        <SkeletonLine width="68%" />
        <SkeletonLine height={12} width="44%" />
      </View>
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: React.PropsWithChildren<{
  title: string;
  action?: React.ReactNode;
}>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function StampDetailLoadingState({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.loadingContent} showsVerticalScrollIndicator={false}>
        <View style={styles.loadingHero}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Stempelstelle</Text>
          </View>
        </View>

        <View style={styles.body}>
          <SkeletonBlock height={34} radius={12} tone="strong" width="66%" />
          <View style={styles.descriptionSkeleton}>
            <SkeletonLine width="100%" />
            <SkeletonLine width="84%" />
            <SkeletonLine width="62%" />
          </View>

          <Section title="Stempel in der Naehe">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Section>

          <Section title="Parkplätze in der Nähe">
            <SkeletonRow />
            <SkeletonRow />
          </Section>
        </View>

        <Text style={styles.helperText}>Lade Details aus dem OData-v4-Service...</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StampDetailContent() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<IdClaims>();
  const queryClient = useQueryClient();
  const stampId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: detail, error, isFetching, isPending, isPlaceholderData, refetch } =
    useStampDetailQuery(stampId);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAdminAccess();
  const [isStamping, setIsStamping] = useState(false);
  const [isStampSuccessToastVisible, setIsStampSuccessToastVisible] = useState(false);
  const [isEditingVisits, setIsEditingVisits] = useState(false);
  const [visitDrafts, setVisitDrafts] = useState<Record<string, string>>({});
  const [busyVisitId, setBusyVisitId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const persistedNoteRef = useRef('');
  const recentNoteSaveAtRef = useRef<number | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isImageCarouselVisible, setIsImageCarouselVisible] = useState(false);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [zoomedImageId, setZoomedImageId] = useState<string | null>(null);
  const [webCarouselFailedImageIds, setWebCarouselFailedImageIds] = useState<Record<string, true>>({});
  const [carouselImageViewport, setCarouselImageViewport] = useState({ width: windowWidth, height: windowHeight });
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const carouselListRef = useRef<FlatList<CarouselImageItem> | null>(null);
  const lastCarouselTapRef = useRef<{ timestamp: number; imageId: string | null }>({
    timestamp: 0,
    imageId: null,
  });
  const carouselImagePan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const carouselImagePanOffsetRef = useRef({ x: 0, y: 0 });
  const [pickerState, setPickerState] = useState<{
    visitId: string;
    value: Date;
    mode: 'date' | 'time' | 'datetime';
  } | null>(null);
  const allowLeavingRef = useRef(false);
  const routeToCurrentPositionQuery = useRouteToStampFromPositionQuery(
    stampId,
    userLocation?.latitude,
    userLocation?.longitude
  );

  useEffect(() => {
    if (!detail) {
      return;
    }

    setVisitDrafts(
      Object.fromEntries(detail.myVisits.map((visit) => [visit.ID, getVisitTimestamp(visit) ?? '']))
    );
    const nextPersistedNote = detail.myNote?.note ?? '';
    setNoteDraft((currentDraft) => {
      const previousPersistedNote = persistedNoteRef.current;
      const hasUnsavedLocalChanges = currentDraft.trim() !== previousPersistedNote.trim();
      const protectRecentSaveFromTransientEmpty =
        nextPersistedNote.trim().length === 0 &&
        currentDraft.trim().length > 0 &&
        recentNoteSaveAtRef.current !== null &&
        Date.now() - recentNoteSaveAtRef.current < 15_000;

      persistedNoteRef.current = nextPersistedNote;

      if (hasUnsavedLocalChanges || protectRecentSaveFromTransientEmpty) {
        return currentDraft;
      }

      return nextPersistedNote;
    });
  }, [detail]);

  const handleSaveNote = useCallback(async (): Promise<boolean> => {
    if (!accessToken || !stampId || isSavingNote) {
      return false;
    }

    const normalizedNote = noteDraft.trim();
    const persistedNote = detail?.myNote?.note ?? '';
    if (normalizedNote === persistedNote.trim()) {
      return true;
    }

    if (normalizedNote.length > STAMP_NOTE_MAX_LENGTH) {
      Alert.alert('Notiz zu lang', `Bitte maximal ${STAMP_NOTE_MAX_LENGTH} Zeichen speichern.`);
      return false;
    }

    const stampDetailKey = queryKeys.stampDetail(claims?.sub, stampId);

    try {
      requireOnlineForWrite(canPerformWrites, 'Notizen koennen nur online gespeichert werden.');
      setIsSavingNote(true);

      const savedNote = await upsertStampNote(accessToken, stampId, normalizedNote);
      const persistedNote = {
        ID: savedNote.ID || detail?.myNote?.ID || `note-${stampId}`,
        stamp_ID: savedNote.stamp_ID || stampId,
        note: typeof savedNote.note === 'string' ? savedNote.note : normalizedNote,
        createdAt: savedNote.createdAt || detail?.myNote?.createdAt,
        modifiedAt: savedNote.modifiedAt,
      };

      recentNoteSaveAtRef.current = Date.now();
      persistedNoteRef.current = persistedNote.note;
      setNoteDraft(persistedNote.note);
      queryClient.setQueryData<StampDetailData>(stampDetailKey, (currentDetail) => {
        if (!currentDetail) {
          return currentDetail;
        }

        return {
          ...currentDetail,
          myNote: persistedNote,
        };
      });
      return true;
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return false;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return false;
      }

      Alert.alert(
        'Speichern fehlgeschlagen',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
      return false;
    } finally {
      setIsSavingNote(false);
    }
  }, [
    accessToken,
    canPerformWrites,
    claims?.sub,
    detail?.myNote?.ID,
    detail?.myNote?.createdAt,
    detail?.myNote?.note,
    isSavingNote,
    logout,
    noteDraft,
    queryClient,
    stampId,
  ]);

  async function handleRequestRouteToStamp() {
    if (selectedStampLatitude === null || selectedStampLongitude === null) {
      return;
    }

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setUserLocation(null);
        setLocationState(permission.status === 'denied' ? 'denied' : 'idle');
        return;
      }

      setLocationState('loading');
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setLocationState('granted');
    } catch {
      setUserLocation(null);
      setLocationState('denied');
    }
  }

  async function handleShare() {
    if (!detail) {
      return;
    }

    const shareParams = new URLSearchParams({
      id: detail.stamp.ID,
      title: `Stempelstelle ${detail.stamp.number || '--'} • ${detail.stamp.name}`,
      description: detail.stamp.description?.trim() || 'Stempelstelle im Harz teilen.',
      image: detail.stamp.heroImageUrl || detail.stamp.image || '',
    });
    const shareUrl = `${WEBSITE_BASE_URL}/share/stamp/?${shareParams.toString()}`;

    await Share.share({
      message: `Stempel ${detail.stamp.number || '--'} • ${detail.stamp.name}\n${shareUrl}`,
      url: shareUrl,
      title: `Stempel ${detail.stamp.number || '--'} • ${detail.stamp.name}`,
    });
  }

  async function handleStartNavigation() {
    handleAttemptNavigateAway(() => {
      void (async () => {
        if (!detail?.stamp.latitude || !detail?.stamp.longitude) {
          Alert.alert('Navigation nicht moeglich', 'Diese Stempelstelle hat keine Koordinaten.');
          return;
        }

        const url = `https://www.google.com/maps/search/?api=1&query=${detail.stamp.latitude},${detail.stamp.longitude}`;
        await Linking.openURL(url);
      })();
    });
  }

  function handleShowOnMap() {
    if (!detail?.stamp.ID) {
      return;
    }

    handleAttemptNavigateAway(() => {
      router.push({
        pathname: '/(tabs)/map',
        params: { stampId: detail.stamp.ID },
      } as never);
    });
  }

  async function refreshAfterVisitMutation() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.stampsOverview(claims?.sub),
      exact: true,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.mapData(claims?.sub),
      exact: true,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.profileOverview(claims?.sub),
      exact: true,
    });
  }

  function updateVisitDateCaches(stampingId: string, nextVisitedAt: string) {
    const stampDetailKey = queryKeys.stampDetail(claims?.sub, stampId);
    const profileOverviewKey = queryKeys.profileOverview(claims?.sub);

    queryClient.setQueryData<StampDetailData>(stampDetailKey, (currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        myVisits: currentDetail.myVisits
          .map((visit) =>
            visit.ID === stampingId
              ? {
                  ...visit,
                  visitedAt: nextVisitedAt,
                  createdAt: visit.createdAt || nextVisitedAt,
                }
              : visit
          )
          .sort(
            (left, right) =>
              new Date(right.visitedAt || right.createdAt || 0).getTime() -
              new Date(left.visitedAt || left.createdAt || 0).getTime()
          ),
      };
    });

    queryClient.setQueryData<ProfileOverviewData>(profileOverviewKey, (currentProfileOverview) => {
      if (!currentProfileOverview) {
        return currentProfileOverview;
      }

      const nextStampings = updateTimelineEntryTimestamp(
        getProfileTimelineEntries(currentProfileOverview),
        stampingId,
        nextVisitedAt
      );

      return {
        ...currentProfileOverview,
        stampings: nextStampings,
        latestVisits: nextStampings.slice(0, 3),
      };
    });
  }

  async function handleStampVisit() {
    if (!accessToken || !stampId || isStamping) {
      return;
    }

    const nowIsoTimestamp = new Date().toISOString();
    const optimisticVisitId = `optimistic-${stampId}-${Date.now()}`;
    const stampSnapshot = detail?.stamp ?? null;
    const optimisticVisit: VisitStamping = {
      ID: optimisticVisitId,
      stamp_ID: stampId,
      stamp: {
        ID: stampId,
        number: stampSnapshot?.number || '--',
        name: stampSnapshot?.name || 'Stempelstelle',
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
      stampName: stampSnapshot?.name || 'Stempelstelle',
      visitedAt: nowIsoTimestamp,
    };
    let rollbackOptimisticUpdates = () => undefined;

    setIsStamping(true);

    try {
      requireOnlineForWrite(canPerformWrites, 'Stempeln ist nur online verfuegbar.');

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
              visitedAt: nowIsoTimestamp,
              kind: 'visited-stamp' as const,
            };
          }),
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

        const nextVisitedCount =
          !wasVisited && hasUpdatedStamp
            ? Math.min(currentProfileOverview.totalCount, currentProfileOverview.visitedCount + 1)
            : currentProfileOverview.visitedCount;
        const nextOpenCount = Math.max(0, currentProfileOverview.totalCount - nextVisitedCount);
        const nextCompletionPercent =
          currentProfileOverview.totalCount > 0
            ? Math.round((nextVisitedCount / currentProfileOverview.totalCount) * 100)
            : 0;
        const nextStampings = upsertTimelineEntry(getProfileTimelineEntries(currentProfileOverview), {
          id: optimisticVisitId,
          stampId,
          stampNumber: stampSnapshot?.number,
          stampName: stampSnapshot?.name || 'Stempelstelle',
          visitedAt: nowIsoTimestamp,
          heroImageUrl: stampSnapshot?.heroImageUrl || stampSnapshot?.image,
        });

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

      queryClient.setQueryData<StampDetailData>(stampDetailKey, (currentDetail) => {
        if (!currentDetail) {
          return currentDetail;
        }

        const visitsWithoutOptimistic = currentDetail.myVisits.filter(
          (visit) => visit.ID !== optimisticVisitId
        );
        const hasPersistedVisit = visitsWithoutOptimistic.some((visit) => visit.ID === persistedVisit.ID);
        const nextVisits = hasPersistedVisit
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
      });

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
            stampName: stampSnapshot?.name || 'Stempelstelle',
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

      await queryClient.invalidateQueries();
      queryClient.removeQueries({ type: 'inactive' });
      setIsStampSuccessToastVisible(true);
    } catch (nextError) {
      rollbackOptimisticUpdates();
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

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
  }

  async function handleDeleteVisit(stampingId: string) {
    if (!accessToken || busyVisitId) {
      return;
    }

    try {
      requireOnlineForWrite(canPerformWrites, 'Besuche koennen nur online geloescht werden.');
      setBusyVisitId(stampingId);
      await deleteStamping(accessToken, stampingId);
      await refreshAfterVisitMutation();
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      Alert.alert(
        'Löschen fehlgeschlagen',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    } finally {
      setBusyVisitId(null);
    }
  }

  function confirmDeleteVisit(stampingId: string) {
    if (!canPerformWrites) {
      Alert.alert('Offline', 'Besuche koennen nur online geloescht werden.');
      return;
    }

    Alert.alert(
      'Besuch löschen?',
      'Dieser Besuchseintrag wird dauerhaft entfernt.',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            void handleDeleteVisit(stampingId);
          },
        },
      ]
    );
  }

  async function persistVisitDate(stampingId: string, nextVisitedAt: string) {
    if (!accessToken || busyVisitId) {
      return;
    }

    const currentVisit = detail?.myVisits.find((visit) => visit.ID === stampingId);
    if (!currentVisit || nextVisitedAt === (getVisitTimestamp(currentVisit) ?? '')) {
      return;
    }

    try {
      requireOnlineForWrite(canPerformWrites, 'Besuche koennen nur online bearbeitet werden.');
      setBusyVisitId(stampingId);
      setVisitDrafts((current) => ({
        ...current,
        [stampingId]: nextVisitedAt,
      }));
      const updatedStamping = await updateStamping(accessToken, stampingId, nextVisitedAt);
      updateVisitDateCaches(stampingId, updatedStamping.visitedAt || nextVisitedAt);
      await refreshAfterVisitMutation();
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      Alert.alert(
        'Speichern fehlgeschlagen',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    } finally {
      setBusyVisitId(null);
    }
  }

  function handleToggleVisitEditing() {
    if (!canPerformWrites && !isEditingVisits) {
      Alert.alert('Offline', 'Besuche koennen nur online bearbeitet werden.');
      return;
    }

    setIsEditingVisits((current) => !current);
  }

  function openVisitPicker(visitId: string, currentValue?: string) {
    const initial = currentValue ? new Date(currentValue) : new Date();
    setPickerState({
      visitId,
      value: Number.isNaN(initial.getTime()) ? new Date() : initial,
      mode: Platform.OS === 'ios' ? 'datetime' : 'date',
    });
  }

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (!pickerState) {
      return;
    }

    if (event.type === 'dismissed') {
      setPickerState(null);
      return;
    }

    const nextValue = selectedDate ?? pickerState.value;

    if (Platform.OS === 'ios') {
      setPickerState((current) => (current ? { ...current, value: nextValue } : null));
      return;
    }

    if (pickerState.mode === 'date') {
      setPickerState({
        visitId: pickerState.visitId,
        value: nextValue,
        mode: 'time',
      });
      return;
    }

    void persistVisitDate(pickerState.visitId, nextValue.toISOString());
    setPickerState(null);
  }

  function confirmIosPicker() {
    if (!pickerState) {
      return;
    }

    void persistVisitDate(pickerState.visitId, pickerState.value.toISOString());
    setPickerState(null);
  }

  const selectedStamp = detail?.stamp;
  const persistedNote = detail?.myNote?.note ?? '';
  const normalizedNoteDraft = noteDraft.trim();
  const isNoteTooLong = normalizedNoteDraft.length > STAMP_NOTE_MAX_LENGTH;
  const isNoteDirty = normalizedNoteDraft !== persistedNote.trim();
  const hasUnsavedChanges = isNoteDirty;
  const heroImageUri = selectedStamp?.heroImageUrl?.trim() || selectedStamp?.image?.trim() || '';
  const selectedStampLatitude =
    typeof selectedStamp?.latitude === 'number' && Number.isFinite(selectedStamp.latitude)
      ? selectedStamp.latitude
      : null;
  const selectedStampLongitude =
    typeof selectedStamp?.longitude === 'number' && Number.isFinite(selectedStamp.longitude)
      ? selectedStamp.longitude
      : null;
  const hasSelectedStampCoordinates =
    selectedStampLatitude !== null && selectedStampLongitude !== null;
  const offlineRouteToCurrentPosition = useMemo(() => {
    if (
      !isOffline ||
      !userLocation ||
      selectedStampLatitude === null ||
      selectedStampLongitude === null
    ) {
      return null;
    }

    const distanceKm = haversineDistanceKm(userLocation, {
      latitude: selectedStampLatitude,
      longitude: selectedStampLongitude,
    });

    return createOfflineRouteToStampMetrics(distanceKm);
  }, [isOffline, selectedStampLatitude, selectedStampLongitude, userLocation]);
  const routeToCurrentPosition = routeToCurrentPositionQuery.data ?? offlineRouteToCurrentPosition;
  const hasOfflineRouteFallback = routeToCurrentPositionQuery.data == null && offlineRouteToCurrentPosition !== null;
  const isRouteToCurrentPositionLoading =
    locationState === 'loading' ||
    (hasSelectedStampCoordinates &&
      locationState === 'granted' &&
      routeToCurrentPositionQuery.isPending &&
      !hasOfflineRouteFallback);
  const routeToCurrentPositionError = hasOfflineRouteFallback ? null : routeToCurrentPositionQuery.error;
  const routeToCurrentPositionErrorMessage =
    routeToCurrentPositionError instanceof Error
      ? routeToCurrentPositionError.message
      : 'Route konnte nicht geladen werden.';
  const carouselImages = useMemo(() => {
    if (!detail || !selectedStamp) {
      return [] as CarouselImageItem[];
    }

    const items: CarouselImageItem[] = [];

    if (heroImageUri) {
      items.push({
        id: `stamp-${selectedStamp.ID}`,
        uri: heroImageUri,
        title: `${selectedStamp.number || '--'} • ${selectedStamp.name}`,
        kind: 'current',
        subtitle: 'Aktuelle Stempelstelle',
        imageCaption: selectedStamp.imageCaption?.trim() || undefined,
      });
    }

    for (const neighbor of detail.nearbyStamps) {
      const imageUri = neighbor.heroImageUrl?.trim();
      if (!imageUri) {
        continue;
      }

      items.push({
        id: `nearby-${neighbor.ID}`,
        uri: imageUri,
        title: `${neighbor.number || '--'} • ${neighbor.name}`,
        kind: 'nearby',
        subtitle: 'Stempel in der Naehe',
        imageCaption: neighbor.imageCaption?.trim() || undefined,
      });
    }

    const seenUris = new Set<string>();
    return items.filter((item) => {
      if (seenUris.has(item.uri)) {
        return false;
      }

      seenUris.add(item.uri);
      return true;
    });
  }, [detail, heroImageUri, selectedStamp]);

  const openImageCarousel = useCallback((startIndex = 0) => {
    if (carouselImages.length === 0) {
      return;
    }

    const nextIndex = Math.min(Math.max(0, startIndex), carouselImages.length - 1);
    setActiveCarouselIndex(nextIndex);
    setWebCarouselFailedImageIds({});
    setZoomedImageId(null);
    carouselImagePanOffsetRef.current = { x: 0, y: 0 };
    carouselImagePan.setValue({ x: 0, y: 0 });
    lastCarouselTapRef.current = { timestamp: 0, imageId: null };
    setIsImageCarouselVisible(true);
  }, [carouselImagePan, carouselImages.length]);

  const closeImageCarousel = useCallback(() => {
    setIsImageCarouselVisible(false);
    setActiveCarouselIndex(0);
    setWebCarouselFailedImageIds({});
    setZoomedImageId(null);
    carouselImagePanOffsetRef.current = { x: 0, y: 0 };
    carouselImagePan.setValue({ x: 0, y: 0 });
    lastCarouselTapRef.current = { timestamp: 0, imageId: null };
  }, [carouselImagePan]);

  const goToPreviousCarouselImage = useCallback(() => {
    setActiveCarouselIndex((current) => Math.max(0, current - 1));
  }, []);

  const goToNextCarouselImage = useCallback(() => {
    setActiveCarouselIndex((current) => Math.min(Math.max(0, carouselImages.length - 1), current + 1));
  }, [carouselImages.length]);

  const openCarouselImageInNewTab = useCallback(async () => {
    const activeItem = carouselImages[activeCarouselIndex];
    if (!activeItem?.uri) {
      return;
    }

    try {
      await Linking.openURL(activeItem.uri);
    } catch {
      Alert.alert('Bild konnte nicht geöffnet werden', 'Bitte versuche es später erneut.');
    }
  }, [activeCarouselIndex, carouselImages]);

  const clampCarouselPan = useCallback((x: number, y: number) => {
    const viewportWidth = carouselImageViewport.width || windowWidth;
    const viewportHeight = carouselImageViewport.height || windowHeight;
    const maxX = (viewportWidth * (CAROUSEL_ZOOM_SCALE - 1)) / 2;
    const maxY = (viewportHeight * (CAROUSEL_ZOOM_SCALE - 1)) / 2;
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  }, [carouselImageViewport.height, carouselImageViewport.width, windowHeight, windowWidth]);

  const resetCarouselPan = useCallback(() => {
    carouselImagePanOffsetRef.current = { x: 0, y: 0 };
    carouselImagePan.setValue({ x: 0, y: 0 });
  }, [carouselImagePan]);

  const handleCarouselImageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }

    setCarouselImageViewport((current) => {
      if (Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5) {
        return current;
      }

      return { width, height };
    });
  }, []);

  const handleCarouselImagePress = useCallback((imageId: string, event: GestureResponderEvent) => {
    const tapX = event.nativeEvent.locationX;
    const tapY = event.nativeEvent.locationY;
    const now = Date.now();
    const previousTap = lastCarouselTapRef.current;
    const isDoubleTap =
      previousTap.imageId === imageId &&
      now - previousTap.timestamp <= CAROUSEL_DOUBLE_TAP_DELAY_MS;

    lastCarouselTapRef.current = { timestamp: now, imageId };

    if (!isDoubleTap) {
      return;
    }

    lastCarouselTapRef.current = { timestamp: 0, imageId: null };
    setZoomedImageId((current) => {
      if (current === imageId) {
        resetCarouselPan();
        return null;
      }

      const viewportWidth = carouselImageViewport.width || windowWidth;
      const viewportHeight = carouselImageViewport.height || windowHeight;
      const offsetFromCenterX = tapX - viewportWidth / 2;
      const offsetFromCenterY = tapY - viewportHeight / 2;
      const targetPan = clampCarouselPan(
        -(CAROUSEL_ZOOM_SCALE - 1) * offsetFromCenterX,
        -(CAROUSEL_ZOOM_SCALE - 1) * offsetFromCenterY
      );

      carouselImagePanOffsetRef.current = targetPan;
      carouselImagePan.setValue(targetPan);
      return imageId;
    });
  }, [
    carouselImagePan,
    carouselImageViewport.height,
    carouselImageViewport.width,
    clampCarouselPan,
    resetCarouselPan,
    windowHeight,
    windowWidth,
  ]);

  const carouselPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          zoomedImageId !== null &&
          (Math.abs(gestureState.dx) > CAROUSEL_PAN_THRESHOLD ||
            Math.abs(gestureState.dy) > CAROUSEL_PAN_THRESHOLD),
        onPanResponderMove: (_, gestureState) => {
          if (zoomedImageId === null) {
            return;
          }

          const next = clampCarouselPan(
            carouselImagePanOffsetRef.current.x + gestureState.dx,
            carouselImagePanOffsetRef.current.y + gestureState.dy
          );
          carouselImagePan.setValue(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (zoomedImageId === null) {
            return;
          }

          const next = clampCarouselPan(
            carouselImagePanOffsetRef.current.x + gestureState.dx,
            carouselImagePanOffsetRef.current.y + gestureState.dy
          );
          carouselImagePanOffsetRef.current = next;
          carouselImagePan.setValue(next);
        },
        onPanResponderTerminate: (_, gestureState) => {
          if (zoomedImageId === null) {
            return;
          }

          const next = clampCarouselPan(
            carouselImagePanOffsetRef.current.x + gestureState.dx,
            carouselImagePanOffsetRef.current.y + gestureState.dy
          );
          carouselImagePanOffsetRef.current = next;
          carouselImagePan.setValue(next);
        },
      }),
    [carouselImagePan, clampCarouselPan, zoomedImageId]
  );

  useEffect(() => {
    if (!isImageCarouselVisible) {
      return;
    }

    const nextIndex = Math.min(activeCarouselIndex, Math.max(0, carouselImages.length - 1));
    if (nextIndex !== activeCarouselIndex) {
      setActiveCarouselIndex(nextIndex);
      return;
    }

    requestAnimationFrame(() => {
      carouselListRef.current?.scrollToIndex({ animated: false, index: nextIndex });
    });
  }, [activeCarouselIndex, carouselImages.length, isImageCarouselVisible]);

  const getCarouselScrollIndex = useCallback((offsetX: number) => {
    if (windowWidth <= 0) {
      return 0;
    }

    const nextIndex = Math.round(offsetX / windowWidth);
    return Math.min(Math.max(0, nextIndex), Math.max(0, carouselImages.length - 1));
  }, [carouselImages.length, windowWidth]);

  const handleCarouselScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const boundedIndex = getCarouselScrollIndex(event.nativeEvent.contentOffset.x);
      setActiveCarouselIndex((current) => (current === boundedIndex ? current : boundedIndex));
    },
    [getCarouselScrollIndex]
  );

  const handleCarouselScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const boundedIndex = getCarouselScrollIndex(event.nativeEvent.contentOffset.x);

      if (boundedIndex !== activeCarouselIndex) {
        setZoomedImageId(null);
        resetCarouselPan();
        lastCarouselTapRef.current = { timestamp: 0, imageId: null };
      }

      setActiveCarouselIndex(boundedIndex);
    },
    [activeCarouselIndex, getCarouselScrollIndex, resetCarouselPan]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !isImageCarouselVisible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousCarouselImage();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextCarouselImage();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeImageCarousel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeImageCarousel, goToNextCarouselImage, goToPreviousCarouselImage, isImageCarouselVisible]);

  const showLeaveDialog = useCallback((onDiscard: () => void, onSave: () => void) => {
    Alert.alert(
      'Aenderungen speichern?',
      'Du hast ungespeicherte Aenderungen. Moechtest du speichern oder verwerfen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Verwerfen', style: 'destructive', onPress: onDiscard },
        { text: 'Speichern', onPress: onSave },
      ]
    );
  }, []);

  const handleAttemptNavigateAway = useCallback(
    (action: () => void, options?: { bypassBeforeRemove?: boolean }) => {
      if (isSavingNote) {
        return;
      }

      if (!hasUnsavedChanges) {
        if (options?.bypassBeforeRemove) {
          allowLeavingRef.current = true;
        }
        action();
        return;
      }

      showLeaveDialog(
        () => {
          if (options?.bypassBeforeRemove) {
            allowLeavingRef.current = true;
          }
          action();
        },
        () => {
          void (async () => {
            const saved = await handleSaveNote();
            if (!saved) {
              return;
            }

            if (options?.bypassBeforeRemove) {
              allowLeavingRef.current = true;
            }
            action();
          })();
        }
      );
    },
    [handleSaveNote, hasUnsavedChanges, isSavingNote, showLeaveDialog]
  );

  const handleBack = useCallback(() => {
    handleAttemptNavigateAway(
      () => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace('/(tabs)' as never);
      },
      { bypassBeforeRemove: true }
    );
  }, [handleAttemptNavigateAway, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeavingRef.current) {
        return;
      }

      if (isSavingNote) {
        event.preventDefault();
        return;
      }

      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      showLeaveDialog(
        () => {
          allowLeavingRef.current = true;
          navigation.dispatch(event.data.action);
        },
        () => {
          void (async () => {
            const saved = await handleSaveNote();
            if (!saved) {
              return;
            }

            allowLeavingRef.current = true;
            navigation.dispatch(event.data.action);
          })();
        }
      );
    });

    return unsubscribe;
  }, [handleSaveNote, hasUnsavedChanges, isSavingNote, navigation, showLeaveDialog]);

  if (!stampId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Ungültige Stempelstelle</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isPending && !detail) {
    return <StampDetailLoadingState onBack={handleBack} />;
  }

  if (error && !detail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Details konnten nicht geladen werden</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Keine Detaildaten gefunden</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { stamp } = detail;
  const visited = !!stamp.hasVisited;
  const showDeferredSkeletons = isFetching && isPlaceholderData;
  const activeCarouselItem = carouselImages[activeCarouselIndex] ?? null;
  const isWebCarousel = Platform.OS === 'web';
  const isActiveCarouselImageFailed =
    activeCarouselItem ? Boolean(webCarouselFailedImageIds[activeCarouselItem.id]) : false;
  const showNearbyCarouselPill =
    isImageCarouselVisible && activeCarouselItem?.kind === 'nearby';
  const bottomInset = Math.max(insets.bottom, 0);
  const isPullRefreshing = isFetching && !isPending;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StampingSuccessToast
        message="Stempel erfolgreich gesetzt."
        onHide={() => setIsStampSuccessToastVisible(false)}
        topOffset={insets.top + 10}
        visible={isStampSuccessToastVisible}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 + bottomInset }]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              if (isOffline) {
                Alert.alert('Offline', OFFLINE_REFRESH_MESSAGE);
                return;
              }

              void refetch();
            }}
            refreshing={isPullRefreshing}
            tintColor="#2e6b4b"
          />
        }
        showsVerticalScrollIndicator={false}>
        <LinearGradient colors={heroGradient(visited)} style={styles.hero}>
          {heroImageUri ? (
            <>
              <Image
                cachePolicy="disk"
                contentFit="cover"
                source={buildAuthenticatedImageSource(heroImageUri, accessToken)}
                style={styles.heroImage}
              />
              <View style={styles.heroImageOverlay} />
            </>
          ) : null}
          {carouselImages.length > 0 ? (
            <Pressable
              onPress={() => openImageCarousel(0)}
              style={({ pressed }) => [
                styles.heroImagePressable,
                pressed && styles.heroImagePressablePressed,
              ]}
            />
          ) : null}
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}>
            <Feather color="#1e2a1e" name="arrow-left" size={18} />
          </Pressable>

          <View style={styles.topRightActions}>
            <View style={[styles.statusPill, visited ? styles.statusPillVisited : styles.statusPillOpen]}>
              <Feather
                color={visited ? '#2e6b4b' : '#7a6a4a'}
                name={visited ? 'check' : 'x'}
                size={11}
              />
              <Text
                style={[
                  styles.statusPillLabel,
                  visited ? styles.statusPillLabelVisited : styles.statusPillLabelOpen,
                ]}>
                {visited ? 'Besucht' : 'Unbesucht'}
              </Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareHeaderButton, pressed && styles.topButtonPressed]}>
              <Feather color="#3a4f84" name="share-2" size={14} />
              <Text style={styles.shareHeaderButtonLabel}>Teilen</Text>
            </Pressable>
            {isAdmin ? (
              <DetailOverflowMenu
                actions={[
                  {
                    key: 'edit-stamp',
                    label: 'Bearbeiten',
                    icon: 'edit-2',
                    onPress: () =>
                      handleAttemptNavigateAway(() => {
                        router.push(`/admin/stamps/${stamp.ID}` as never);
                      }),
                  },
                ]}
                topOffset={insets.top + 58}
              />
            ) : null}
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Stempel {stamp.number || '--'}</Text>
          </View>
        </LinearGradient>
        {stamp.imageCaption?.trim() ? (
          <View style={styles.heroCaptionWrap}>
            <Markdown
              style={{
                body: styles.heroCaptionBody,
                paragraph: styles.heroCaptionParagraph,
                text: styles.heroCaptionBody,
                strong: styles.heroCaptionStrong,
                link: styles.heroCaptionLink,
              }}>
              {stamp.imageCaption.trim()}
            </Markdown>
          </View>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{stamp.name}</Text>
          {stamp.description?.trim() ? (
            <Text style={styles.description}>{stamp.description.trim()}</Text>
          ) : showDeferredSkeletons ? (
            <View style={styles.descriptionSkeleton}>
              <SkeletonLine width="100%" />
              <SkeletonLine width="92%" />
              <SkeletonLine width="64%" />
            </View>
          ) : (
            <Text style={styles.description}>Keine Beschreibung fuer diese Stempelstelle verfuegbar.</Text>
          )}

          <StampNoteSection
            isDirty={isNoteDirty}
            isSaving={isSavingNote}
            isTooLong={isNoteTooLong}
            maxLength={STAMP_NOTE_MAX_LENGTH}
            noteDraft={noteDraft}
            noteLength={normalizedNoteDraft.length}
            onChangeNote={setNoteDraft}
            onSave={() => {
              void handleSaveNote();
            }}
          />

          <Section title="Stempel in der Nähe">
            {showDeferredSkeletons ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : detail.nearbyStamps.length > 0 ? (
              detail.nearbyStamps.map((neighbor) => (
                <Pressable
                  key={neighbor.ID}
                  onPress={() =>
                    handleAttemptNavigateAway(() => {
                      router.push(`/stamps/${neighbor.ID}` as never);
                    })
                  }
                  style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}>
                  {neighbor.heroImageUrl ? (
                    <Image
                      cachePolicy="disk"
                      contentFit="cover"
                      source={buildAuthenticatedImageSource(neighbor.heroImageUrl, accessToken)}
                      style={styles.rowArtwork}
                    />
                  ) : (
                    <View style={[styles.rowBadge, styles.rowBadgeStamp]}>
                      <Text style={[styles.rowBadgeLabel, styles.rowBadgeLabelStamp]}>{neighbor.number || '--'}</Text>
                    </View>
                  )}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {neighbor.number || '--'} {'\u2022'} {neighbor.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatDistance(neighbor.distanceKm)}
                      {neighbor.durationMinutes ? ` • ${formatDuration(neighbor.durationMinutes)}` : ''}
                      {formatElevationSummary(neighbor.elevationGainMeters, neighbor.elevationLossMeters)}
                    </Text>
                  </View>
                  <Feather color="#8b957f" name="chevron-right" size={18} />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyNearbyStampsState}>
                <Image
                  contentFit="contain"
                  source={emptyNearbyStampsIllustration}
                  style={styles.emptyNearbyStampsIllustration}
                />
                <Text style={[styles.emptySectionText, styles.emptyNearbyStampsText]}>
                  Keine Stempel in der Nähe gefunden.
                </Text>
              </View>
            )}
          </Section>

          <Section title="Parkplätze in der Nähe">
            {showDeferredSkeletons ? (
              <>
                <SkeletonLine width="86%" />
                <SkeletonLine width="78%" />
                <SkeletonLine width="82%" />
              </>
            ) : detail.nearbyParking.length > 0 ? (
              detail.nearbyParking.map((parking) => (
                <Pressable
                  key={parking.ID}
                  onPress={() =>
                    handleAttemptNavigateAway(() => {
                      router.push(`/parking/${parking.ID}` as never);
                    })
                  }
                  style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}>
                  <View style={[styles.rowBadge, styles.rowBadgeParking]}>
                    <Text style={[styles.rowBadgeLabel, styles.rowBadgeLabelParking]}>P</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{parking.name}</Text>
                    <Text style={styles.rowMeta}>
                      {formatDistance(parking.distanceKm)}
                      {parking.durationMinutes ? ` • ${formatDuration(parking.durationMinutes)}` : ''}
                      {formatElevationSummary(parking.elevationGainMeters, parking.elevationLossMeters)}
                    </Text>
                  </View>
                  <Feather color="#8b957f" name="chevron-right" size={18} />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptySectionText}>Keine Parkplätze in der Nähe gefunden.</Text>
            )}
          </Section>

          <CurrentPositionDistanceSection
            actionLabel="Distanz berechnen"
            errorText={routeToCurrentPositionErrorMessage}
            loadingLineWidths={['72%', '56%']}
            noCoordinatesText="Für diese Stempelstelle liegen keine Koordinaten vor."
            onRequestDistance={() => {
              void handleRequestRouteToStamp();
            }}
            promptText="Tippe auf den Button, um die Distanz und Höhenmeter von deinem aktuellen Standort zur Stempelstelle zu berechnen."
            retryLabel="Erneut versuchen"
            title="Von aktueller Position"
            status={
              !hasSelectedStampCoordinates
                ? 'no-coordinates'
                : locationState === 'idle'
                  ? 'idle'
                  : locationState === 'denied'
                    ? 'denied'
                    : isRouteToCurrentPositionLoading
                      ? 'loading'
                      : routeToCurrentPositionError
                        ? 'error'
                        : routeToCurrentPosition
                          ? 'ready'
                          : 'error'
            }>
            {routeToCurrentPosition ? (
              <View style={styles.routeSummaryCard}>
                <View style={[styles.rowBadge, styles.rowBadgeRoute]}>
                  <Feather color="#b56928" name="map-pin" size={14} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>Aktuelle Position</Text>
                  <Text style={styles.rowMeta}>
                    {formatDistanceMeters(routeToCurrentPosition.distanceMeters)}
                    {formatElevationSummary(
                      routeToCurrentPosition.elevationGainMeters,
                      routeToCurrentPosition.elevationLossMeters
                    )}
                  </Text>
                </View>
                <Pressable
                  disabled={routeToCurrentPositionQuery.isFetching || isOffline}
                  onPress={() => {
                    if (isOffline) {
                      Alert.alert('Offline', OFFLINE_REFRESH_MESSAGE);
                      return;
                    }

                    void routeToCurrentPositionQuery.refetch();
                  }}
                  style={({ pressed }) => [
                    styles.routeRefreshButton,
                    (routeToCurrentPositionQuery.isFetching || isOffline) && styles.routeRefreshButtonDisabled,
                    pressed &&
                    !routeToCurrentPositionQuery.isFetching &&
                    !isOffline &&
                    styles.sectionActionPressed,
                  ]}>
                  <Feather
                    color="#2e3a2e"
                    name={routeToCurrentPositionQuery.isFetching ? 'refresh-cw' : 'rotate-cw'}
                    size={14}
                  />
                </Pressable>
              </View>
            ) : null}
          </CurrentPositionDistanceSection>

          <Section title="Freunde hier gewesen">
            {showDeferredSkeletons ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : detail.friendVisits.length > 0 ? (
              <FriendsList
                items={detail.friendVisits.map((visit) => ({
                  id: visit.id,
                  name: visit.name,
                  image: visit.picture,
                  subtitle: `Zuletzt besucht: ${formatVisitDate(getVisitTimestamp(visit))}`,
                }))}
              />
            ) : (
              <Text style={styles.emptySectionText}>Noch keine Freundesbesuche fuer diese Stelle.</Text>
            )}
          </Section>

          <Section
            title="Meine bisherigen Besuche"
            action={
              detail.myVisits.length > 0 ? (
                <Pressable
                  disabled={!!busyVisitId || !canPerformWrites}
                  onPress={handleToggleVisitEditing}
                  style={({ pressed }) => [
                    styles.sectionAction,
                    (busyVisitId || !canPerformWrites) && styles.visitActionDisabled,
                    pressed && canPerformWrites && styles.sectionActionPressed,
                  ]}>
                  <Text style={styles.sectionActionLabel}>
                    {isEditingVisits ? 'Fertig' : 'Bearbeiten'}
                  </Text>
                </Pressable>
              ) : null
            }>
            {showDeferredSkeletons ? (
              <>
                <SkeletonLine width="72%" />
                <SkeletonLine width="58%" />
              </>
            ) : detail.myVisits.length > 0 ? (
              detail.myVisits.map((visit) => (
                <View key={visit.ID} style={styles.visitCard}>
                  {isEditingVisits ? (
                    <View style={styles.visitInlineRow}>
                      <Pressable
                        disabled={busyVisitId === visit.ID || !canPerformWrites}
                        onPress={() => openVisitPicker(visit.ID, visitDrafts[visit.ID])}
                        style={({ pressed }) => [
                          styles.visitPickerButton,
                          (busyVisitId === visit.ID || !canPerformWrites) && styles.visitActionDisabled,
                          pressed &&
                          busyVisitId !== visit.ID &&
                          canPerformWrites &&
                          styles.sectionActionPressed,
                        ]}>
                        <Text style={styles.visitPickerLabel}>
                          {visitDrafts[visit.ID]
                            ? formatEditableVisitDate(visitDrafts[visit.ID])
                            : 'Zeit waehlen'}
                        </Text>
                        <Feather color="#637062" name="calendar" size={16} />
                      </Pressable>
                      <Pressable
                        disabled={busyVisitId === visit.ID || !canPerformWrites}
                        onPress={() => confirmDeleteVisit(visit.ID)}
                        style={({ pressed }) => [
                          styles.visitActionButton,
                          styles.visitDeleteButton,
                          styles.visitInlineAction,
                          pressed &&
                          busyVisitId !== visit.ID &&
                          canPerformWrites &&
                          styles.sectionActionPressed,
                          (busyVisitId === visit.ID || !canPerformWrites) && styles.visitActionDisabled,
                        ]}>
                        <Text style={styles.visitDeleteLabel}>Löschen</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.simpleItemTitle}>
                      {formatVisitDate(getVisitTimestamp(visit))}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptySectionText}>Du hast diese Stempelstelle noch nicht gestempelt.</Text>
            )}
          </Section>
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.bottomDock, { bottom: 18 + bottomInset }]}>
        <View style={styles.bottomActions}>
          <View style={styles.secondaryButtonRow}>
            <Pressable
              onPress={handleStartNavigation}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryButtonHalf,
                styles.secondaryButtonWithIcon,
                pressed && styles.secondaryButtonPressed,
              ]}>
              <Feather color="#2e3a2e" name="navigation" size={16} />
              <Text style={styles.secondaryButtonLabel}>Navigation starten</Text>
            </Pressable>
            <Pressable
              onPress={handleShowOnMap}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.secondaryButtonHalf,
                styles.secondaryButtonWithIcon,
                pressed && styles.secondaryButtonPressed,
              ]}>
              <Feather color="#2e3a2e" name="map-pin" size={16} />
              <Text style={styles.secondaryButtonLabel}>Auf Karte anzeigen</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={isStamping || !canPerformWrites}
            onPress={handleStampVisit}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.primaryButtonWithIcon,
              (isStamping || !canPerformWrites) && styles.primaryButtonDisabled,
              pressed && !isStamping && canPerformWrites && styles.primaryButtonPressed,
            ]}>
            <Feather color="#f5f3ee" name={visited ? 'refresh-cw' : 'check-circle'} size={16} />
            <Text style={styles.primaryButtonLabel}>
              {isStamping
                ? 'Stemple...'
                : visited
                  ? 'Erneut stempeln'
                  : 'Besuch stempeln'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeImageCarousel}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={isImageCarouselVisible}>
        <View style={styles.carouselScreen}>
          {isWebCarousel ? (
            <View style={styles.webCarouselContent}>
              <View style={styles.webCarouselStage}>
                {activeCarouselItem ? (
                  isActiveCarouselImageFailed ? (
                    <View style={styles.webCarouselFallback}>
                      <Text style={styles.webCarouselFallbackTitle}>Bild konnte nicht geladen werden</Text>
                      <Pressable
                        onPress={() => void openCarouselImageInNewTab()}
                        style={({ pressed }) => [
                          styles.webCarouselFallbackButton,
                          pressed && styles.topButtonPressed,
                        ]}>
                        <Feather color="#b4d6ff" name="external-link" size={14} />
                        <Text style={styles.webCarouselFallbackButtonLabel}>Originalbild öffnen</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Image
                      cachePolicy="disk"
                      contentFit="contain"
                      onError={() => {
                        setWebCarouselFailedImageIds((current) => {
                          if (current[activeCarouselItem.id]) {
                            return current;
                          }

                          return {
                            ...current,
                            [activeCarouselItem.id]: true,
                          };
                        });
                      }}
                      source={buildAuthenticatedImageSource(activeCarouselItem.uri, accessToken)}
                      style={styles.webCarouselImage}
                    />
                  )
                ) : null}
              </View>

              <View style={styles.webCarouselNavRow}>
                <Pressable
                  disabled={activeCarouselIndex <= 0}
                  onPress={goToPreviousCarouselImage}
                  style={({ pressed }) => [
                    styles.webCarouselNavButton,
                    activeCarouselIndex <= 0 && styles.webCarouselNavButtonDisabled,
                    pressed && activeCarouselIndex > 0 && styles.topButtonPressed,
                  ]}>
                  <Feather color="#f5f3ee" name="chevron-left" size={18} />
                  <Text style={styles.webCarouselNavButtonLabel}>Zurück</Text>
                </Pressable>

                <Pressable
                  disabled={activeCarouselIndex >= carouselImages.length - 1}
                  onPress={goToNextCarouselImage}
                  style={({ pressed }) => [
                    styles.webCarouselNavButton,
                    activeCarouselIndex >= carouselImages.length - 1 && styles.webCarouselNavButtonDisabled,
                    pressed && activeCarouselIndex < carouselImages.length - 1 && styles.topButtonPressed,
                  ]}>
                  <Text style={styles.webCarouselNavButtonLabel}>Weiter</Text>
                  <Feather color="#f5f3ee" name="chevron-right" size={18} />
                </Pressable>
              </View>

              {activeCarouselItem ? (
                <View style={styles.carouselCaptionWrap}>
                  <Text style={styles.carouselCaptionTitle}>{activeCarouselItem.title}</Text>
                  {activeCarouselItem.subtitle ? (
                    <Text style={styles.carouselCaptionSubtitle}>{activeCarouselItem.subtitle}</Text>
                  ) : null}
                  {activeCarouselItem.imageCaption ? (
                    <Markdown
                      style={{
                        body: styles.carouselCaptionBody,
                        paragraph: styles.carouselCaptionParagraph,
                        text: styles.carouselCaptionBody,
                        strong: styles.carouselCaptionStrong,
                        link: styles.carouselCaptionLink,
                      }}>
                      {activeCarouselItem.imageCaption}
                    </Markdown>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={carouselImages}
              getItemLayout={(_, index) => ({
                index,
                length: windowWidth,
                offset: windowWidth * index,
              })}
              horizontal
              initialNumToRender={1}
              keyExtractor={(item) => item.id}
              onScroll={handleCarouselScroll}
              onMomentumScrollEnd={handleCarouselScrollEnd}
              pagingEnabled
              ref={carouselListRef}
              scrollEventThrottle={16}
              scrollEnabled={zoomedImageId === null}
              renderItem={({ item }) => (
                <View style={[styles.carouselSlide, { width: windowWidth }]}>
                  <Pressable
                    onLayout={handleCarouselImageLayout}
                    onPress={(event) => handleCarouselImagePress(item.id, event)}
                    style={styles.carouselImagePressable}>
                    <Animated.View
                      style={[
                        styles.carouselImageTransform,
                        zoomedImageId === item.id
                          ? {
                              transform: [
                                { translateX: carouselImagePan.x },
                                { translateY: carouselImagePan.y },
                              ],
                            }
                          : undefined,
                      ]}
                      {...(zoomedImageId === item.id ? carouselPanResponder.panHandlers : {})}>
                      <Animated.View
                        style={[
                          styles.carouselImageScaleLayer,
                          zoomedImageId === item.id
                            ? { transform: [{ scale: CAROUSEL_ZOOM_SCALE }] }
                            : undefined,
                        ]}>
                        <Image
                          cachePolicy="disk"
                          contentFit="contain"
                          source={buildAuthenticatedImageSource(item.uri, accessToken)}
                          style={styles.carouselImage}
                        />
                      </Animated.View>
                    </Animated.View>
                  </Pressable>
                  <View style={styles.carouselCaptionWrap}>
                    <Text style={styles.carouselCaptionTitle}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={styles.carouselCaptionSubtitle}>{item.subtitle}</Text>
                    ) : null}
                    {item.imageCaption ? (
                      <Markdown
                        style={{
                          body: styles.carouselCaptionBody,
                          paragraph: styles.carouselCaptionParagraph,
                          text: styles.carouselCaptionBody,
                          strong: styles.carouselCaptionStrong,
                          link: styles.carouselCaptionLink,
                        }}>
                        {item.imageCaption}
                      </Markdown>
                    ) : null}
                  </View>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
            />
          )}

          <View style={[styles.carouselTopBar, { top: insets.top + 12 }]}>
            <Pressable
              hitSlop={14}
              onPress={closeImageCarousel}
              style={({ pressed }) => [styles.carouselCloseButton, pressed && styles.topButtonPressed]}>
              <Feather color="#f5f3ee" name="x" size={18} />
            </Pressable>
            {showNearbyCarouselPill ? (
              <View style={styles.carouselNearbyPill}>
                <Feather color="#2f7dd7" name="map-pin" size={12} />
                <Text style={styles.carouselNearbyPillLabel}>Stempel in der Nähe</Text>
              </View>
            ) : null}
            <Text style={styles.carouselCounterLabel}>
              {carouselImages.length > 0 ? `${activeCarouselIndex + 1} / ${carouselImages.length}` : '0 / 0'}
            </Text>
          </View>
        </View>
      </Modal>

      {pickerState && Platform.OS === 'ios' ? (
        <Modal animationType="slide" transparent visible>
          <View style={styles.modalScrim}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Besuchszeit wählen</Text>
              <DateTimePicker
                display="spinner"
                mode="datetime"
                onChange={handlePickerChange}
                textColor="#1e2a1e"
                themeVariant="light"
                value={pickerState.value}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setPickerState(null)}
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonSecondary,
                    pressed && styles.sectionActionPressed,
                  ]}>
                  <Text style={styles.modalButtonSecondaryLabel}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  onPress={confirmIosPicker}
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    pressed && styles.sectionActionPressed,
                  ]}>
                  <Text style={styles.modalButtonPrimaryLabel}>Uebernehmen</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {pickerState && Platform.OS === 'android' ? (
        <DateTimePicker
          display="default"
          mode={pickerState.mode}
          onChange={handlePickerChange}
          value={pickerState.value}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function StampDetailScreen() {
  return (
    <AuthGuard>
      <StampDetailContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  scrollContent: {
    paddingBottom: 180,
  },
  loadingContent: {
    paddingBottom: 40,
  },
  loadingHero: {
    height: 240,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: '#d5cfbf',
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  hero: {
    height: 240,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 28, 22, 0.22)',
  },
  heroImagePressable: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImagePressablePressed: {
    backgroundColor: 'rgba(245, 243, 238, 0.08)',
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240,233,221,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButtonPressed: {
    opacity: 0.88,
  },
  topRightActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
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
  statusPill: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  statusPillVisited: {
    backgroundColor: '#e2eee6',
  },
  statusPillOpen: {
    backgroundColor: '#f0e9dd',
  },
  statusPillLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusPillLabelVisited: {
    color: '#2e6b4b',
  },
  statusPillLabelOpen: {
    color: '#7a6a4a',
  },
  heroBadge: {
    position: 'absolute',
    left: 20,
    bottom: 16,
    backgroundColor: '#f5f3ee',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: '#1e2a1e',
    fontSize: 12,
    lineHeight: 16,
  },
  heroCaptionWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  heroCaptionBody: {
    color: '#5a675a',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  heroCaptionParagraph: {
    marginTop: 0,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroCaptionStrong: {
    color: '#2e3a2e',
    fontWeight: '700',
  },
  heroCaptionLink: {
    color: '#2f7dd7',
    textDecorationLine: 'underline',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  descriptionSkeleton: {
    gap: 8,
  },
  title: {
    color: '#1e2a1e',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'serif',
  },
  description: {
    color: '#445244',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  sectionAction: {
    borderRadius: 999,
    backgroundColor: '#eef4ef',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionActionPressed: {
    opacity: 0.82,
  },
  sectionActionLabel: {
    color: '#2e6b4b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowItemPressed: {
    opacity: 0.85,
  },
  rowBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowArtwork: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  rowBadgeStamp: {
    backgroundColor: '#e2eee6',
  },
  rowBadgeParking: {
    backgroundColor: '#e3effc',
  },
  rowBadgeRoute: {
    backgroundColor: '#f7e8db',
  },
  rowBadgeLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowBadgeLabelStamp: {
    color: '#2e6b4b',
  },
  rowBadgeLabelParking: {
    color: '#2f7dd7',
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
  },
  routeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeRefreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eef4ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeRefreshButtonDisabled: {
    opacity: 0.55,
  },
  rowTitle: {
    color: '#111111',
    fontSize: 13,
    lineHeight: 16,
  },
  rowMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  simpleItem: {
    gap: 2,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ece6db',
  },
  skeletonColumn: {
    flex: 1,
    gap: 8,
  },
  visitCard: {
    gap: 8,
  },
  visitInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitPickerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#f5f3ee',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitPickerLabel: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 16,
  },
  visitActionButton: {
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  visitInlineAction: {
    flexShrink: 0,
  },
  visitDeleteButton: {
    backgroundColor: '#efe6d8',
  },
  visitActionDisabled: {
    opacity: 0.5,
  },
  visitDeleteLabel: {
    color: '#6f5e40',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  simpleItemTitle: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  emptySectionText: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyNearbyStampsState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyNearbyStampsIllustration: {
    width: 120,
    height: 120,
  },
  emptyNearbyStampsText: {
    textAlign: 'center',
  },
  bottomDock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  bottomActions: {
    gap: 8,
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    height: 45,
    borderRadius: 14,
    backgroundColor: '#e9e2d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonHalf: {
    flex: 1,
  },
  secondaryButtonWithIcon: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonPressed: {
    opacity: 0.9,
  },
  secondaryButtonLabel: {
    color: '#2e3a2e',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2e6b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonWithIcon: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#7aa287',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  carouselScreen: {
    flex: 1,
    backgroundColor: '#0f1310',
  },
  webCarouselContent: {
    flex: 1,
    paddingTop: 68,
    paddingBottom: 30,
  },
  webCarouselStage: {
    flex: 1,
    minHeight: WEB_CAROUSEL_MIN_HEIGHT,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  webCarouselImage: {
    flex: 1,
    width: '100%',
    minHeight: WEB_CAROUSEL_MIN_HEIGHT,
  },
  webCarouselFallback: {
    flex: 1,
    minHeight: WEB_CAROUSEL_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(29, 38, 31, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(180, 214, 255, 0.22)',
    paddingHorizontal: 16,
  },
  webCarouselFallbackTitle: {
    color: '#f5f3ee',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  webCarouselFallbackButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(180, 214, 255, 0.44)',
    backgroundColor: 'rgba(38, 50, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webCarouselFallbackButtonLabel: {
    color: '#b4d6ff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  webCarouselNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  webCarouselNavButton: {
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(29, 38, 31, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
    minWidth: 110,
  },
  webCarouselNavButtonDisabled: {
    opacity: 0.5,
  },
  webCarouselNavButtonLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  carouselTopBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(29, 38, 31, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselCounterLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(29, 38, 31, 0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  carouselNearbyPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(227, 239, 252, 0.98)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carouselNearbyPillLabel: {
    color: '#2f7dd7',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  carouselSlide: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 68,
    paddingBottom: 30,
  },
  carouselImage: {
    flex: 1,
    width: '100%',
  },
  carouselImagePressable: {
    flex: 1,
    width: '100%',
  },
  carouselImageTransform: {
    flex: 1,
    width: '100%',
  },
  carouselImageScaleLayer: {
    flex: 1,
    width: '100%',
  },
  carouselCaptionWrap: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 6,
  },
  carouselCaptionTitle: {
    color: '#f5f3ee',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  carouselCaptionSubtitle: {
    color: '#ccd5cb',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  carouselCaptionBody: {
    color: '#e6ede4',
    fontSize: 13,
    lineHeight: 18,
  },
  carouselCaptionParagraph: {
    marginTop: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  carouselCaptionStrong: {
    color: '#f5f3ee',
    fontWeight: '700',
  },
  carouselCaptionLink: {
    color: '#b4d6ff',
    textDecorationLine: 'underline',
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(20, 30, 20, 0.26)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fffaf0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  modalTitle: {
    color: '#1e2a1e',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#2e6b4b',
  },
  modalButtonSecondary: {
    backgroundColor: '#e9e2d6',
  },
  modalButtonPrimaryLabel: {
    color: '#f5f3ee',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  modalButtonSecondaryLabel: {
    color: '#2e3a2e',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
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
});
