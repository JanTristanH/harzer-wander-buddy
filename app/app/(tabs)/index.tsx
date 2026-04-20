import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/skeleton';
import { StampListItem } from '@/components/stamp-list-item';
import { useFilteredStampsOverviewQuery } from '@/lib/queries';

type FilterKey = 'all' | 'visited' | 'open' | 'near' | 'relocated';
type LocationState = 'idle' | 'loading' | 'granted' | 'denied';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'visited', label: 'Besucht' },
  { key: 'open', label: 'Unbesucht' },
  { key: 'near', label: 'In der Nähe' },
  { key: 'relocated', label: 'Verlegt' },
];

const NEARBY_DISTANCE_KM = 15;
const LIST_TOP_PADDING = 20;
const LIST_BOTTOM_PADDING = 220;
const KNOWN_STAMP_ROW_HEIGHT = 112;
const DEFAULT_INTRO_HEIGHT = 220;
const DEFAULT_CONTROLS_HEIGHT = 124;
const STAMP_LIST_START_INDEX = 2;
const FAST_SCROLLER_HIDE_DELAY_MS = 850;
const FAST_SCROLLER_THUMB_HEIGHT = 44;
const FAST_SCROLLER_TRACK_HEIGHT = 580;
const emptySearchIllustration = require('@/assets/images/buddy/telescope.png');
const emptyVisitedIllustration = require('@/assets/images/buddy/emptyNotebook.png');

function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude?: number; longitude?: number }
) {
  if (typeof to.latitude !== 'number' || typeof to.longitude !== 'number') {
    return null;
  }

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

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return '';
  }

  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

function formatVisitDate(value?: string) {
  if (!value) {
    return 'Unbekanntes Datum';
  }

  return new Date(value).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isRelocatedStamp(validTo?: string) {
  if (!validTo) {
    return false;
  }

  const validToTimestamp = Date.parse(validTo);
  if (!Number.isFinite(validToTimestamp)) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return validToTimestamp < startOfToday;
}

export default function StampsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [introHeight, setIntroHeight] = useState(DEFAULT_INTRO_HEIGHT);
  const [controlsHeight, setControlsHeight] = useState(DEFAULT_CONTROLS_HEIGHT);
  const [isFastScrollerVisible, setIsFastScrollerVisible] = useState(false);
  const [isThumbDragging, setIsThumbDragging] = useState(false);
  const [thumbRatioOverride, setThumbRatioOverride] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState(1);
  const backendFilter: 'validToday' | 'all' | 'visited' | 'open' | 'relocated' =
    activeFilter === 'relocated' ? 'relocated' : 'validToday';
  const { data, error, isFetching, isPending, refetch } = useFilteredStampsOverviewQuery(backendFilter);
  const listRef = React.useRef<FlatList<unknown> | null>(null);
  const hideFastScrollerTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stamps = data?.stamps ?? [];
  const lastVisited = data?.lastVisited ?? null;
  const isRefreshing = isFetching && !isPending;
  const blockingError = !data ? error : null;

  useEffect(() => {
    let isMounted = true;

    async function loadLocation() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
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

  const stampDistances = stamps.map((stamp) => ({
    stamp,
    distanceKm: userLocation ? haversineDistanceKm(userLocation, stamp) : null,
  }));

  const visitedCount = stamps.filter((stamp) => stamp.hasVisited).length;
  const totalCount = stamps.length;
  const progressPercent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredStamps = stampDistances.filter(({ stamp, distanceKm }) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      stamp.name.toLowerCase().includes(normalizedQuery) ||
      (stamp.number || '').toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (activeFilter === 'visited') {
      return !!stamp.hasVisited;
    }

    if (activeFilter === 'open') {
      return !stamp.hasVisited;
    }

    if (activeFilter === 'near') {
      return distanceKm !== null && distanceKm <= NEARBY_DISTANCE_KM;
    }

    if (activeFilter === 'relocated') {
      return isRelocatedStamp(stamp.validTo);
    }

    return true;
  });
  const isVisitedEmptyState = activeFilter === 'visited' && visitedCount === 0;
  const isNearEmptyState = activeFilter === 'near' && filteredStamps.length === 0;
  const emptyStateTitle = isVisitedEmptyState
    ? 'Noch keine Stempelstellen besucht'
    : isNearEmptyState
      ? 'Keine Stempelstellen in der Nähe'
      : 'Keine passenden Stempelstellen';
  const emptyStateCopy = isVisitedEmptyState
    ? 'Sobald du deine erste Stempelstelle besuchst, erscheint sie hier.'
    : isNearEmptyState
      ? locationState === 'granted'
        ? `Im Umkreis von ${NEARBY_DISTANCE_KM} km wurden keine Stempelstellen gefunden.`
        : `Aktiviere deinen Standort, dann suchen wir im Umkreis von ${NEARBY_DISTANCE_KM} km.`
      : 'Probier eine andere Suche oder waehle einen anderen Filter.';
  const emptyStateIllustration = isVisitedEmptyState ? emptyVisitedIllustration : emptySearchIllustration;

  type ListEntry =
    | { type: 'intro'; key: 'intro' }
    | { type: 'controls'; key: 'controls' }
    | { type: 'empty'; key: 'empty' }
    | {
        type: 'stamp';
        key: string;
        stampIndex: number;
        stampItem: (typeof filteredStamps)[number];
      };

  const listItems: ListEntry[] = [{ type: 'intro', key: 'intro' }, { type: 'controls', key: 'controls' }];

  if (filteredStamps.length === 0) {
    listItems.push({ type: 'empty', key: 'empty' });
  } else {
    filteredStamps.forEach((stampItem, stampIndex) => {
      listItems.push({
        type: 'stamp',
        key: `stamp-${stampItem.stamp.ID}`,
        stampIndex,
        stampItem,
      });
    });
  }
  const headerHeight = LIST_TOP_PADDING + introHeight + controlsHeight;
  const stampStartOffset = LIST_TOP_PADDING + introHeight;
  const estimatedContentHeight =
    headerHeight + filteredStamps.length * KNOWN_STAMP_ROW_HEIGHT + LIST_BOTTOM_PADDING;
  const maxScrollY = Math.max(0, Math.max(contentHeight, estimatedContentHeight) - viewportHeight);
  const hasScrollableList = filteredStamps.length > 0 && maxScrollY > 0;
  const trackHeight = FAST_SCROLLER_TRACK_HEIGHT;
  const fastScrollerTopInset = LIST_TOP_PADDING + controlsHeight;
  const previewRatio =
    filteredStamps.length > 1 ? (previewIndex - 1) / (filteredStamps.length - 1) : 0;
  const thumbHeight = FAST_SCROLLER_THUMB_HEIGHT;
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const effectiveThumbRatio =
    thumbRatioOverride !== null ? Math.max(0, Math.min(1, thumbRatioOverride)) : previewRatio;
  const thumbTop = effectiveThumbRatio * thumbTravel;
  const previewTop = Math.max(0, Math.min(Math.max(0, trackHeight - 42), thumbTop + thumbHeight / 2 - 21));
  const scrollerOpacity = isFastScrollerVisible || isThumbDragging ? 1 : 0;

  const clearFastScrollerHideTimeout = React.useCallback(() => {
    if (!hideFastScrollerTimeoutRef.current) {
      return;
    }

    clearTimeout(hideFastScrollerTimeoutRef.current);
    hideFastScrollerTimeoutRef.current = null;
  }, []);

  const showFastScroller = React.useCallback(() => {
    if (!hasScrollableList) {
      return;
    }

    clearFastScrollerHideTimeout();
    setIsFastScrollerVisible(true);
  }, [clearFastScrollerHideTimeout, hasScrollableList]);

  const scheduleFastScrollerHide = React.useCallback(() => {
    clearFastScrollerHideTimeout();
    hideFastScrollerTimeoutRef.current = setTimeout(() => {
      setIsFastScrollerVisible(false);
    }, FAST_SCROLLER_HIDE_DELAY_MS);
  }, [clearFastScrollerHideTimeout]);

  const updatePreviewFromRatio = React.useCallback((ratio: number) => {
    if (filteredStamps.length === 0) {
      return;
    }

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const zeroBasedIndex = Math.min(
      filteredStamps.length - 1,
      Math.floor(clampedRatio * filteredStamps.length)
    );
    const nextIndex = zeroBasedIndex + 1;
    setPreviewIndex(nextIndex);
  }, [filteredStamps.length]);

  const updatePreviewFromOffset = React.useCallback((offsetY: number) => {
    if (filteredStamps.length === 0) {
      return;
    }

    const adjustedOffset = Math.max(0, offsetY - stampStartOffset);
    const zeroBasedIndex = Math.floor(adjustedOffset / KNOWN_STAMP_ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(filteredStamps.length - 1, zeroBasedIndex));
    const nextIndex = clamped + 1;
    setPreviewIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [filteredStamps.length, stampStartOffset]);

  const updateScrollFromTouch = React.useCallback(
    (touchY: number) => {
      if (!hasScrollableList || trackHeight <= 0) {
        return;
      }

      const clampedTouchY = Math.max(0, Math.min(trackHeight, touchY));
      const ratio = clampedTouchY / trackHeight;
      const targetStampIndex = Math.max(
        0,
        Math.min(filteredStamps.length - 1, Math.floor(ratio * filteredStamps.length))
      );
      const targetListIndex = targetStampIndex + STAMP_LIST_START_INDEX;
      listRef.current?.scrollToIndex({
        animated: false,
        index: targetListIndex,
        viewOffset: controlsHeight,
      });
      setThumbRatioOverride(ratio);

      updatePreviewFromRatio(ratio);
    },
    [
      controlsHeight,
      filteredStamps.length,
      hasScrollableList,
      trackHeight,
      updatePreviewFromRatio,
    ]
  );

  const fastScrollerPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => hasScrollableList && Math.abs(gestureState.dy) > 1,
        onPanResponderGrant: (event) => {
          if (!hasScrollableList) {
            return;
          }

          showFastScroller();
          setIsThumbDragging(true);
          updateScrollFromTouch(event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          updateScrollFromTouch(event.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          setIsThumbDragging(false);
          setThumbRatioOverride(null);
          scheduleFastScrollerHide();
        },
        onPanResponderTerminate: () => {
          setIsThumbDragging(false);
          setThumbRatioOverride(null);
          scheduleFastScrollerHide();
        },
        onStartShouldSetPanResponder: () => hasScrollableList,
      }),
    [hasScrollableList, scheduleFastScrollerHide, showFastScroller, updateScrollFromTouch]
  );

  useEffect(() => {
    return () => {
      clearFastScrollerHideTimeout();
    };
  }, [clearFastScrollerHideTimeout]);

  useEffect(() => {
    if (filteredStamps.length === 0) {
      setPreviewIndex(1);
      return;
    }

    setPreviewIndex((current) => Math.max(1, Math.min(filteredStamps.length, current)));
  }, [filteredStamps.length]);

  useEffect(() => {
    if (hasScrollableList) {
      return;
    }

    clearFastScrollerHideTimeout();
    setIsFastScrollerVisible(false);
    setIsThumbDragging(false);
    setThumbRatioOverride(null);
  }, [clearFastScrollerHideTimeout, hasScrollableList]);

  const renderIntro = () => (
    <View style={styles.introContent}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Stempelstellen</Text>
        <Text style={styles.totalLabel}>{totalCount} gesamt</Text>
      </View>

      <LinearGradient colors={['#3f8158', '#60926f', '#d2c18f']} style={styles.progressCard}>
        <Text style={styles.progressEyebrow}>Dein Fortschritt</Text>
        <Text style={styles.progressTitle}>
          {visitedCount} von {totalCount} Stempelstellen
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <Text style={styles.progressHint}>
          {lastVisited
            ? `Letzter Besuch: Stempel ${lastVisited.stampNumber || '--'} • ${lastVisited.stampName} • ${formatVisitDate(lastVisited.visitedAt)}`
            : 'Noch keine besuchten Stempelstellen'}
        </Text>
      </LinearGradient>

      {isRefreshing ? <Text style={styles.refreshHint}>Aktualisiere Daten im Hintergrund...</Text> : null}
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsContent}>
      <View style={styles.searchShell}>
        <View style={styles.searchIconWrap}>
          <Feather color="#6d7d6e" name="search" size={14} />
        </View>
        <TextInput
          onChangeText={setQuery}
          placeholder="Suche nach Nummer oder Ort"
          placeholderTextColor="#7b8776"
          style={styles.searchInput}
          value={query}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.filterRow}
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={({ pressed }) => [
                styles.filterPill,
                isActive && styles.filterPillActive,
                pressed && styles.filterPillPressed,
              ]}>
              <Text style={[styles.filterPillLabel, isActive && styles.filterPillLabelActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeFilter === 'near' && locationState !== 'granted' ? (
        <Text style={styles.filterHint}>
          Standortfreigabe fehlt. Aktiviere sie im Onboarding oder in den Systemeinstellungen.
        </Text>
      ) : null}
    </View>
  );

  if (isPending && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIntro}>
            <View style={styles.loadingTitleRow}>
              <Text style={styles.title}>Stempelstellen</Text>
              <Text style={styles.totalLabel}>-- gesamt</Text>
            </View>
            <LinearGradient colors={['#3f8158', '#60926f', '#d2c18f']} style={styles.loadingProgressCard}>
              <SkeletonBlock height={14} radius={7} width="34%" />
              <SkeletonBlock height={24} radius={12} tone="strong" width="64%" />
              <SkeletonBlock height={8} radius={999} tone="muted" width="100%" />
              <SkeletonBlock height={12} radius={6} width="76%" />
            </LinearGradient>
          </View>

          <View style={styles.loadingControls}>
            <View style={styles.searchShell}>
              <View style={styles.searchIconWrap}>
                <Feather color="#6d7d6e" name="search" size={14} />
              </View>
              <TextInput
                editable={false}
                placeholder="Suche nach Nummer oder Ort"
                placeholderTextColor="#7b8776"
                style={styles.searchInput}
                value=""
              />
            </View>
            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              style={styles.filterScroll}
              showsHorizontalScrollIndicator={false}>
              {FILTERS.map((filter) => (
                <View
                  key={filter.key}
                  style={[
                    styles.filterPill,
                    activeFilter === filter.key && styles.filterPillActive,
                  ]}>
                  <Text
                    style={[
                      styles.filterPillLabel,
                      activeFilter === filter.key && styles.filterPillLabelActive,
                    ]}>
                    {filter.label}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.loadingCards}>
            <View style={styles.loadingStampCard}>
              <SkeletonBlock height={64} radius={14} width={64} />
              <View style={styles.loadingStampBody}>
                <SkeletonBlock height={18} radius={9} tone="strong" width="68%" />
                <SkeletonBlock height={12} radius={6} width="88%" />
                <SkeletonBlock height={12} radius={6} width="62%" />
              </View>
            </View>
            <View style={styles.loadingStampCard}>
              <SkeletonBlock height={64} radius={14} width={64} />
              <View style={styles.loadingStampBody}>
                <SkeletonBlock height={18} radius={9} tone="strong" width="54%" />
                <SkeletonBlock height={12} radius={6} width="74%" />
                <SkeletonBlock height={12} radius={6} width="66%" />
              </View>
            </View>
            <View style={styles.loadingStampCard}>
              <SkeletonBlock height={64} radius={14} width={64} />
              <View style={styles.loadingStampBody}>
                <SkeletonBlock height={18} radius={9} tone="strong" width="61%" />
                <SkeletonBlock height={12} radius={6} width="78%" />
                <SkeletonBlock height={12} radius={6} width="58%" />
              </View>
            </View>
          </View>

          <Text style={styles.helperText}>Lade Stempelstellen aus dem OData-v4-Service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (blockingError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Stempelstellen konnten nicht geladen werden</Text>
          <Text style={styles.errorBody}>{blockingError.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.listContainer}>
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.key}
          onContentSizeChange={(_, height) => {
            setContentHeight(height);
          }}
          onLayout={(event) => {
            setViewportHeight(event.nativeEvent.layout.height);
          }}
          onMomentumScrollBegin={() => {
            showFastScroller();
            clearFastScrollerHideTimeout();
          }}
          onMomentumScrollEnd={() => {
            if (!isThumbDragging) {
              scheduleFastScrollerHide();
            }
          }}
          onScroll={({ nativeEvent }) => {
            if (!isThumbDragging) {
              updatePreviewFromOffset(nativeEvent.contentOffset.y);
            }
          }}
          onScrollBeginDrag={() => {
            showFastScroller();
          }}
          onScrollEndDrag={() => {
            if (!isThumbDragging) {
              scheduleFastScrollerHide();
            }
          }}
          renderItem={({ item }) => {
            if (item.type === 'intro') {
              return (
                <View
                  onLayout={(event) => {
                    const nextHeight = event.nativeEvent.layout.height;
                    setIntroHeight((current) =>
                      Math.abs(current - nextHeight) < 0.5 ? current : nextHeight
                    );
                  }}
                  style={styles.introWrap}>
                  {renderIntro()}
                </View>
              );
            }

            if (item.type === 'controls') {
              return (
                <View
                  onLayout={(event) => {
                    const nextHeight = event.nativeEvent.layout.height;
                    setControlsHeight((current) =>
                      Math.abs(current - nextHeight) < 0.5 ? current : nextHeight
                    );
                  }}
                  style={styles.controlsWrap}>
                  {renderControls()}
                </View>
              );
            }

            if (item.type === 'empty') {
              return (
                <View style={styles.emptyStateWrap}>
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
                    <Image
                      contentFit="contain"
                      source={emptyStateIllustration}
                      style={styles.emptyIllustration}
                    />
                    <Text style={styles.emptyCopy}>{emptyStateCopy}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View style={styles.stampRow}>
                <StampListItem
                  index={item.stampIndex}
                  item={item.stampItem.stamp}
                  metaLabel={formatDistance(item.stampItem.distanceKm)}
                  onPress={() => router.push(`/stamps/${item.stampItem.stamp.ID}` as never)}
                />
              </View>
            );
          }}
          getItemLayout={(_, index) => {
            if (index === 0) {
              return { index, length: introHeight, offset: 0 };
            }

            if (index === 1) {
              return { index, length: controlsHeight, offset: introHeight };
            }

            return {
              index,
              length: KNOWN_STAMP_ROW_HEIGHT,
              offset: headerHeight + (index - STAMP_LIST_START_INDEX) * KNOWN_STAMP_ROW_HEIGHT,
            };
          }}
          onScrollToIndexFailed={(info) => {
            const fallbackOffset =
              stampStartOffset + Math.max(0, info.index - STAMP_LIST_START_INDEX) * KNOWN_STAMP_ROW_HEIGHT;
            listRef.current?.scrollToOffset({
              animated: false,
              offset: Math.min(maxScrollY, fallbackOffset),
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                animated: false,
                index: info.index,
                viewOffset: controlsHeight,
              });
            }, 64);
          }}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void (async () => {
                  setIsPullRefreshing(true);
                  try {
                    await refetch();
                  } finally {
                    setIsPullRefreshing(false);
                  }
                })();
              }}
              refreshing={isPullRefreshing}
              tintColor="#2e6b4b"
            />
          }
          scrollEventThrottle={16}
          stickyHeaderIndices={[1]}
          updateCellsBatchingPeriod={50}
          windowSize={9}
          scrollIndicatorInsets={{ bottom: 160 }}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
        {hasScrollableList ? (
          <View pointerEvents="box-none" style={[styles.fastScrollerOverlay, { top: fastScrollerTopInset }]}>
            <View style={styles.fastScrollerRail}>
              <View
                pointerEvents="none"
                style={[styles.fastScrollerTrack, { opacity: scrollerOpacity }]}>
                <View style={[styles.fastScrollerThumb, { height: thumbHeight, top: thumbTop }]} />
              </View>
              {scrollerOpacity > 0 ? (
                <View pointerEvents="none" style={[styles.fastScrollerPreview, { top: previewTop }]}>
                  <Text style={styles.fastScrollerPreviewText}>{previewIndex}</Text>
                </View>
              ) : null}
              <View {...fastScrollerPanResponder.panHandlers} style={styles.fastScrollerTouchArea} />
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  listContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: LIST_TOP_PADDING,
    paddingBottom: LIST_BOTTOM_PADDING,
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 14,
  },
  loadingIntro: {
    gap: 12,
  },
  loadingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingProgressCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  loadingControls: {
    gap: 10,
  },
  loadingCards: {
    gap: 12,
  },
  loadingStampCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  loadingStampBody: {
    flex: 1,
    gap: 8,
  },
  introWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  introContent: {
    gap: 12,
  },
  controlsWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#f5f3ee',
  },
  controlsContent: {
    gap: 12,
  },
  stampRow: {
    height: KNOWN_STAMP_ROW_HEIGHT,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#1e2a1e',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'serif',
  },
  totalLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  progressCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  progressEyebrow: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: '#f5f3ee',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f5f3ee',
  },
  progressPercent: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
  },
  progressHint: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.9,
  },
  refreshHint: {
    color: '#4d6d56',
    fontSize: 13,
    marginTop: 12,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  searchIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#2e3a2e',
    fontSize: 13,
    lineHeight: 16,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  filterScroll: {
    height: 40,
  },
  filterPill: {
    height: 32,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#2e6b4b',
  },
  filterPillPressed: {
    opacity: 0.85,
  },
  filterPillLabel: {
    color: '#2e3a2e',
    fontSize: 12,
    lineHeight: 16,
  },
  filterPillLabelActive: {
    color: '#f5f3ee',
  },
  filterHint: {
    color: '#7f6a43',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
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
  emptyState: {
    backgroundColor: '#fffaf0',
    borderRadius: 22,
    padding: 20,
    gap: 8,
  },
  emptyStateWrap: {
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#2e3a2e',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    color: '#6b7a6b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    alignSelf: 'center',
  },
  fastScrollerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 176,
    width: 74,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fastScrollerRail: {
    width: 74,
    height: FAST_SCROLLER_TRACK_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  fastScrollerTrack: {
    width: 4,
    height: FAST_SCROLLER_TRACK_HEIGHT,
    marginRight: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(46, 107, 75, 0.18)',
  },
  fastScrollerThumb: {
    position: 'absolute',
    left: -4,
    width: 12,
    borderRadius: 999,
    backgroundColor: '#2e6b4b',
  },
  fastScrollerTouchArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 40,
  },
  fastScrollerPreview: {
    position: 'absolute',
    right: 30,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 42, 30, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastScrollerPreviewText: {
    color: '#f5f3ee',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
