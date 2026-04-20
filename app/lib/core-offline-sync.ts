import AsyncStorage from '@react-native-async-storage/async-storage';
import { type QueryClient } from '@tanstack/react-query';

import {
  fetchAllPointsOfInterest,
  fetchFriendsOverview,
  fetchMapData,
  fetchProfileOverview,
  fetchTourById,
  fetchTourPath,
  fetchTours,
  type LatestVisitedStamp,
  type Stampbox,
} from '@/lib/api';
import { fetchStampsOverviewData, queryKeys, type TourDetailData } from '@/lib/queries';

const CORE_SYNC_METADATA_KEY = 'hwb-core-offline-sync-v1';
const CORE_SYNC_SCHEMA_VERSION = 1;
const CORE_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

type CoreOfflineSyncMetadata = {
  schemaVersion: number;
  userId: string;
  lastSyncAt: string;
};

type CoreOfflineSyncParams = {
  queryClient: QueryClient;
  accessToken: string;
  userId?: string;
  currentUserProfile?: {
    id: string;
    name: string;
    picture?: string;
  } | null;
  force?: boolean;
};

function normalizeUserId(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : 'anonymous';
}

export async function readCoreOfflineSyncMetadata() {
  try {
    const rawValue = await AsyncStorage.getItem(CORE_SYNC_METADATA_KEY);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as CoreOfflineSyncMetadata;
  } catch {
    return null;
  }
}

async function writeCoreOfflineSyncMetadata(userId: string) {
  const payload: CoreOfflineSyncMetadata = {
    schemaVersion: CORE_SYNC_SCHEMA_VERSION,
    userId,
    lastSyncAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(CORE_SYNC_METADATA_KEY, JSON.stringify(payload));
}

function shouldSkipSync(
  metadata: CoreOfflineSyncMetadata | null,
  userId: string,
  force: boolean
) {
  if (force || !metadata) {
    return false;
  }

  if (metadata.schemaVersion !== CORE_SYNC_SCHEMA_VERSION) {
    return false;
  }

  if (metadata.userId !== userId) {
    return false;
  }

  const lastSyncTime = Date.parse(metadata.lastSyncAt);
  if (!Number.isFinite(lastSyncTime)) {
    return false;
  }

  return Date.now() - lastSyncTime < CORE_SYNC_MIN_INTERVAL_MS;
}

type StampsOverviewData = {
  stamps: Stampbox[];
  lastVisited: LatestVisitedStamp | null;
};

export async function runCoreOfflineSync(params: CoreOfflineSyncParams) {
  const userId = normalizeUserId(params.userId);
  const metadata = await readCoreOfflineSyncMetadata();

  if (shouldSkipSync(metadata, userId, params.force ?? false)) {
    return;
  }

  const stampsOverview = await params.queryClient.fetchQuery<StampsOverviewData>({
    queryKey: queryKeys.stampsOverview(params.userId),
    queryFn: () => fetchStampsOverviewData(params.accessToken, params.userId),
  });

  await Promise.all([
    params.queryClient.fetchQuery({
      queryKey: queryKeys.mapData(params.userId),
      queryFn: () =>
        fetchMapData(
          params.accessToken,
          params.userId,
          stampsOverview.stamps,
          stampsOverview.lastVisited
        ),
    }),
    params.queryClient.fetchQuery({
      queryKey: queryKeys.friendsOverview(params.userId),
      queryFn: () => fetchFriendsOverview(params.accessToken, params.userId),
    }),
    params.queryClient.fetchQuery({
      queryKey: queryKeys.profileOverview(params.userId),
      queryFn: () =>
        fetchProfileOverview(
          params.accessToken,
          params.userId,
          params.currentUserProfile ?? null,
          stampsOverview.stamps
        ),
    }),
    params.queryClient.fetchQuery({
      queryKey: queryKeys.pointsOfInterest(params.userId),
      queryFn: () => fetchAllPointsOfInterest(params.accessToken),
    }),
  ]);

  const tours = await params.queryClient.fetchQuery({
    queryKey: queryKeys.toursOverview(params.userId),
    queryFn: () => fetchTours(params.accessToken, params.userId ? [params.userId] : []),
  });

  await Promise.all(
    tours.map((tour) =>
      params.queryClient.fetchQuery<TourDetailData>({
        queryKey: queryKeys.tourDetail(params.userId, tour.ID),
        queryFn: async () => {
          const [tourDetail, path] = await Promise.all([
            fetchTourById(params.accessToken, tour.ID, params.userId ? [params.userId] : []),
            fetchTourPath(params.accessToken, tour.ID),
          ]);

          return {
            tour: tourDetail,
            path,
          } satisfies TourDetailData;
        },
      })
    )
  );

  await writeCoreOfflineSyncMetadata(userId);
}
