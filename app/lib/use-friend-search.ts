import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import {
  createFriendRequest,
  removeFriendship,
  searchUsers,
  type FriendsOverviewData,
  type SearchUserResult,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useRequireSignInAction } from '@/lib/auth-actions';
import { isNetworkUnavailableError, requireOnlineForWrite } from '@/lib/offline-write';
import { queryKeys } from '@/lib/queries';

export function useFriendSearch(
  data: FriendsOverviewData | undefined,
  onProfilePress?: (userId: string) => void
) {
  const { accessToken, canPerformWrites, isAuthenticated, isOffline, logout } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const queryClient = useQueryClient();
  const requireSignIn = useRequireSignInAction();
  const [recallingFriendshipId, setRecallingFriendshipId] = useState<string | null>(null);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const searchInputRef = useRef<TextInput | null>(null);
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

          if (nextError instanceof Error && nextError.name === 'UnauthorizedError') {
            await logout();
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
  }, [accessToken, isOffline, isSearchModalVisible, logout, searchQuery]);

  const sentRequestIds = useMemo(
    () => new Set((data?.outgoingRequests ?? []).map((item) => item.userId)),
    [data]
  );
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
  }, []);

  const handleSearchModalShow = useCallback(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  const handleCreateRequest = useCallback(
    async (userId: string) => {
      if (!isAuthenticated) {
        requireSignIn('Melde dich an, um Freundschaftsanfragen zu senden.');
        return;
      }

      if (
        !accessToken ||
        !data ||
        submittingRef.current ||
        userId === data.currentUserId ||
        friendIds.has(userId) ||
        sentRequestIds.has(userId) ||
        receivedRequestIds.has(userId) ||
        searchResults.some((result) => result.id === userId && result.isFriend)
      ) {
        return;
      }

      try {
        requireOnlineForWrite(canPerformWrites);
        submittingRef.current = true;
        setSubmittingUserId(userId);
        await createFriendRequest(accessToken, userId);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.friendsOverview(claims?.sub),
            refetchType: 'all',
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.profileOverview(claims?.sub),
            refetchType: 'all',
          }),
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
        submittingRef.current = false;
        setSubmittingUserId(null);
      }
    },
    [
      accessToken,
      canPerformWrites,
      claims?.sub,
      isAuthenticated,
      logout,
      queryClient,
      requireSignIn,
      data,
      friendIds,
      sentRequestIds,
      receivedRequestIds,
      searchResults,
    ]
  );

  const handleRecallRequest = useCallback(
    (friendshipId: string) => {
      if (!isAuthenticated) {
        requireSignIn('Melde dich an, um Freundschaftsanfragen zu verwalten.');
        return;
      }

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
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.friendsOverview(claims?.sub),
                      refetchType: 'all',
                    }),
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.profileOverview(claims?.sub),
                      refetchType: 'all',
                    }),
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
    [
      accessToken,
      canPerformWrites,
      claims?.sub,
      isAuthenticated,
      logout,
      queryClient,
      requireSignIn,
    ]
  );

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
          onPress: onProfilePress ? () => onProfilePress(result.id) : undefined,
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
          actionDisabled:
            status !== 'request' || submittingUserId !== null || !canPerformWrites || !data,
          onActionPress: () => void handleCreateRequest(result.id),
        };
      }),
    [
      data,
      friendIds,
      handleCreateRequest,
      onProfilePress,
      receivedRequestIds,
      searchResults,
      sentRequestIds,
      submittingUserId,
      canPerformWrites,
    ]
  );

  const sentRequestItems = (data?.outgoingRequests ?? []).map((request) => {
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
      onPress: onProfilePress ? () => onProfilePress(request.userId) : undefined,
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
  });

  return {
    isSearchModalVisible,
    setIsSearchModalVisible,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearchLoading,
    searchError,
    searchInputRef,
    closeSearchModal,
    handleSearchModalShow,
    searchListItems,
    sentRequestItems,
  };
}
