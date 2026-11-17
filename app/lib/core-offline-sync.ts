import AsyncStorage from '@react-native-async-storage/async-storage';
import { type QueryClient } from '@tanstack/react-query';

import {
  fetchAllPointsOfInterest, fetchCurrentUserProfile, fetchMapData, fetchProfileOverview, fetchTourPath, fetchTours, type Tour,
} from '@/lib/api';
import {
  CORE_QUERY_STALE_TIME, fetchSharedFriendsOverview, fetchSharedStampsOverview,
  queryKeys, type TourDetailData,
} from '@/lib/queries';

const CORE_SYNC_METADATA_KEY = 'hwb-core-offline-sync-v1';
const CORE_SYNC_SCHEMA_VERSION = 2;
const TOUR_PREFETCH_CONCURRENCY = 2;

type CoreOfflineSyncMetadata = { schemaVersion: number; userId: string; lastSyncAt: string };
type CoreOfflineSyncParams = {
  queryClient: QueryClient;
  accessToken: string;
  userId?: string;
  currentUserProfile?: { id: string; name: string; picture?: string } | null;
  force?: boolean;
  isSessionCurrent?: () => boolean;
};

export async function readCoreOfflineSyncMetadata() {
  try {
    const raw = await AsyncStorage.getItem(CORE_SYNC_METADATA_KEY);
    return raw ? JSON.parse(raw) as CoreOfflineSyncMetadata : null;
  } catch { return null; }
}

const inFlight = new WeakMap<QueryClient, Map<string, Promise<void>>>();

export function runCoreOfflineSync(params: CoreOfflineSyncParams) {
  // Never populate an anonymous cache while an authenticated identity is unresolved.
  if (!params.userId?.trim()) return Promise.resolve();
  let tasks = inFlight.get(params.queryClient);
  if (!tasks) { tasks = new Map(); inFlight.set(params.queryClient, tasks); }
  const userId = params.userId.trim();
  const existing = tasks.get(userId);
  if (existing) return existing;
  const task = syncCore(params, userId).finally(() => {
    if (tasks.get(userId) === task) tasks.delete(userId);
  });
  tasks.set(userId, task);
  return task;
}

async function syncCore(params: CoreOfflineSyncParams, userId: string) {
  const current = params.isSessionCurrent ?? (() => true);
  const client = params.queryClient;
  const metadata = await readCoreOfflineSyncMetadata();
  if (!current()) return;
  const baseKeys = [
    queryKeys.stampsOverviewByFilter(userId, 'validToday'), queryKeys.mapData(userId),
    queryKeys.friendsOverview(userId), queryKeys.profileOverview(userId),
    queryKeys.pointsOfInterest(userId), queryKeys.toursOverview(userId),
  ];
  const cachedTours = client.getQueryData<Tour[]>(queryKeys.toursOverview(userId));
  const requiredKeys = [...baseKeys, ...(cachedTours ?? []).map(tour => queryKeys.tourDetail(userId, tour.ID))];
  const age = metadata ? Date.now() - Date.parse(metadata.lastSyncAt) : Number.NaN;
  const recentlySynced = metadata?.schemaVersion === CORE_SYNC_SCHEMA_VERSION
    && metadata.userId === userId
    && age >= 0 && age < CORE_QUERY_STALE_TIME;
  // A timestamp alone cannot tell us whether persisted data was restored or evicted.
  if (!params.force && recentlySynced && requiredKeys.every(key => {
    const state = client.getQueryState(key);
    return state?.data !== undefined && !state.isInvalidated;
  })) return;

  const staleTime = params.force ? 0 : CORE_QUERY_STALE_TIME;
  const overview = await fetchSharedStampsOverview(client, params.accessToken, userId, undefined, params.force);
  if (!current()) return;
  const [friends, , , tours] = await Promise.all([
    fetchSharedFriendsOverview(client, params.accessToken, userId, params.force),
    client.fetchQuery({
      queryKey: queryKeys.mapData(userId), staleTime,
      queryFn: () => fetchMapData(params.accessToken, userId, overview.stamps, overview.lastVisited, 'validToday'),
    }),
    client.fetchQuery({
      queryKey: queryKeys.pointsOfInterest(userId), staleTime,
      queryFn: () => fetchAllPointsOfInterest(params.accessToken),
    }),
    client.fetchQuery({
      queryKey: queryKeys.toursOverview(userId), staleTime,
      queryFn: () => fetchTours(params.accessToken, [userId]),
    }),
  ]);
  if (!current()) return;
  await client.fetchQuery({
    queryKey: queryKeys.profileOverview(userId), staleTime,
    queryFn: async () => {
      const profile = params.currentUserProfile?.id === userId ? params.currentUserProfile
        : await client.fetchQuery({
          queryKey: ['current-user-profile', userId], staleTime,
          queryFn: () => fetchCurrentUserProfile(params.accessToken),
        });
      return fetchProfileOverview(params.accessToken, userId, profile, overview.stamps, friends);
    },
  });
  if (!current()) return;

  let next = 0;
  await Promise.all(Array.from({ length: Math.min(TOUR_PREFETCH_CONCURRENCY, tours.length) }, async () => {
    while (next < tours.length && current()) {
      const tour = tours[next++];
      await client.fetchQuery<TourDetailData>({
        queryKey: queryKeys.tourDetail(userId, tour.ID), staleTime,
        // The overview already contains exactly the fields fetched by fetchTourById.
        queryFn: async () => ({ tour, path: await fetchTourPath(params.accessToken, tour.ID) }),
      });
    }
  }));
  if (!current()) return;
  await AsyncStorage.setItem(CORE_SYNC_METADATA_KEY, JSON.stringify({
    schemaVersion: CORE_SYNC_SCHEMA_VERSION, userId, lastSyncAt: new Date().toISOString(),
  } satisfies CoreOfflineSyncMetadata));
}
