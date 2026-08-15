import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { FriendsOverviewData } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useFriendsOverviewQuery } from '@/lib/queries';

type GroupClaims = {
  sub?: string;
};

type FriendsOverviewMember = FriendsOverviewData['friends'][number];

export type HikingGroupMember = FriendsOverviewMember & {
  isAllowedToStampForFriend: boolean;
  isAllowedToStampForMe: boolean;
};

export type HikingGroupContextValue = {
  selectedFriendIds: string[];
  groupUserIds: string[];
  members: HikingGroupMember[];
  selectedMembers: HikingGroupMember[];
  isLoading: boolean;
  toggleFriend: (friendId: string) => void;
  addFriend: (friendId: string) => void;
  removeFriend: (friendId: string) => void;
  clearGroup: () => void;
};

const HikingGroupContext = createContext<HikingGroupContextValue | null>(null);

function normalizeId(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMember(member: FriendsOverviewMember): HikingGroupMember {
  const permissionMember = member as FriendsOverviewMember & {
    isAllowedToStampForFriend?: boolean;
    isAllowedToStampForMe?: boolean;
  };

  return {
    ...member,
    isAllowedToStampForFriend: permissionMember.isAllowedToStampForFriend === true,
    isAllowedToStampForMe: permissionMember.isAllowedToStampForMe === true,
  };
}

export function HikingGroupProvider({ children }: PropsWithChildren) {
  const { currentUserProfile, isAuthenticated } = useAuth();
  const claims = useIdTokenClaims<GroupClaims>();
  const friendsQuery = useFriendsOverviewQuery();
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const previousUserIdRef = useRef<string | null>(null);

  const currentUserId = useMemo(() => {
    if (!isAuthenticated) {
      return null;
    }

    return (
      normalizeId(claims?.sub) ||
      normalizeId(currentUserProfile?.id) ||
      normalizeId(friendsQuery.data?.currentUserId) ||
      null
    );
  }, [
    claims?.sub,
    currentUserProfile?.id,
    friendsQuery.data?.currentUserId,
    isAuthenticated,
  ]);

  const members = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    return (friendsQuery.data?.friends ?? []).map(normalizeMember);
  }, [friendsQuery.data?.friends, isAuthenticated]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);

  useEffect(() => {
    if (!isAuthenticated) {
      previousUserIdRef.current = null;
      setSelectedFriendIds([]);
      return;
    }

    if (!currentUserId) {
      return;
    }

    if (
      previousUserIdRef.current !== null &&
      previousUserIdRef.current !== currentUserId
    ) {
      setSelectedFriendIds([]);
    }

    previousUserIdRef.current = currentUserId;
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    if (!friendsQuery.data) {
      return;
    }

    setSelectedFriendIds((currentIds) => {
      const nextIds = currentIds.filter((friendId) => memberIds.has(friendId));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [friendsQuery.data, memberIds]);

  const addFriend = useCallback(
    (friendId: string) => {
      const normalizedFriendId = normalizeId(friendId);
      if (!normalizedFriendId || !memberIds.has(normalizedFriendId)) {
        return;
      }

      setSelectedFriendIds((currentIds) =>
        currentIds.includes(normalizedFriendId)
          ? currentIds
          : [...currentIds, normalizedFriendId]
      );
    },
    [memberIds]
  );

  const removeFriend = useCallback((friendId: string) => {
    const normalizedFriendId = normalizeId(friendId);
    if (!normalizedFriendId) {
      return;
    }

    setSelectedFriendIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== normalizedFriendId)
    );
  }, []);

  const toggleFriend = useCallback(
    (friendId: string) => {
      const normalizedFriendId = normalizeId(friendId);
      if (!normalizedFriendId || !memberIds.has(normalizedFriendId)) {
        return;
      }

      setSelectedFriendIds((currentIds) =>
        currentIds.includes(normalizedFriendId)
          ? currentIds.filter((currentId) => currentId !== normalizedFriendId)
          : [...currentIds, normalizedFriendId]
      );
    },
    [memberIds]
  );

  const clearGroup = useCallback(() => {
    setSelectedFriendIds([]);
  }, []);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedFriendIds.includes(member.id)),
    [members, selectedFriendIds]
  );

  const groupUserIds = useMemo(() => {
    if (!currentUserId) {
      return [];
    }

    return [
      currentUserId,
      ...selectedFriendIds.filter((friendId) => friendId !== currentUserId),
    ];
  }, [currentUserId, selectedFriendIds]);

  const value = useMemo<HikingGroupContextValue>(
    () => ({
      selectedFriendIds,
      groupUserIds,
      members,
      selectedMembers,
      isLoading:
        isAuthenticated &&
        !friendsQuery.data &&
        (friendsQuery.isPending || friendsQuery.isFetching),
      toggleFriend,
      addFriend,
      removeFriend,
      clearGroup,
    }),
    [
      addFriend,
      clearGroup,
      friendsQuery.data,
      friendsQuery.isFetching,
      friendsQuery.isPending,
      groupUserIds,
      isAuthenticated,
      members,
      removeFriend,
      selectedFriendIds,
      selectedMembers,
      toggleFriend,
    ]
  );

  return <HikingGroupContext.Provider value={value}>{children}</HikingGroupContext.Provider>;
}

export function useHikingGroup() {
  const context = useContext(HikingGroupContext);
  if (!context) {
    throw new Error('useHikingGroup must be used inside HikingGroupProvider');
  }

  return context;
}
