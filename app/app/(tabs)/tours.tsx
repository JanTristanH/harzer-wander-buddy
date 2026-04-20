import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/skeleton';
import type { Tour } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { getFloatingActionBottomOffset } from '@/lib/tab-bar-layout';
import { useCreateTourMutation, useToursOverviewQuery } from '@/lib/queries';

type FilterKey = 'mine' | 'all';
type SortKey = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';
type ToursListItem =
  | { type: 'controls'; key: 'controls' }
  | { type: 'empty'; key: 'empty' }
  | { type: 'tour'; key: string; tour: Tour };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'mine', label: 'Meine' },
  { key: 'all', label: 'Alle' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Neueste' },
  { key: 'oldest', label: 'Aelteste' },
  { key: 'nameAsc', label: 'Name A-Z' },
  { key: 'nameDesc', label: 'Name Z-A' },
];
const emptySearchIllustration = require('@/assets/images/buddy/telescope.png');
const emptyVisitedIllustration = require('@/assets/images/buddy/emptyNotebook.png');

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

function normalizeUserId(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function resolveCreatedBy(item: Tour, normalizedCurrentUserId: string | null) {
  const createdBy = item.createdBy?.trim();
  const displayName = item.createdByName?.trim();
  const isOwnTour = Boolean(createdBy && normalizeUserId(createdBy) === normalizedCurrentUserId);

  if (isOwnTour) {
    return {
      label: displayName || 'Du',
      isOwnTour: true,
    };
  }

  if (displayName) {
    return {
      label: displayName,
      isOwnTour: false,
    };
  }

  if (!createdBy) {
    return {
      label: 'Unbekannt',
      isOwnTour: false,
    };
  }

  return {
    label: 'Unbekannt',
    isOwnTour: false,
  };
}

function TourCard({
  item,
  onPress,
  normalizedCurrentUserId,
}: {
  item: Tour;
  onPress: () => void;
  normalizedCurrentUserId: string | null;
}) {
  const createdBy = resolveCreatedBy(item, normalizedCurrentUserId);
  const showOwnBadge = createdBy.isOwnTour && createdBy.label !== 'Du';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeaderRow}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.name}
        </Text>
        <Feather
          color="#8b957f"
          name="chevron-right"
          size={18}
          style={styles.cardChevronIcon}
        />
      </View>

      <Text style={styles.cardMeta}>
        {`Stempel gesamt: ${item.stampCount ?? 0} • Neue Stempel fuer mich: ${item.newStampCountForUser ?? 0}`}
      </Text>

      <View style={styles.cardCreatorRow}>
        <Text numberOfLines={1} style={styles.cardCreatorText}>{`Von: ${createdBy.label}`}</Text>
        {showOwnBadge ? (
          <View style={styles.creatorBadge}>
            <Text style={styles.creatorBadgeLabel}>Du</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardMeta}>
        {`${formatDistance(item.distance)} • ${formatDuration(item.duration)}`}
      </Text>

      <View style={styles.cardFooterRow}>
        <Text style={styles.cardFooterText}>
          {`↑${formatElevation(item.totalElevationGain)} • ↓${formatElevation(item.totalElevationLoss)}`}
        </Text>
        <Text style={styles.cardFooterDate}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE') : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ToursTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const floatingActionBottom = getFloatingActionBottomOffset(insets.bottom);
  const { width: windowWidth } = useWindowDimensions();
  const { canPerformWrites, isOffline } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const currentUserId = claims?.sub;
  const normalizedCurrentUserId = useMemo(() => normalizeUserId(currentUserId), [currentUserId]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('mine');
  const [activeSort, setActiveSort] = useState<SortKey>('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { data, error, isPending, isFetching, refetch } = useToursOverviewQuery();
  const createTourMutation = useCreateTourMutation();
  const isCreateDisabled = createTourMutation.isPending || !canPerformWrites;
  const tours = useMemo(() => data ?? [], [data]);
  const sortPopoverWidth = useMemo(() => Math.min(300, Math.max(windowWidth - 32, 0)), [windowWidth]);

  const filteredTours = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tours.filter((tour) => {
      const matchesFilter =
        activeFilter === 'all' ||
        !normalizedCurrentUserId ||
        normalizeUserId(tour.createdBy) === normalizedCurrentUserId;
      if (!matchesFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return tour.name.toLowerCase().includes(normalized);
    });
  }, [activeFilter, normalizedCurrentUserId, query, tours]);

  const sortedTours = useMemo(() => {
    const byCreatedAtDesc = (left: Tour, right: Tour) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;
      const leftHasTime = Number.isFinite(leftTime);
      const rightHasTime = Number.isFinite(rightTime);

      if (leftHasTime && rightHasTime) {
        return rightTime - leftTime;
      }

      if (leftHasTime) {
        return -1;
      }

      if (rightHasTime) {
        return 1;
      }

      return left.name.localeCompare(right.name, 'de-DE');
    };

    const byNameAsc = (left: Tour, right: Tour) => left.name.localeCompare(right.name, 'de-DE');

    const sorted = [...filteredTours];

    sorted.sort((left, right) => {
      if (activeSort === 'oldest') {
        return byCreatedAtDesc(right, left);
      }

      if (activeSort === 'nameAsc') {
        return byNameAsc(left, right);
      }

      if (activeSort === 'nameDesc') {
        return byNameAsc(right, left);
      }

      return byCreatedAtDesc(left, right);
    });

    return sorted;
  }, [activeSort, filteredTours]);
  const listItems = useMemo<ToursListItem[]>(() => {
    const items: ToursListItem[] = [{ type: 'controls', key: 'controls' }];
    if (sortedTours.length === 0) {
      items.push({ type: 'empty', key: 'empty' });
      return items;
    }

    items.push(...sortedTours.map((tour) => ({ type: 'tour' as const, key: tour.ID, tour })));
    return items;
  }, [sortedTours]);

  const blockingError = !data ? error : null;
  const isMineFilter = activeFilter === 'mine';
  const isSearching = query.trim().length > 0;
  const emptyStateTitle = isMineFilter ? 'Keine eigenen Touren gefunden' : 'Keine Touren gefunden';
  const emptyStateCopy = isMineFilter
    ? isSearching
      ? 'Passe die Suche an oder wechsle auf Alle.'
      : 'Erstelle eine neue Tour oder wechsle auf Alle.'
    : 'Passe die Suche an oder erstelle eine neue Tour.';
  const emptyStateIllustration = isMineFilter && !isSearching ? emptyVisitedIllustration : emptySearchIllustration;
  const handleOpenTour = useCallback(
    (tour: Tour) => {
      router.push(`/tours/${encodeURIComponent(tour.ID)}` as never);
    },
    [router]
  );
  const handleOpenTourInEditMode = useCallback(
    (tour: Tour) => {
      router.push({
        pathname: '/tours/[id]',
        params: {
          id: tour.ID,
          edit: '1',
        },
      } as never);
    },
    [router]
  );

  const handleQuickstart = async (options?: { startInEditMode?: boolean }) => {
    try {
      requireOnlineForWrite(canPerformWrites);
      const created = await createTourMutation.mutateAsync({
        name: 'Neue Tour',
        idListTravelTimes: '',
      });

      if (options?.startInEditMode) {
        handleOpenTourInEditMode(created);
        return;
      }

      handleOpenTour(created);
    } catch (nextError) {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      Alert.alert(
        'Tour konnte nicht erstellt werden',
        nextError instanceof Error ? nextError.message : 'Unbekannter Fehler'
      );
    }
  };

  if (isPending && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContent}>
          <View style={styles.headerWrap}>
            <View style={styles.loadingTitleRow}>
              <Text style={styles.title}>Touren</Text>
              <Text style={styles.totalLabel}>-- gesamt</Text>
            </View>

            <Pressable
              accessibilityLabel="Neue Tour planen"
              accessibilityRole="button"
              disabled={isCreateDisabled}
              onPress={() => void handleQuickstart({ startInEditMode: true })}
              style={({ pressed }) => [
                isCreateDisabled && styles.quickstartCardDisabled,
                pressed && styles.pressed,
              ]}>
              <LinearGradient colors={['#3f8158', '#60926f', '#d2c18f']} style={styles.quickstartCard}>
                <Text style={styles.quickstartEyebrow}>Schnellstart</Text>
                <Text style={styles.quickstartTitle}>Neue Tour planen</Text>
                <Text style={styles.quickstartBody}>Leere Tour erstellen und direkt POIs hinzufuegen.</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.loadingSearchRow}>
              <View style={styles.searchShell}>
                <Feather color="#6d7d6e" name="search" size={14} />
                <TextInput
                  editable={false}
                  placeholder="Suche nach Tourname"
                  placeholderTextColor="#7b8776"
                  style={styles.searchInput}
                  value=""
                />
              </View>
              <View style={[styles.sortButton, styles.loadingDisabledControl]}>
                <MaterialIcons name="sort" size={24} color="black" />
                <Text style={styles.sortButtonLabel}>Sortieren</Text>
              </View>
            </View>

            <View style={styles.loadingFilterRow}>
              {FILTERS.map((filter) => (
                <View
                  key={filter.key}
                  style={[styles.filterPill, activeFilter === filter.key && styles.filterPillActive]}>
                  <Text
                    style={[
                      styles.filterPillLabel,
                      activeFilter === filter.key && styles.filterPillLabelActive,
                    ]}>
                    {filter.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.loadingCards}>
            <View style={styles.loadingTourCard}>
              <SkeletonBlock height={20} radius={10} tone="strong" width="58%" />
              <SkeletonBlock height={12} radius={6} width="92%" />
              <SkeletonBlock height={12} radius={6} width="42%" />
              <SkeletonBlock height={12} radius={6} width="64%" />
              <SkeletonBlock height={12} radius={6} width="54%" />
            </View>
            <View style={styles.loadingTourCard}>
              <SkeletonBlock height={20} radius={10} tone="strong" width="46%" />
              <SkeletonBlock height={12} radius={6} width="88%" />
              <SkeletonBlock height={12} radius={6} width="38%" />
              <SkeletonBlock height={12} radius={6} width="58%" />
              <SkeletonBlock height={12} radius={6} width="48%" />
            </View>
          </View>

          <Text style={styles.helperText}>Lade Touren...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (blockingError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Touren konnten nicht geladen werden</Text>
          <Text style={styles.errorBody}>{blockingError.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={listItems}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Touren</Text>
              <Text style={styles.totalLabel}>{`${tours.length} gesamt`}</Text>
            </View>


            <Pressable
              accessibilityLabel="Neue Tour planen"
              accessibilityRole="button"
              disabled={isCreateDisabled}
              onPress={() => void handleQuickstart({ startInEditMode: true })}
              style={({ pressed }) => [
                isCreateDisabled && styles.quickstartCardDisabled,
                pressed && styles.pressed,
              ]}>
              <LinearGradient colors={['#3f8158', '#60926f', '#d2c18f']} style={styles.quickstartCard}>
                <Text style={styles.quickstartEyebrow}>Schnellstart</Text>
                <Text style={styles.quickstartTitle}>Neue Tour planen</Text>
                <Text style={styles.quickstartBody}>Leere Tour erstellen und direkt POIs hinzufuegen.</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void (async () => {
                  setIsPullRefreshing(true);
                  try {
                    if (isOffline) {
                      Alert.alert('Offline', OFFLINE_REFRESH_MESSAGE);
                      return;
                    }
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
        renderItem={({ item }) => {
          if (item.type === 'controls') {
            return (
              <View style={styles.stickyControlsWrap}>
                <View style={styles.searchRow}>
                  <View style={styles.searchShell}>
                    <Feather color="#6d7d6e" name="search" size={14} />
                    <TextInput
                      onChangeText={setQuery}
                      placeholder="Suche nach Tourname"
                      placeholderTextColor="#7b8776"
                      style={styles.searchInput}
                      value={query}
                    />
                  </View>

                  <Pressable
                    onPress={() => setIsSortOpen(true)}
                    style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
                    <MaterialIcons name="sort" size={24} color="black" />
                    <Text style={styles.sortButtonLabel}>Sortieren</Text>
                  </Pressable>
                </View>

                <View style={styles.controlsRow}>
                  <View style={styles.filterRow}>
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
                  </View>
                </View>

                {isFetching ? <Text style={styles.refreshHint}>Aktualisiere Touren im Hintergrund...</Text> : null}
              </View>
            );
          }

          if (item.type === 'empty') {
            return (
              <View style={styles.emptyStateWrap}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
                  <Image contentFit="contain" source={emptyStateIllustration} style={styles.emptyIllustration} />
                  <Text style={styles.emptyCopy}>{emptyStateCopy}</Text>
                </View>
              </View>
            );
          }

          return (
            <View style={styles.cardRow}>
              <TourCard
                item={item.tour}
                normalizedCurrentUserId={normalizedCurrentUserId}
                onPress={() => handleOpenTour(item.tour)}
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      />

      <Pressable
        accessibilityLabel="Neue Tour erstellen"
        disabled={isCreateDisabled}
        onPress={() => void handleQuickstart({ startInEditMode: true })}
        style={({ pressed }) => [
          styles.floatingAddButton,
          { bottom: floatingActionBottom },
          isCreateDisabled && styles.floatingAddButtonDisabled,
          pressed && styles.pressed,
        ]}>
        <Feather color="#F5F3EE" name="plus" size={24} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setIsSortOpen(false)} transparent visible={isSortOpen}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setIsSortOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sortPopover, { top: insets.top + 72, width: sortPopoverWidth }]}>
            <Text style={styles.sortTitle}>Sortieren</Text>
            <Text style={styles.sortSectionLabel}>Reihenfolge</Text>
            <View style={styles.sortChipRow}>
              {SORT_OPTIONS.map((sort) => {
                const isActive = activeSort === sort.key;

                return (
                  <Pressable
                    key={sort.key}
                    onPress={() => {
                      setActiveSort(sort.key);
                      setIsSortOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.sortChip,
                      isActive && styles.sortChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.sortChipLabel, isActive && styles.sortChipLabelActive]}>
                      {sort.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
  listContent: {
    paddingTop: 20,
    paddingBottom: 220,
  },
  loadingContent: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 14,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  stickyControlsWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: '#f5f3ee',
  },
  loadingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingDisabledControl: {
    opacity: 0.8,
  },
  loadingFilterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  loadingCards: {
    gap: 12,
    paddingHorizontal: 20,
  },
  loadingTourCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
    gap: 6,
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
  quickstartCard: {
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
  quickstartCardDisabled: {
    opacity: 0.7,
  },
  quickstartEyebrow: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickstartTitle: {
    color: '#f5f3ee',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  quickstartBody: {
    color: '#f5f3ee',
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.9,
  },
  searchShell: {
    flex: 1,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ebe5d7',
  },
  filterPillActive: {
    backgroundColor: '#2e6b4b',
  },
  filterPillPressed: {
    opacity: 0.85,
  },
  filterPillLabel: {
    color: '#526452',
    fontSize: 12,
    lineHeight: 16,
  },
  filterPillLabelActive: {
    color: '#f5f3ee',
    fontWeight: '700',
  },
  sortButton: {
    width: 108,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  sortButtonLabel: {
    color: '#1e2a1e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,30,20,0.16)',
  },
  sortPopover: {
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
  sortTitle: {
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  sortSectionLabel: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sortChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    borderRadius: 999,
    backgroundColor: '#f2f0ea',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortChipActive: {
    backgroundColor: '#2e6b4b',
  },
  sortChipLabel: {
    color: '#4a574a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  sortChipLabelActive: {
    color: '#f5f3ee',
  },
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: '#2E6B4B',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    width: 52,
  },
  floatingAddButtonDisabled: {
    opacity: 0.7,
  },
  cardRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141e14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    color: '#1e2a1e',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  cardChevronIcon: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  cardMeta: {
    color: '#6b7a6b',
    fontSize: 12,
    lineHeight: 16,
  },
  cardCreatorText: {
    color: '#5d6f5d',
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  cardCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorBadge: {
    backgroundColor: '#2e6b4b',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  creatorBadgeLabel: {
    color: '#f5f3ee',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFooterDate: {
    color: '#445244',
    fontSize: 11,
    lineHeight: 14,
  },
  cardFooterText: {
    color: '#445244',
    fontSize: 12,
    lineHeight: 16,
  },
  cardFooterTextMuted: {
    color: '#8b957f',
    fontSize: 11,
    lineHeight: 14,
  },
  refreshHint: {
    color: '#4d6d56',
    fontSize: 13,
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
  emptyStateWrap: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: '#fffaf0',
    borderRadius: 22,
    padding: 20,
    gap: 8,
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
  pressed: {
    opacity: 0.85,
  },
});
