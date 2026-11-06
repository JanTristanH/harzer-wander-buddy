import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { syncStampNote, type StampDetailData, type StampNote } from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { appConfig } from '@/lib/config';
import { useConnectivity } from '@/lib/connectivity';
import { OfflineNoteQueue, type OfflineNote } from '@/lib/offline-note-queue';

type Value = {
  isNative: boolean; ready: boolean; entries: readonly OfflineNote[]; syncing: boolean; storageError: string | null;
  save(stampId: string, note: string, base: StampNote | null): Promise<void>;
  resolve(stampId: string, choice: 'local' | 'remote'): Promise<void>;
  retry(): Promise<void>;
};
const unavailable = async () => { throw new Error('Lokaler Notizspeicher ist noch nicht bereit.'); };
const Context = createContext<Value>({ isNative: false, ready: false, entries: [], syncing: false, storageError: null,
  save: unavailable, resolve: unavailable, retry: unavailable });
export const useOfflineNotes = () => useContext(Context);
const STORAGE_ERROR = 'Notizen konnten nicht sicher auf diesem Gerät gespeichert oder gelesen werden. Bitte erneut versuchen.';

export function NativeOfflineNotesProvider({ children }: React.PropsWithChildren) {
  const auth = useAuth();
  const claims = useIdTokenClaims<{ sub?: string }>();
  const owner = Platform.OS !== 'web' && auth.isAuthenticated ? claims?.sub : undefined;
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();
  const live = useRef({ owner, auth, isOnline });
  live.current = { owner, auth, isOnline };
  // Reuse a queue across rapid account switches, including any in-flight write.
  const queues = useRef(new Map<string, { queue: OfflineNoteQueue; loaded: Promise<void> }>());
  const [state, setState] = useState<{ owner?: string; queue?: OfflineNoteQueue; ready: boolean; error: string | null }>({ ready: false, error: null });
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!owner) { setState({ ready: false, error: null }); return; }
    let entry = queues.current.get(owner);
    if (!entry) {
      const queue = new OfflineNoteQueue(AsyncStorage,
        `hwb-offline-notes-v1:${encodeURIComponent(appConfig.backendUrl)}:${encodeURIComponent(owner)}`);
      entry = { queue, loaded: queue.load() }; queues.current.set(owner, entry);
    }
    let active = true;
    const queue = entry.queue;
    setState({ owner, queue, ready: false, error: null });
    const unsubscribe = queue.subscribe(() => { if (active) redraw((v) => v + 1); });
    void entry.loaded.then(() => { if (active) setState({ owner, queue, ready: true, error: null }); })
      .catch(() => { if (active) setState({ owner, queue, ready: false, error: STORAGE_ERROR }); });
    return () => { active = false; unsubscribe(); };
  }, [owner]);
  const queue = state.owner === owner && owner ? state.queue : undefined;
  const ready = Boolean(queue && state.ready);
  const fail = useCallback(() => {
    if (live.current.owner === owner) setState((s) => ({ ...s, error: STORAGE_ERROR }));
  }, [owner]);
  const flush = useCallback(async () => {
    if (!queue || !ready || !owner) return;
    try {
      await queue.flush(async (entry) => {
        if (live.current.owner !== owner) return;
        const token = await live.current.auth.getValidAccessToken();
        if (!token || live.current.owner !== owner || !live.current.isOnline) return;
        const result = await syncStampNote(token, entry.stampId, entry.note, entry.base);
        if (!result.conflict && live.current.owner === owner) {
          await queryClient.invalidateQueries();
          // Inactive detail queries do not refetch. Preserve the acknowledgement
          // there too, before the persisted overlay is removed.
          queryClient.setQueriesData<StampDetailData>({ predicate: (q) =>
            q.queryKey[0] === 'stamp-detail' && q.queryKey[1] === owner && q.queryKey[2] === entry.stampId },
          (detail) => detail ? { ...detail, myNote: result.current } : detail);
        }
        return result;
      }, () => live.current.owner === owner && live.current.isOnline && AppState.currentState !== 'background');
    } catch { fail(); }
  }, [queue, ready, owner, queryClient, fail]);
  useEffect(() => {
    if (!isOnline || !ready) return;
    void flush();
    const timer = setInterval(() => { void flush(); }, 30_000);
    const subscription = AppState.addEventListener('change', (s) => { if (s === 'active') void flush(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [isOnline, ready, flush]);
  const save = async (stampId: string, note: string, base: StampNote | null) => {
    if (!queue || !ready || state.error) return unavailable();
    try { await queue.save(stampId, note, base); void flush(); }
    catch { fail(); throw new Error(STORAGE_ERROR); }
  };
  const resolve = async (stampId: string, choice: 'local' | 'remote') => {
    if (!queue || !ready) return unavailable();
    try {
      // Refresh before removing a conflict overlay; choosing local is conditional again.
      if (choice === 'remote') {
        const remote = queue.entries.find((e) => e.stampId === stampId)?.remote ?? null;
        queryClient.setQueriesData<StampDetailData>({ predicate: (q) =>
          q.queryKey[0] === 'stamp-detail' && q.queryKey[1] === owner && q.queryKey[2] === stampId },
        (detail) => detail ? { ...detail, myNote: remote } : detail);
      }
      await queue.resolve(stampId, choice); void flush();
    } catch { fail(); throw new Error(STORAGE_ERROR); }
  };
  const retry = async () => {
    if (!queue) return;
    try {
      if (!ready) {
        const loaded = queue.load();
        if (owner) queues.current.set(owner, { queue, loaded });
        await loaded;
      }
      await queue.retry();
      setState((s) => ({ ...s, ready: true, error: null }));
      void flush();
    } catch { fail(); }
  };
  return <Context.Provider value={{ isNative: Platform.OS !== 'web', ready, entries: queue?.entries ?? [],
    syncing: queue?.syncing ?? false, storageError: queue ? state.error : null, save, resolve, retry }}>{children}</Context.Provider>;
}
