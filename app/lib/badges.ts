import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { fetchBadgeAlbum } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useAuthorizedRequest } from '@/lib/queries';

export function useBadgeAlbum(targetUserId?: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const request = useAuthorizedRequest();
  const query = useQuery({
    queryKey: ['badgeAlbum', claims?.sub, targetUserId || claims?.sub],
    enabled: isAuthenticated && enabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnReconnect: true,
    queryFn: () => request((token) => fetchBadgeAlbum(token, targetUserId)),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && enabled) void refetch();
    }, [isAuthenticated, enabled, refetch])
  );
  return query;
}
