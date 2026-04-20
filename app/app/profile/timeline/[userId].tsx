import { Feather } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileErrorState, ProfileLoadingState } from '@/components/profile-view';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { buildAuthenticatedImageSource } from '@/lib/images';
import { groupTimelineEntriesByDay, trimTimelineEntries } from '@/lib/profile-timeline';
import { useProfileOverviewQuery, useUserProfileOverviewQuery } from '@/lib/queries';

type TimelineClaims = {
  sub?: string;
};

const FAST_SCROLLER_HIDE_DELAY_MS = 850;
const FAST_SCROLLER_THUMB_HEIGHT = 44;
const FAST_SCROLLER_PREVIEW_HEIGHT = 38;

function formatVisitDate(value?: string) {
  if (!value) {
    return 'Unbekanntes Datum';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unbekanntes Datum';
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} • ${hh}:${min}`;
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyToDate(dayKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatJumpDate(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function findClosestDayKey(targetDate: Date, keys: string[]) {
  let closestKey = '';
  let closestDistance = Number.POSITIVE_INFINITY;
  const targetTime = targetDate.getTime();

  for (const key of keys) {
    const keyDate = dayKeyToDate(key);
    if (!keyDate) {
      continue;
    }

    const distance = Math.abs(keyDate.getTime() - targetTime);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestKey = key;
    }
  }

  return closestKey || null;
}

export default function ProfileTimelineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const requestedUserId = userIdParam ? decodeURIComponent(userIdParam) : '';
  const claims = useIdTokenClaims<TimelineClaims>();
  const { accessToken } = useAuth();
  const isSelf = requestedUserId === 'self' || (Boolean(claims?.sub) && requestedUserId === claims?.sub);
  const selfProfileQuery = useProfileOverviewQuery();
  const userProfileQuery = useUserProfileOverviewQuery(
    !isSelf && requestedUserId ? requestedUserId : undefined
  );

  const activeData = isSelf ? selfProfileQuery.data : userProfileQuery.data;
  const isPending = isSelf ? selfProfileQuery.isPending : userProfileQuery.isPending;
  const isFetching = isSelf ? selfProfileQuery.isFetching : userProfileQuery.isFetching;
  const activeError = isSelf ? selfProfileQuery.error : userProfileQuery.error;
  const refetch = isSelf ? selfProfileQuery.refetch : userProfileQuery.refetch;
  const profileName = activeData?.name || 'Profil';
  const timelineEntries = useMemo(
    () => trimTimelineEntries(activeData?.stampings ?? []),
    [activeData?.stampings]
  );
  const groupedTimeline = useMemo(
    () => groupTimelineEntriesByDay(timelineEntries),
    [timelineEntries]
  );
  const groupedDayKeys = useMemo(() => groupedTimeline.map((group) => group.dayKey), [groupedTimeline]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [jumpHint, setJumpHint] = useState('');
  const [pendingJumpDayKey, setPendingJumpDayKey] = useState<string | null>(null);
  const [previewDayIndex, setPreviewDayIndex] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [trackHeight, setTrackHeight] = useState(0);
  const [topControlsHeight, setTopControlsHeight] = useState(0);
  const [isFastScrollerVisible, setIsFastScrollerVisible] = useState(false);
  const [isThumbDragging, setIsThumbDragging] = useState(false);
  const [thumbRatioOverride, setThumbRatioOverride] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const dayOffsetMapRef = useRef<Record<string, number>>({});
  const hideFastScrollerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateRange = useMemo(() => {
    if (groupedDayKeys.length === 0) {
      return { min: undefined, max: undefined };
    }

    const parsedDates = groupedDayKeys
      .map((key) => dayKeyToDate(key))
      .filter((value): value is Date => value instanceof Date);

    if (parsedDates.length === 0) {
      return { min: undefined, max: undefined };
    }

    const sortedByTime = [...parsedDates].sort((a, b) => a.getTime() - b.getTime());
    return {
      min: sortedByTime[0],
      max: sortedByTime[sortedByTime.length - 1],
    };
  }, [groupedDayKeys]);

  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const hasScrollableTimeline = groupedTimeline.length > 0 && maxScrollY > 0;
  const previewRatio =
    groupedDayKeys.length > 1 ? (previewDayIndex - 1) / (groupedDayKeys.length - 1) : 0;
  const thumbHeight = FAST_SCROLLER_THUMB_HEIGHT;
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const effectiveThumbRatio =
    thumbRatioOverride !== null ? Math.max(0, Math.min(1, thumbRatioOverride)) : previewRatio;
  const thumbTop = effectiveThumbRatio * thumbTravel;
  const previewTop = Math.max(
    0,
    Math.min(
      Math.max(0, trackHeight - FAST_SCROLLER_PREVIEW_HEIGHT),
      thumbTop + thumbHeight / 2 - FAST_SCROLLER_PREVIEW_HEIGHT / 2
    )
  );
  const scrollerOpacity = isFastScrollerVisible || isThumbDragging ? 1 : 0;
  const fastScrollerTopInset = 14 + topControlsHeight;

  const formatPreviewLabel = useCallback((dayKey: string | null | undefined) => {
    if (!dayKey) {
      return '';
    }

    if (dayKey === 'without-date') {
      return 'Ohne Datum';
    }

    const date = dayKeyToDate(dayKey);
    return date ? formatJumpDate(date) : dayKey;
  }, []);
  const previewDayKey =
    groupedDayKeys.length > 0
      ? groupedDayKeys[Math.max(0, Math.min(groupedDayKeys.length - 1, previewDayIndex - 1))]
      : null;
  const previewLabel = formatPreviewLabel(previewDayKey);

  const clearFastScrollerHideTimeout = useCallback(() => {
    if (!hideFastScrollerTimeoutRef.current) {
      return;
    }

    clearTimeout(hideFastScrollerTimeoutRef.current);
    hideFastScrollerTimeoutRef.current = null;
  }, []);

  const showFastScroller = useCallback(() => {
    if (!hasScrollableTimeline) {
      return;
    }

    clearFastScrollerHideTimeout();
    setIsFastScrollerVisible(true);
  }, [clearFastScrollerHideTimeout, hasScrollableTimeline]);

  const scheduleFastScrollerHide = useCallback(() => {
    clearFastScrollerHideTimeout();
    hideFastScrollerTimeoutRef.current = setTimeout(() => {
      setIsFastScrollerVisible(false);
    }, FAST_SCROLLER_HIDE_DELAY_MS);
  }, [clearFastScrollerHideTimeout]);

  const scrollToDayKey = useCallback((dayKey: string, animated = true) => {
    const y = dayOffsetMapRef.current[dayKey];
    if (!Number.isFinite(y)) {
      return false;
    }

    scrollRef.current?.scrollTo({ y: Math.max(0, y - 6), animated });
    const nextDayIndex = groupedDayKeys.indexOf(dayKey);
    if (nextDayIndex >= 0) {
      const nextPreviewIndex = nextDayIndex + 1;
      setPreviewDayIndex((current) => (current === nextPreviewIndex ? current : nextPreviewIndex));
    }
    return true;
  }, [groupedDayKeys]);

  const updatePreviewFromOffset = useCallback(
    (offsetY: number) => {
      if (groupedDayKeys.length === 0) {
        setPreviewDayIndex(1);
        return;
      }

      const anchor = Math.max(0, offsetY + 12);
      let nextDayIndex = 0;
      let hasMeasuredOffsets = false;

      for (const [dayIndex, dayKey] of groupedDayKeys.entries()) {
        const y = dayOffsetMapRef.current[dayKey];
        if (!Number.isFinite(y)) {
          continue;
        }
        hasMeasuredOffsets = true;

        if (y <= anchor) {
          nextDayIndex = dayIndex;
          continue;
        }

        break;
      }

      if (!hasMeasuredOffsets && maxScrollY > 0) {
        const ratio = Math.max(0, Math.min(1, offsetY / maxScrollY));
        nextDayIndex = Math.min(groupedDayKeys.length - 1, Math.floor(ratio * groupedDayKeys.length));
      }

      const nextPreviewIndex = nextDayIndex + 1;
      setPreviewDayIndex((current) => (current === nextPreviewIndex ? current : nextPreviewIndex));
    },
    [groupedDayKeys, maxScrollY]
  );

  const updateScrollFromTouch = useCallback(
    (touchY: number) => {
      if (!hasScrollableTimeline || trackHeight <= 0 || groupedDayKeys.length === 0) {
        return;
      }

      const clampedTouchY = Math.max(0, Math.min(trackHeight, touchY));
      const ratio = clampedTouchY / trackHeight;
      const targetIndex = Math.max(
        0,
        Math.min(groupedDayKeys.length - 1, Math.round(ratio * (groupedDayKeys.length - 1)))
      );
      const targetDayKey = groupedDayKeys[targetIndex];

      if (targetDayKey && !scrollToDayKey(targetDayKey, false)) {
        scrollRef.current?.scrollTo({ y: maxScrollY * ratio, animated: false });
      }

      const nextPreviewIndex = targetIndex + 1;
      setPreviewDayIndex((current) => (current === nextPreviewIndex ? current : nextPreviewIndex));
      setThumbRatioOverride(ratio);
    },
    [groupedDayKeys, hasScrollableTimeline, maxScrollY, scrollToDayKey, trackHeight]
  );

  const fastScrollerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          hasScrollableTimeline && (Math.abs(gestureState.dy) > 1 || Math.abs(gestureState.dx) > 1),
        onPanResponderGrant: (event) => {
          if (!hasScrollableTimeline) {
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
        onStartShouldSetPanResponder: () => hasScrollableTimeline,
      }),
    [hasScrollableTimeline, scheduleFastScrollerHide, showFastScroller, updateScrollFromTouch]
  );

  const jumpToDate = useCallback(
    (nextDate: Date) => {
      if (groupedDayKeys.length === 0) {
        setJumpHint('Keine Besuche vorhanden.');
        return;
      }

      const requestedDayKey = toDayKey(nextDate);
      const exactMatch = groupedDayKeys.includes(requestedDayKey) ? requestedDayKey : null;
      const targetDayKey = exactMatch || findClosestDayKey(nextDate, groupedDayKeys);
      if (!targetDayKey) {
        setJumpHint('Kein passender Eintrag gefunden.');
        return;
      }

      if (!scrollToDayKey(targetDayKey)) {
        setPendingJumpDayKey(targetDayKey);
      }

      if (targetDayKey === requestedDayKey) {
        setJumpHint(`Gesprungen zu ${formatJumpDate(nextDate)}.`);
      } else {
        const resolvedDate = dayKeyToDate(targetDayKey);
        setJumpHint(
          `Kein Eintrag am ${formatJumpDate(nextDate)}. Gesprungen zu ${
            resolvedDate ? formatJumpDate(resolvedDate) : targetDayKey
          }.`
        );
      }
    },
    [groupedDayKeys, scrollToDayKey]
  );

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, value?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }

      if (event.type === 'dismissed' || !value) {
        return;
      }

      setSelectedDate(value);
      jumpToDate(value);
    },
    [jumpToDate]
  );

  React.useEffect(() => {
    return () => {
      clearFastScrollerHideTimeout();
    };
  }, [clearFastScrollerHideTimeout]);

  React.useEffect(() => {
    if (groupedDayKeys.length === 0) {
      setPreviewDayIndex(1);
      return;
    }

    setPreviewDayIndex((current) => Math.max(1, Math.min(groupedDayKeys.length, current)));
  }, [groupedDayKeys.length]);

  React.useEffect(() => {
    if (hasScrollableTimeline) {
      return;
    }

    clearFastScrollerHideTimeout();
    setIsFastScrollerVisible(false);
    setIsThumbDragging(false);
    setThumbRatioOverride(null);
  }, [clearFastScrollerHideTimeout, hasScrollableTimeline]);

  if (!requestedUserId) {
    return (
      <ProfileErrorState
        body="Keine Benutzer-ID uebergeben."
        title="Timeline konnte nicht geladen werden"
      />
    );
  }

  if (isPending && !activeData) {
    return <ProfileLoadingState label="Timeline wird geladen..." />;
  }

  if (!activeData) {
    return (
      <ProfileErrorState
        body={activeError?.message || 'Keine Daten verfuegbar.'}
        title="Timeline konnte nicht geladen werden"
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.timelineContainer}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
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
            const nextY = Math.max(0, nativeEvent.contentOffset.y);
            if (!isThumbDragging) {
              updatePreviewFromOffset(nextY);
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
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refetch();
              }}
              refreshing={isFetching && !isPending}
              tintColor="#2e6b4b"
            />
          }
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          <View
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              setTopControlsHeight((current) => (Math.abs(current - nextHeight) < 0.5 ? current : nextHeight));
            }}
            style={styles.topControlsWrap}>
            <View style={styles.headerCard}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Feather color="#1e2a1e" name="arrow-left" size={16} />
              </Pressable>
              <View style={styles.headerBody}>
                <Text style={styles.title}>Timeline</Text>
                <Text style={styles.subtitle}>{profileName} • Alle Besuche</Text>
              </View>
            </View>

            <View style={styles.jumpCard}>
              <Text style={styles.jumpTitle}>Zu einem Datum springen</Text>
              <Pressable
                disabled={groupedTimeline.length === 0}
                onPress={() => setShowDatePicker((current) => !current)}
                style={({ pressed }) => [
                  styles.jumpButton,
                  groupedTimeline.length === 0 && styles.jumpButtonDisabled,
                  pressed && groupedTimeline.length > 0 && styles.pressed,
                ]}>
                <View style={styles.jumpButtonContent}>
                  <Feather color="#2e6b4b" name="calendar" size={15} />
                  <Text style={styles.jumpButtonLabel}>{formatJumpDate(selectedDate)}</Text>
                </View>
                <Feather color="#2e6b4b" name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} />
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={dateRange.max}
                  minimumDate={dateRange.min}
                  mode="date"
                  onChange={handleDateChange}
                  value={selectedDate}
                />
              ) : null}
              {jumpHint ? <Text style={styles.jumpHint}>{jumpHint}</Text> : null}
            </View>
          </View>

          {groupedTimeline.length > 0 ? (
            groupedTimeline.map((group) => (
              <View
                key={group.dayKey}
                onLayout={(event) => {
                  dayOffsetMapRef.current[group.dayKey] = event.nativeEvent.layout.y;
                  if (pendingJumpDayKey === group.dayKey && scrollToDayKey(group.dayKey)) {
                    setPendingJumpDayKey(null);
                  }
                }}
                style={styles.daySection}>
                <Text style={styles.dayLabel}>
                  {group.title} {'\u2022'} {group.items.length} {group.items.length === 1 ? 'Besuch' : 'Besuche'}
                </Text>
                {group.items.map((visit) => {
                  const disabled = !visit.stampId;
                  return (
                    <Pressable
                      key={visit.id}
                      disabled={disabled}
                      onPress={() => {
                        if (visit.stampId) {
                          router.push(`/stamps/${visit.stampId}` as never);
                        }
                      }}
                      style={({ pressed }) => [styles.rowCard, pressed && !disabled && styles.pressed]}>
                      {visit.heroImageUrl ? (
                        <Image
                          cachePolicy="disk"
                          contentFit="cover"
                          source={buildAuthenticatedImageSource(visit.heroImageUrl, accessToken)}
                          style={styles.rowArtwork}
                        />
                      ) : (
                        <View style={styles.rowArtworkFallback} />
                      )}
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle}>
                          {visit.stampNumber || '--'} {'\u2022'} {visit.stampName}
                        </Text>
                        <Text style={styles.rowSubtitle}>{formatVisitDate(visit.visitedAt)}</Text>
                      </View>
                      {!disabled ? <Feather color="#2e6b4b" name="chevron-right" size={18} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Noch keine Besuche in der Timeline.</Text>
            </View>
          )}
        </ScrollView>
        {hasScrollableTimeline ? (
          <View pointerEvents="box-none" style={[styles.fastScrollerOverlay, { top: fastScrollerTopInset }]}>
            <View style={styles.fastScrollerRail}>
              <View
                onLayout={(event) => {
                  setTrackHeight(event.nativeEvent.layout.height);
                }}
                pointerEvents="none"
                style={[styles.fastScrollerTrack, { opacity: scrollerOpacity }]}>
                <View style={[styles.fastScrollerThumb, { height: thumbHeight, top: thumbTop }]} />
              </View>
              {scrollerOpacity > 0 ? (
                <View pointerEvents="none" style={[styles.fastScrollerPreview, { top: previewTop }]}>
                  <Text numberOfLines={1} style={styles.fastScrollerPreviewText}>
                    {previewLabel}
                  </Text>
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
    backgroundColor: '#f2efe8',
  },
  timelineContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    paddingBottom: 120,
  },
  topControlsWrap: {
    gap: 12,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0e9dd',
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#1e2a1e',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
  },
  jumpCard: {
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
  jumpTitle: {
    color: '#1e2a1e',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  jumpButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#f0e9dd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  jumpButtonDisabled: {
    opacity: 0.65,
  },
  jumpButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jumpButtonLabel: {
    color: '#2e6b4b',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  jumpHint: {
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
  },
  daySection: {
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
  dayLabel: {
    color: '#4d6d56',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8f6f1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowArtwork: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  rowArtworkFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#dde9df',
  },
  rowBody: {
    flex: 1,
    minWidth: 1,
  },
  rowTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyText: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  fastScrollerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 18,
    width: 118,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fastScrollerRail: {
    width: 118,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  fastScrollerTrack: {
    width: 4,
    height: '100%',
    marginRight: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(46, 107, 75, 0.2)',
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
    width: 42,
  },
  fastScrollerPreview: {
    position: 'absolute',
    right: 34,
    minWidth: 96,
    height: FAST_SCROLLER_PREVIEW_HEIGHT,
    borderRadius: 11,
    backgroundColor: 'rgba(30, 42, 30, 0.92)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastScrollerPreviewText: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.84,
  },
});
