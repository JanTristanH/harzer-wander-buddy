import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FriendsList } from '@/components/friends-list';
import { SkeletonBlock, SkeletonCircle } from '@/components/skeleton';
import { Fonts } from '@/constants/theme';
import {
  acceptPendingFriendshipRequest,
  createFriendRequest,
  removeFriendship,
  searchUsers,
  type SearchUserResult,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { getFloatingActionBottomOffset } from '@/lib/tab-bar-layout';
import { queryKeys, useFriendsOverviewQuery } from '@/lib/queries';

type FriendFilter = 'friends' | 'requests' | 'sent';

const FILTER_LABELS: Record<FriendFilter, string> = {
  friends: 'Meine Freunde',
  requests: 'Anfragen',
  sent: 'Gesendet',
};
const emptyFriendsIllustration = require('@/assets/images/buddy/waitingOnBench.png');
const emptyRequestsIllustration = require('@/assets/images/buddy/checkingEmptyMail.png');
const emptySentIllustration = require('@/assets/images/buddy/onBenchWithLetter.png');
const waitlistUrl = 'https://www.harzer-wander-buddy.de/app-waitlist';

function FriendFilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({
  title,
  body,
  image,
  ctaLabel,
  ctaIconName,
  onCtaPress,
}: {
  title: string;
  body: string;
  image?: number;
  ctaLabel?: string;
  ctaIconName?: React.ComponentProps<typeof Feather>['name'];
  onCtaPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {image ? <Image contentFit="contain" source={image} style={styles.emptyIllustration} /> : null}
      <Text style={styles.emptyBody}>{body}</Text>
      {ctaLabel && onCtaPress ? (
        <Pressable onPress={onCtaPress} style={({ pressed }) => [styles.emptyCtaButton, pressed && styles.pressed]}>
          <Feather color="#F5F3EE" name={ctaIconName ?? 'search'} size={16} />
          <Text style={styles.emptyCtaLabel}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FriendFilter>('friends');
  const [acceptingPendingRequestId, setAcceptingPendingRequestId] = useState<string | null>(null);
  const [recallingFriendshipId, setRecallingFriendshipId] = useState<string | null>(null);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const { data, error, isFetching, isPending, refetch } = useFriendsOverviewQuery();
  const isRefreshing = isFetching && !isPending;
  const blockingError = !data ? error : null;
  const floatingActionBottom = getFloatingActionBottomOffset(insets.bottom);

  useEffect(() => {
    if (!isSearchModalVisible) {
      return;
    }

    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    if (!accessToken || isOffline) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchUsers(accessToken, normalizedQuery);
          if (cancelled) {
            return;
          }

          setSearchResults(results);
          setSearchError(null);
        } catch (nextError) {
          if (cancelled) {
            return;
          }

          setSearchError(nextError instanceof Error ? nextError.message : 'Unknown error');
          setSearchResults([]);
        } finally {
          if (!cancelled) {
            setIsSearchLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, isOffline, isSearchModalVisible, searchQuery]);

  const requestsLabel = `Anfragen (${data?.incomingRequestCount ?? 0})`;
  const sentLabel = `Gesendet${data && data.outgoingRequestCount > 0 ? ` (${data.outgoingRequestCount})` : ''}`;

  const sentRequestIds = useMemo(() => new Set((data?.outgoingRequests ?? []).map((item) => item.userId)), [data]);
  const receivedRequestIds = useMemo(
    () => new Set((data?.incomingRequests ?? []).map((item) => item.userId)),
    [data]
  );
  const friendIds = useMemo(() => new Set((data?.friends ?? []).map((item) => item.id)), [data]);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearchLoading(false);
    setSubmittingUserId(null);
  }, []);

  const handleSearchModalShow = useCallback(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  const handleSearchProfilePress = useCallback(
    (userId: string) => {
      closeSearchModal();
      requestAnimationFrame(() => {
        router.push(`/profile/${encodeURIComponent(userId)}` as never);
      });
    },
    [closeSearchModal, router]
  );

  const handleAcceptRequest = useCallback(
    async (pendingRequestId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        requireOnlineForWrite(canPerformWrites);
        setAcceptingPendingRequestId(pendingRequestId);
        await acceptPendingFriendshipRequest(accessToken, pendingRequestId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.friendsOverview(claims?.sub) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
        ]);
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
          'Anfrage konnte nicht bestaetigt werden',
          nextError instanceof Error ? nextError.message : 'Unknown error'
        );
      } finally {
        setAcceptingPendingRequestId(null);
      }
    },
    [accessToken, canPerformWrites, claims?.sub, logout, queryClient]
  );

  const handleCreateRequest = useCallback(
    async (userId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        requireOnlineForWrite(canPerformWrites);
        setSubmittingUserId(userId);
        await createFriendRequest(accessToken, userId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.friendsOverview(claims?.sub) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
        ]);
        setSearchResults((current) => current.slice());
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
          'Anfrage konnte nicht gesendet werden',
          nextError instanceof Error ? nextError.message : 'Unknown error'
        );
      } finally {
        setSubmittingUserId(null);
      }
    },
    [accessToken, canPerformWrites, claims?.sub, logout, queryClient]
  );

  const handleRecallRequest = useCallback(
    (friendshipId: string) => {
      if (!accessToken) {
        return;
      }

      Alert.alert(
        'Anfrage zurueckrufen?',
        'Diese gesendete Freundschaftsanfrage wird zurueckgezogen.',
        [
          {
            text: 'Abbrechen',
            style: 'cancel',
          },
          {
            text: 'Zurueckrufen',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  requireOnlineForWrite(canPerformWrites);
                  setRecallingFriendshipId(friendshipId);
                  await removeFriendship(accessToken, friendshipId);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: queryKeys.friendsOverview(claims?.sub) }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
                  ]);
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
                    'Anfrage konnte nicht zurueckgerufen werden',
                    nextError instanceof Error ? nextError.message : 'Unknown error'
                  );
                } finally {
                  setRecallingFriendshipId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [accessToken, canPerformWrites, claims?.sub, logout, queryClient]
  );

  const handleInviteFriends = useCallback(async () => {
    try {
      await Share.share({
        message: `Komm mit in die Harzer Wander Buddy App und sammle Stempel zusammen.\n${waitlistUrl}`,
        title: 'Harzer Wander Buddy',
        url: waitlistUrl,
      });
    } catch (nextError) {
      Alert.alert(
        'Teilen nicht moeglich',
        nextError instanceof Error ? nextError.message : 'Unknown error'
      );
    }
  }, []);

  const searchListItems = useMemo(
    () =>
      searchResults.map((result) => {
        const status: 'request' | 'sent' | 'received' | 'friend' | 'self' =
          result.id === data?.currentUserId
            ? 'self'
            : friendIds.has(result.id) || result.isFriend
              ? 'friend'
              : receivedRequestIds.has(result.id)
                ? 'received'
                : sentRequestIds.has(result.id)
                  ? 'sent'
                  : 'request';

        return {
          id: result.id,
          image: result.picture,
          name: result.name,
          onPress: () => handleSearchProfilePress(result.id),
          subtitle: `${result.visitedCount} Stempel • ${result.completionPercent}%`,
          actionLabel:
            status === 'sent'
              ? 'Gesendet'
              : status === 'received'
                ? 'Erhalten'
                : status === 'friend'
                  ? 'Verbunden'
                  : status === 'self'
                    ? 'Du'
                    : 'Anfrage',
          actionMuted: status !== 'request',
          actionDisabled: status !== 'request' || submittingUserId === result.id || !canPerformWrites,
          onActionPress: () => void handleCreateRequest(result.id),
        };
      }),
    [
      data?.currentUserId,
      friendIds,
      handleCreateRequest,
      handleSearchProfilePress,
      receivedRequestIds,
      searchResults,
      sentRequestIds,
      submittingUserId,
      canPerformWrites,
    ]
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
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
              tintColor="#2E6B4B"
            />
          }
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Freunde</Text>

          <View style={styles.filterRow}>
            <FriendFilterChip
              active={activeFilter === 'friends'}
              label={FILTER_LABELS.friends}
              onPress={() => setActiveFilter('friends')}
            />
            <FriendFilterChip
              active={activeFilter === 'requests'}
              label={requestsLabel}
              onPress={() => setActiveFilter('requests')}
            />
            <FriendFilterChip
              active={activeFilter === 'sent'}
              label={sentLabel}
              onPress={() => setActiveFilter('sent')}
            />
          </View>

          {isRefreshing ? <Text style={styles.refreshHint}>Aktualisiere Daten im Hintergrund...</Text> : null}

          {isPending && !data ? (
            <View style={styles.loadingShell}>
              <View style={styles.loadingCardsColumn}>
                <View style={styles.loadingFriendCard}>
                  <SkeletonCircle size={44} tone="muted" />
                  <View style={styles.loadingFriendCopy}>
                    <SkeletonBlock height={16} radius={8} tone="strong" width="58%" />
                    <SkeletonBlock height={12} radius={6} width="44%" />
                  </View>
                </View>
                <View style={styles.loadingFriendCard}>
                  <SkeletonCircle size={44} tone="muted" />
                  <View style={styles.loadingFriendCopy}>
                    <SkeletonBlock height={16} radius={8} tone="strong" width="52%" />
                    <SkeletonBlock height={12} radius={6} width="38%" />
                  </View>
                </View>
                <View style={styles.loadingFriendCard}>
                  <SkeletonCircle size={44} tone="muted" />
                  <View style={styles.loadingFriendCopy}>
                    <SkeletonBlock height={16} radius={8} tone="strong" width="62%" />
                    <SkeletonBlock height={12} radius={6} width="41%" />
                  </View>
                </View>
              </View>

              <Text style={styles.helperText}>Freunde werden geladen...</Text>
            </View>
          ) : null}

          {!isPending && blockingError ? (
            <EmptyState title="Freunde konnten nicht geladen werden" body={blockingError.message} />
          ) : null}

          {!isPending && !blockingError && activeFilter === 'friends' ? (
            data && data.friends.length > 0 ? (
              <FriendsList
                items={data.friends.map((friend) => ({
                  id: friend.id,
                  image: friend.picture,
                  name: friend.name,
                  onPress: () => router.push(`/profile/${encodeURIComponent(friend.id)}` as never),
                  subtitle: `${friend.visitedCount} Stempel • ${friend.completionPercent}%`,
                }))}
              />
            ) : (
              <EmptyState
                title="Noch keine Freunde"
                body="Sobald du Freunde verbunden hast, erscheinen sie hier mit ihrem Fortschritt."
                ctaLabel="Freunde hinzufügen"
                image={emptyFriendsIllustration}
                onCtaPress={() => setIsSearchModalVisible(true)}
              />
            )
          ) : null}

          {!isPending && !blockingError && activeFilter === 'requests' ? (
            data && data.incomingRequests.length > 0 ? (
              <FriendsList
                items={data.incomingRequests.map((request) => ({
                  id: request.id,
                  image: request.picture,
                  name: request.name,
                  onPress: () => router.push(`/profile/${encodeURIComponent(request.userId)}` as never),
                  subtitle: 'Moechte mit dir wandern',
                  actionLabel: acceptingPendingRequestId === request.pendingRequestId ? '...' : 'Annehmen',
                  actionDisabled:
                    acceptingPendingRequestId === request.pendingRequestId || !canPerformWrites,
                  onActionPress: () => void handleAcceptRequest(request.pendingRequestId),
                }))}
              />
            ) : (
              <EmptyState
                title="Keine offenen Anfragen"
                body="Zurzeit liegen keine eingehenden Freundschaftsanfragen vor. Lade Freunde ein und startet gemeinsam."
                ctaLabel="Freunde einladen"
                ctaIconName="share-2"
                image={emptyRequestsIllustration}
                onCtaPress={() => void handleInviteFriends()}
              />
            )
          ) : null}

          {!isPending && !blockingError && activeFilter === 'sent' ? (
            data && data.outgoingRequests.length > 0 ? (
              <FriendsList
                items={data.outgoingRequests.map((request) => {
                  const legacyPendingRequestId = (
                    request as unknown as {
                      pendingRequestId?: string;
                    }
                  ).pendingRequestId;
                  const recallFriendshipId = request.friendshipId || legacyPendingRequestId;
                  const isRecalling = !!recallFriendshipId && recallingFriendshipId === recallFriendshipId;

                  return {
                    id: request.id,
                    image: request.picture,
                    name: request.name,
                    onPress: () => router.push(`/profile/${encodeURIComponent(request.userId)}` as never),
                    subtitle: 'Anfrage gesendet',
                    actionLabel: isRecalling ? '...' : 'Zurueckrufen',
                    actionMuted: true,
                    actionDisabled: !recallFriendshipId || isRecalling || !canPerformWrites,
                    onActionPress: () => {
                      if (!recallFriendshipId) {
                        return;
                      }

                      void handleRecallRequest(recallFriendshipId);
                    },
                  };
                })}
              />
            ) : (
              <EmptyState
                title="Nichts ausstehend"
                body="Du hast aktuell keine gesendeten Freundschaftsanfragen."
                image={emptySentIllustration}
              />
            )
          ) : null}
        </ScrollView>

        <Pressable
          accessibilityLabel="Freunde suchen"
          disabled={!canPerformWrites}
          onPress={() => setIsSearchModalVisible(true)}
          style={({ pressed }) => [
            styles.searchButton,
            { bottom: floatingActionBottom },
            !canPerformWrites && styles.searchButtonDisabled,
            pressed && styles.pressed,
          ]}>
          <Feather color="#F5F3EE" name="search" size={24} />
        </Pressable>

        <Modal
          animationType="fade"
          onShow={handleSearchModalShow}
          transparent
          visible={isSearchModalVisible}
          onRequestClose={closeSearchModal}>
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closeSearchModal} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Freunde finden</Text>
                <Pressable
                  accessibilityLabel="Suche schliessen"
                  onPress={closeSearchModal}
                  style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}>
                  <Feather color="#1E2A1E" name="x" size={16} />
                </Pressable>
              </View>

              <View style={styles.searchInputShell}>
                <View style={styles.searchInputIconWrap}>
                  <Feather color="#6B7A6B" name="search" size={14} />
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  ref={searchInputRef}
                  onChangeText={setSearchQuery}
                  placeholder="Name oder Nutzername suchen"
                  placeholderTextColor="#6B7A6B"
                  style={styles.searchInput}
                  value={searchQuery}
                />
              </View>

              <View style={styles.searchResultsColumn}>
                {isSearchLoading ? (
                  <View style={styles.searchStatusWrap}>
                    <ActivityIndicator color="#2E6B4B" size="small" />
                  </View>
                ) : null}

                {!isSearchLoading && searchError ? (
                  <Text style={styles.searchStatusText}>{searchError}</Text>
                ) : null}

                {!isSearchLoading && !searchError && searchQuery.trim().length < 2 ? (
                  <Text style={styles.searchStatusText}>
                    Gib mindestens zwei Zeichen ein, um nach Freunden zu suchen.
                  </Text>
                ) : null}

                {!isSearchLoading &&
                !searchError &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 ? (
                  <Text style={styles.searchStatusText}>Keine passenden Nutzer gefunden.</Text>
                ) : null}

                {!isSearchLoading && !searchError && searchResults.length > 0 ? (
                  <FriendsList items={searchListItems} />
                ) : null}
              </View>

            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F5F3EE',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  title: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#2E6B4B',
  },
  filterChipLabel: {
    color: '#2E3A2E',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  filterChipLabelActive: {
    color: '#F5F3EE',
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  loadingShell: {
    gap: 14,
    paddingTop: 12,
  },
  loadingCardsColumn: {
    gap: 16,
  },
  loadingFriendCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  loadingFriendCopy: {
    flex: 1,
    gap: 8,
  },
  helperText: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  refreshHint: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  inlineActionButtonDisabled: {
    opacity: 0.7,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyTitle: {
    color: '#1E2A1E',
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
  },
  emptyBody: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyIllustration: {
    alignSelf: 'center',
    height: 120,
    marginBottom: 12,
    width: 120,
  },
  emptyCtaButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#2E6B4B',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyCtaLabel: {
    color: '#F5F3EE',
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  searchButton: {
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
  searchButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(46,58,46,0.35)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginHorizontal: 20,
    marginTop: 120,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#141E14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#1E2A1E',
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#F0E9DD',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  searchInputShell: {
    alignItems: 'center',
    backgroundColor: '#F6F2EA',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInputIconWrap: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  searchInput: {
    color: '#1E2A1E',
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    padding: 0,
  },
  searchResultsColumn: {
    gap: 10,
    minHeight: 120,
  },
  searchStatusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  searchStatusText: {
    color: '#6B7A6B',
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.88,
  },
});
