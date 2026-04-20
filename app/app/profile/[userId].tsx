import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import {
  ProfileErrorState,
  ProfileLoadingState,
  ProfileView,
  type ProfileViewModel,
} from '@/components/profile-view';
import {
  acceptPendingFriendshipRequest,
  createFriendRequest,
  removeFriendship,
  updateFriendshipPermission,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import {
  isNetworkUnavailableError,
  OFFLINE_REFRESH_MESSAGE,
  requireOnlineForWrite,
} from '@/lib/offline-write';
import { buildTimelinePreview } from '@/lib/profile-timeline';
import { queryKeys, useUserProfileOverviewQuery } from '@/lib/queries';

type ComparisonFilter = 'visited' | 'shared' | 'friendOnly' | 'meOnly' | 'neither';

export default function FriendProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userIdParam = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const userId = userIdParam ? decodeURIComponent(userIdParam) : '';
  const { accessToken, canPerformWrites, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<ComparisonFilter>('visited');
  const [isMutating, setIsMutating] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { data, error, isFetching, isPending, isPlaceholderData, refetch } =
    useUserProfileOverviewQuery(userId);
  const blockingError = !data ? error : null;

  useEffect(() => {
    if (data?.relationship === 'self') {
      router.replace('/(tabs)/profile' as never);
    }
  }, [data?.relationship, router]);

  const handleMutationError = useCallback(
    async (nextError: unknown, title: string) => {
      if (isNetworkUnavailableError(nextError)) {
        Alert.alert('Offline', nextError.message);
        return;
      }

      if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
        await logout();
        return;
      }

      Alert.alert(title, nextError instanceof Error ? nextError.message : 'Unknown error');
    },
    [logout]
  );

  const invalidateRelationshipQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.friendsOverview(claims?.sub) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profileOverview(claims?.sub) }),
    ]);
  }, [claims?.sub, queryClient]);

  const viewModel = useMemo<ProfileViewModel | null>(() => {
    if (!data) {
      return null;
    }

    const comparisonTotalCount = data.stampComparisons.length;
    const comparisonVisitedCount = data.stampComparisons.reduce(
      (count, item) => count + (item.userVisited ? 1 : 0),
      0
    );
    const comparisonSharedCount = data.stampComparisons.reduce(
      (count, item) => count + (item.meVisited && item.userVisited ? 1 : 0),
      0
    );
    const comparisonBuckets = {
      shared: comparisonSharedCount,
      friendOnly: data.stampComparisons.filter((item) => !item.meVisited && item.userVisited).length,
      meOnly: data.stampComparisons.filter((item) => item.meVisited && !item.userVisited).length,
      neither: data.stampComparisons.filter((item) => !item.meVisited && !item.userVisited).length,
    };
    const visitedCount = comparisonTotalCount > 0 ? comparisonVisitedCount : data.visitedCount;
    const completionPercent =
      comparisonTotalCount > 0 ? Math.round((comparisonVisitedCount / comparisonTotalCount) * 100) : data.completionPercent;
    const sharedVisitedCount = comparisonTotalCount > 0 ? comparisonSharedCount : data.sharedVisitedCount;
    const stampBuckets = comparisonTotalCount > 0 ? comparisonBuckets : data.stampBuckets;

    const filteredStamps = data.stampComparisons.filter((item) => {
      if (activeFilter === 'visited') {
        return item.userVisited;
      }

      if (activeFilter === 'shared') {
        return item.meVisited && item.userVisited;
      }

      if (activeFilter === 'friendOnly') {
        return !item.meVisited && item.userVisited;
      }

      if (activeFilter === 'meOnly') {
        return item.meVisited && !item.userVisited;
      }

      return !item.meVisited && !item.userVisited;
    });

    const firstName = data.name.split(' ')[0] || data.name;
    const timelinePreview = buildTimelinePreview(data.stampings ?? []);
    const subtitleBase = data.collectorSinceYear
      ? `Wandert seit ${data.collectorSinceYear}`
      : 'Harz Wanderbuddy';
    const subtitleSuffix =
      data.relationship === 'friend'
        ? 'Freund'
        : data.relationship === 'incoming_request'
          ? 'Anfrage erhalten'
          : data.relationship === 'outgoing_request'
            ? 'Anfrage gesendet'
            : 'Noch nicht verbunden';

    return {
      mode: 'user',
      name: data.name,
      subtitle: `${subtitleBase} • ${subtitleSuffix}`,
      headerAction: {
        type: 'back',
        onPress: () => router.back(),
      },
      avatarColor: '#dde9df',
      avatarImage: data.picture,
      stats: [
        { label: 'Besucht', value: String(visitedCount) },
        { label: 'Abschluss', value: `${completionPercent}%` },
        { label: 'Gemeinsam', value: String(sharedVisitedCount) },
      ],
      actionCard:
        data.relationship === 'friend'
          ? {
              type: 'friendship',
              statusLabel: 'Verbunden',
              toggleLabel: 'Darf fuer mich stempeln',
              value: data.isAllowedToStampForMe,
              busy: isMutating || !canPerformWrites,
              onToggle: (value) => {
                void (async () => {
                  if (!accessToken || !data.friendshipId) {
                    return;
                  }

                  try {
                    requireOnlineForWrite(canPerformWrites);
                    setIsMutating(true);
                    await updateFriendshipPermission(accessToken, data.friendshipId, value);
                    await refetch();
                    await invalidateRelationshipQueries();
                  } catch (nextError) {
                    await handleMutationError(nextError, 'Freundschaft konnte nicht aktualisiert werden');
                  } finally {
                    setIsMutating(false);
                  }
                })();
              },
              removeLabel: 'Freund entfernen',
              onRemove: () => {
                if (!accessToken || !data.friendshipId) {
                  return;
                }

                Alert.alert(
                  'Freund entfernen?',
                  'Diese Freundschaft wird getrennt. Du kannst spaeter erneut eine Anfrage senden.',
                  [
                    {
                      text: 'Abbrechen',
                      style: 'cancel',
                    },
                    {
                      text: 'Entfernen',
                      style: 'destructive',
                      onPress: () => {
                        void (async () => {
                          try {
                            requireOnlineForWrite(canPerformWrites);
                            setIsMutating(true);
                            await removeFriendship(accessToken, data.friendshipId!);
                            await refetch();
                            await invalidateRelationshipQueries();
                          } catch (nextError) {
                            await handleMutationError(nextError, 'Freundschaft konnte nicht entfernt werden');
                          } finally {
                            setIsMutating(false);
                          }
                        })();
                      },
                    },
                  ]
                );
              },
            }
          : data.relationship === 'incoming_request'
            ? {
                type: 'button',
                label: 'Anfrage annehmen',
                busy: isMutating,
                disabled: !canPerformWrites,
                onPress: () => {
                  void (async () => {
                    if (!accessToken || !data.pendingRequestId) {
                      return;
                    }

                    try {
                      requireOnlineForWrite(canPerformWrites);
                      setIsMutating(true);
                      await acceptPendingFriendshipRequest(accessToken, data.pendingRequestId);
                      await refetch();
                      await invalidateRelationshipQueries();
                    } catch (nextError) {
                      await handleMutationError(nextError, 'Anfrage konnte nicht bestaetigt werden');
                    } finally {
                      setIsMutating(false);
                    }
                  })();
                },
              }
            : data.relationship === 'outgoing_request'
              ? {
                  type: 'button',
                  label: 'Zurueckrufen',
                  muted: true,
                  busy: isMutating,
                  disabled: !canPerformWrites,
                  onPress: () => {
                    if (!accessToken || !data.friendshipId) {
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
                                setIsMutating(true);
                                await removeFriendship(accessToken, data.friendshipId!);
                                await refetch();
                                await invalidateRelationshipQueries();
                              } catch (nextError) {
                                await handleMutationError(
                                  nextError,
                                  'Anfrage konnte nicht zurueckgerufen werden'
                                );
                              } finally {
                                setIsMutating(false);
                              }
                            })();
                          },
                        },
                      ]
                    );
                  },
                }
              : {
                  type: 'button',
                  label: 'Als Freund hinzufuegen',
                  busy: isMutating,
                  disabled: !canPerformWrites,
                  onPress: () => {
                    void (async () => {
                      if (!accessToken) {
                        return;
                      }

                      try {
                        requireOnlineForWrite(canPerformWrites);
                        setIsMutating(true);
                        await createFriendRequest(accessToken, data.userId);
                        await refetch();
                        await invalidateRelationshipQueries();
                      } catch (nextError) {
                        await handleMutationError(nextError, 'Anfrage konnte nicht gesendet werden');
                      } finally {
                        setIsMutating(false);
                      }
                    })();
                },
              },
      latestVisits: data.latestVisits,
      latestVisitsEmptyText: 'Dieses Profil hat noch keine Besuche.',
      onVisitPress: (stampId) => router.push(`/stamps/${stampId}` as never),
      timeline: {
        thisWeek: timelinePreview.thisWeek,
        thisMonth: timelinePreview.thisMonth,
        weekEmptyText: 'Diese Woche gab es noch keine Besuche.',
        monthEmptyText: 'In diesem Monat gab es noch keine Besuche.',
        onOpenAll: () => router.push(`/profile/timeline/${encodeURIComponent(data.userId)}` as never),
      },
      friendsList: {
        items: data.friends.map((friend) => ({
          id: friend.id,
          name: friend.name,
          image: friend.picture,
          subtitle: `${friend.visitedCount} Stempel • ${friend.completionPercent}%`,
          onPress: () => router.push(`/profile/${encodeURIComponent(friend.id)}` as never),
        })),
        emptyText: 'Dieses Profil zeigt noch keine Freunde.',
      },
      stampChips: [
        { key: 'visited', label: `Besucht ${visitedCount}`, tone: 'success' },
        { key: 'shared', label: `Gemeinsam ${stampBuckets.shared}`, tone: 'success' },
        { key: 'neither', label: `Keiner ${stampBuckets.neither}`, tone: 'subtle' },
        { key: 'friendOnly', label: `Nur ${firstName} ${stampBuckets.friendOnly}`, tone: 'sand' },
        { key: 'meOnly', label: `Nur ich ${stampBuckets.meOnly}`, tone: 'rose' },
      ],
      activeStampChip: activeFilter,
      onSelectStampChip: (key) => setActiveFilter(key as ComparisonFilter),
      stampItems: filteredStamps.map((item) => ({
        kind: 'compare' as const,
        stamp: item.stamp,
        meVisited: item.meVisited,
        otherVisited: item.userVisited,
      })),
      onStampPress: (stampId) => router.push(`/stamps/${stampId}` as never),
      emptyStampText: 'Fuer diesen Vergleich gibt es gerade keine Stempelstellen.',
      onRefresh: () => {
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
      },
      refreshing: isPullRefreshing,
      refreshHint:
        isFetching && !isPending ? 'Aktualisiere Profildaten im Hintergrund...' : undefined,
      showDeferredSkeletons: isPlaceholderData,
    };
  }, [accessToken, activeFilter, canPerformWrites, data, handleMutationError, invalidateRelationshipQueries, isFetching, isMutating, isOffline, isPending, isPlaceholderData, isPullRefreshing, refetch, router]);

  if (!userId) {
    return <ProfileErrorState body="Keine Benutzer-ID uebergeben." title="Profil konnte nicht geladen werden" />;
  }

  if (isPending && !data) {
    return <ProfileLoadingState label="Freundesprofil wird geladen..." />;
  }

  if (blockingError || !viewModel) {
    return (
      <ProfileErrorState
        body={blockingError?.message || 'Keine Daten verfuegbar.'}
        title="Freundesprofil konnte nicht geladen werden"
      />
    );
  }

  return <ProfileView data={viewModel} />;
}
