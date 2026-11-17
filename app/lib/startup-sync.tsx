import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { useConnectivity } from '@/lib/connectivity';
import { runCoreOfflineSync } from '@/lib/core-offline-sync';

export function CoreOfflineSyncBridge() {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const { accessToken, currentUserProfile, getValidAccessToken, isAuthenticated, isLoading } = useAuth();
  const { isOnline } = useConnectivity();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const userId = claims?.sub;
  const lastStart = useRef<{ userId: string; token: string } | null>(null);
  const live = useRef({ userId, isAuthenticated, isOnline });
  live.current = { userId, isAuthenticated, isOnline };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (isRestoring || isLoading || !isAuthenticated || !accessToken || !userId || !isOnline) {
      lastStart.current = null;
      return;
    }
    if (lastStart.current?.userId === userId && lastStart.current.token === accessToken) return;
    lastStart.current = { userId, token: accessToken };
    const current = () => mounted.current && live.current.isAuthenticated
      && live.current.isOnline && live.current.userId === userId;
    void (async () => {
      // Join the auth provider's refresh instead of sending an expired startup token.
      const token = await getValidAccessToken();
      if (!token || !current()) return;
      await runCoreOfflineSync({
        queryClient, accessToken: token, userId,
        currentUserProfile: currentUserProfile?.id === userId ? currentUserProfile : null,
        isSessionCurrent: current,
      });
    })().catch(error => {
      if (current()) {
        lastStart.current = null;
        console.warn('Failed to run core offline sync', error);
      }
    });
  }, [accessToken, currentUserProfile, getValidAccessToken, isAuthenticated, isLoading,
    isOnline, isRestoring, queryClient, userId]);
  return null;
}
