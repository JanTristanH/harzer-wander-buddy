import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { SignInRequiredScreen } from '@/components/auth-locked-state';
import { FriendsList } from '@/components/friends-list';
import { SkeletonBlock, SkeletonCircle } from '@/components/skeleton';
import { FriendSearchModal } from '@/components/friend-search-modal';
import { useFriendSearch } from '@/lib/use-friend-search';
import { AppColors, Fonts, Layout } from '@/constants/theme';
import { acceptPendingFriendshipRequest } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useRequireSignInAction } from '@/lib/auth-actions';
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

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requireSignIn = useRequireSignInAction();
  const { accessToken, canPerformWrites, isAuthenticated, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FriendFilter>('friends');
  const [acceptingPendingRequestId, setAcceptingPendingRequestId] = useState<string | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { data, error, isFetching, isPending, refetch } = useFriendsOverviewQuery();
  const friendSearch = useFriendSearch(data, (userId) => {
    friendSearch.closeSearchModal();
    requestAnimationFrame(() => router.push(`/profile/${encodeURIComponent(userId)}` as never));
  });
  const { setIsSearchModalVisible } = friendSearch;
  const isRefreshing = isFetching && !isPending;
  const blockingError = !data ? error : null;
  const floatingActionBottom = getFloatingActionBottomOffset(insets.bottom);

  const requestsLabel = `Anfragen (${data?.incomingRequestCount ?? 0})`;
  const sentLabel = `Gesendet${data && data.outgoingRequestCount > 0 ? ` (${data.outgoingRequestCount})` : ''}`;

  const handleAcceptRequest = useCallback(
    async (pendingRequestId: string) => {
      if (!isAuthenticated) {
        requireSignIn('Melde dich an, um Freundschaftsanfragen zu verwalten.');
        return;
      }

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
    [accessToken, canPerformWrites, claims?.sub, isAuthenticated, logout, queryClient, requireSignIn]
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

  if (!isAuthenticated) {
    return (
      <SignInRequiredScreen
        body="Melde dich an, um Freunde zu suchen, Anfragen zu senden und gemeinsamen Fortschritt zu sehen."
        onSignIn={() => router.push('/login' as never)}
        title="Freunde sind mit Konto verfügbar"
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
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
              tintColor={AppColors.primary}
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
                items={friendSearch.sentRequestItems}
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

        {!(activeFilter === 'friends' && data && data.friends.length === 0) ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', width: '100%', maxWidth: Layout.contentWidth, alignSelf: 'center', bottom: 0 }}>
      <Pressable
          accessibilityLabel="Freunde suchen"
                  accessibilityRole="button"
          disabled={!canPerformWrites}
          onPress={() => setIsSearchModalVisible(true)}
          style={({ pressed }) => [
            styles.searchButton,
            { bottom: floatingActionBottom },
            !canPerformWrites && styles.searchButtonDisabled,
            pressed && styles.pressed,
          ]}>
          <Feather color={AppColors.background} name="search" size={24} />
        </Pressable>
        </View>
      ) : null}

        <FriendSearchModal search={friendSearch} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  title: {
    color: AppColors.text,
    fontFamily: Fonts.sans,
    fontWeight: '700',
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
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
  },
  filterChipLabel: {
    color: AppColors.textSecondary,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  filterChipLabelActive: {
    color: AppColors.background,
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
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: AppColors.shadow,
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
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  refreshHint: {
    color: AppColors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  inlineActionButtonDisabled: {
    opacity: 0.7,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    width: 52,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.88,
  },
});
