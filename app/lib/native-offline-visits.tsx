import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { HttpStatusError, syncOfflineStamping, type Stampbox } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { appConfig } from '@/lib/config';
import { useConnectivity } from '@/lib/connectivity';
import { OfflineVisitQueue, type OfflineVisit } from '@/lib/offline-visit-queue';
import { OfflineVisitsContext } from '@/lib/offline-visits';

const STORE_ERROR = 'Besuche konnten nicht sicher auf diesem Gerät gespeichert werden. Bitte erneut versuchen.';

export function NativeOfflineVisitsProvider({ children }: React.PropsWithChildren) {
  const auth = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();
  const userId = auth.isAuthenticated ? claims?.sub : undefined;
  const nativeUserId = Platform.OS === 'web' ? undefined : userId;
  const [queue, setQueue] = useState<OfflineVisitQueue | null>(null);
  const [snapshot, setSnapshot] = useState<{ entries: readonly OfflineVisit[]; syncing: boolean }>({ entries: [], syncing: false });
  const [storageError, setStorageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const live = useRef({ auth, isOnline, userId: nativeUserId });
  live.current = { auth, isOnline, userId: nativeUserId };
  const queueOwner = useRef<string | undefined>(undefined);

  useEffect(() => {
    setReady(false);
    setStorageError(null);
    setSnapshot({ entries: [], syncing: false });
    queueOwner.current = nativeUserId;
    if (!nativeUserId) { setQueue(null); return; }
    const next = new OfflineVisitQueue(AsyncStorage,
      `hwb-offline-visits-v1:${encodeURIComponent(appConfig.backendUrl)}:${encodeURIComponent(nativeUserId)}`);
    setQueue(next);
    let active = true;
    const unsubscribe = next.subscribe(() => {
      if (active) setSnapshot({ entries: next.entries, syncing: next.syncing });
    });
    void next.load().then(() => { if (active) setReady(true); }).catch(() => {
      if (active) setStorageError(STORE_ERROR);
    });
    return () => { active = false; unsubscribe(); };
  }, [nativeUserId]);

  const flush = useCallback(async () => {
    if (!queue || !ready || queue.syncing || !queue.entries.some((entry) => entry.status === 'pending') || queueOwner.current !== nativeUserId || !nativeUserId) return;
    const owner = nativeUserId;
    try {
      await queue.flush(async (entry) => {
        if (live.current.userId !== owner) return false;
        const token = await live.current.auth.getValidAccessToken();
        if (!token || live.current.userId !== owner || !live.current.isOnline) return false;
        await syncOfflineStamping(token, owner, entry);
        // Keep the overlay until server queries have had a chance to refetch.
        if (live.current.userId === owner) await queryClient.invalidateQueries();
        return true;
      }, () => live.current.isOnline && live.current.userId === owner && AppState.currentState !== 'background',
      (error) => error instanceof HttpStatusError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status));
    } catch {
      if (live.current.userId === owner) setStorageError(STORE_ERROR);
    }
  }, [nativeUserId, queryClient, queue, ready]);

  useEffect(() => {
    if (!isOnline || !ready) return;
    void flush();
    const interval = setInterval(() => { void flush(); }, 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void flush(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [flush, isOnline, ready, snapshot.entries]);

  const record = useCallback(async (stamp: Stampbox) => {
    if (!queue || !ready || !nativeUserId || queueOwner.current !== nativeUserId || storageError) {
      throw new Error(storageError || 'Lokaler Besuchsspeicher ist noch nicht bereit.');
    }
    // Capture once, before persistence; retries retain the actual visit time.
    const entry: OfflineVisit = { id: randomUUID(), stamp, visitedAt: new Date().toISOString(), status: 'pending' };
    try { await queue.add(entry); }
    catch { setStorageError(STORE_ERROR); throw new Error(STORE_ERROR); }
  }, [nativeUserId, queue, ready, storageError]);

  const retry = useCallback(async () => {
    if (!queue) return;
    try {
      if (!ready) { await queue.load(); setReady(true); }
      await queue.retry();
      setStorageError(null);
      void flush();
    } catch { setStorageError(STORE_ERROR); }
  }, [flush, queue, ready]);

  const discard = useCallback(async (id: string) => {
    if (!queue || queue.syncing) return;
    try { await queue.discard(id); await queryClient.invalidateQueries(); }
    catch { setStorageError(STORE_ERROR); }
  }, [queryClient, queue]);

  const ownsSnapshot = queueOwner.current === nativeUserId && Boolean(nativeUserId);
  return <OfflineVisitsContext.Provider value={{
    isNative: Platform.OS !== 'web',
    canRecord: ownsSnapshot && ready && !storageError,
    userId: nativeUserId,
    entries: ownsSnapshot ? snapshot.entries : [],
    syncing: ownsSnapshot && snapshot.syncing,
    storageError: ownsSnapshot ? storageError : null,
    record, retry, discard,
  }}>{children}</OfflineVisitsContext.Provider>;
}
