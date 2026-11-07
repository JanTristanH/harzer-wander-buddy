import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import {
  fetchAllPointsOfInterest, fetchCurrentUserProfile, fetchLatestVisitedStamp, fetchMapData,
  fetchProfileOverview, fetchStampboxes, fetchFriendsOverview, fetchTourPath, fetchTours,
  fetchTourById,
} from '@/lib/api';
import { runCoreOfflineSync } from '@/lib/core-offline-sync';
import { fetchSharedStampsOverview, queryKeys } from '@/lib/queries';

jest.mock('@/lib/auth', () => ({ useAuth: jest.fn(), useIdTokenClaims: jest.fn() }));
jest.mock('@/lib/api', () => Object.fromEntries([
  'fetchAllPointsOfInterest', 'fetchCurrentUserProfile', 'fetchLatestVisitedStamp', 'fetchMapData',
  'fetchProfileOverview', 'fetchStampboxes', 'fetchFriendsOverview', 'fetchTourPath', 'fetchTours', 'fetchTourById',
].map(name => [name, jest.fn()])));

const metadataKey = 'hwb-core-offline-sync-v1';
const user = { id: 'alice', name: 'Alice' };
const stamps = [{ ID: 'stamp', name: 'Brocken' }];
const friends = { currentUserId: 'alice', friends: [] };
const tours = Array.from({ length: 6 }, (_, index) => ({ ID: `tour-${index}`, name: `Tour ${index}` }));
let client: QueryClient;
const params = () => ({ queryClient: client, accessToken: 'token', userId: 'alice', currentUserProfile: user });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
  (fetchStampboxes as jest.Mock).mockResolvedValue(stamps);
  (fetchLatestVisitedStamp as jest.Mock).mockResolvedValue(null);
  (fetchFriendsOverview as jest.Mock).mockResolvedValue(friends);
  (fetchMapData as jest.Mock).mockResolvedValue({ stamps, parkingSpots: [] });
  (fetchProfileOverview as jest.Mock).mockResolvedValue({ stamps, friends: [] });
  (fetchAllPointsOfInterest as jest.Mock).mockResolvedValue([]);
  (fetchTours as jest.Mock).mockResolvedValue(tours);
  (fetchTourPath as jest.Mock).mockResolvedValue([]);
  (fetchCurrentUserProfile as jest.Mock).mockResolvedValue(user);
});
afterEach(() => client.clear());

test('startup joins the visible list request and simultaneous syncs, without rereading tour metadata', async () => {
  let release!: (value: typeof stamps) => void;
  (fetchStampboxes as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const visibleList = fetchSharedStampsOverview(client, 'token', 'alice');
  const first = runCoreOfflineSync(params());
  const second = runCoreOfflineSync(params());
  expect(first).toBe(second);
  await new Promise(resolve => setImmediate(resolve));
  expect(fetchStampboxes).toHaveBeenCalledTimes(1);
  release(stamps);
  await Promise.all([visibleList, first, second]);
  expect(fetchStampboxes).toHaveBeenCalledTimes(1);
  expect(fetchLatestVisitedStamp).toHaveBeenCalledTimes(1);
  expect(fetchTourById).not.toHaveBeenCalled();
  expect(fetchTourPath).toHaveBeenCalledTimes(tours.length);
  expect(fetchProfileOverview).toHaveBeenCalledWith('token', 'alice', user, stamps, friends);
  expect(client.getQueryData(queryKeys.tourDetail('alice', tours[0].ID))).toEqual({ tour: tours[0], path: [] });
});

test('restored complete recent data starts without any API requests', async () => {
  await runCoreOfflineSync(params());
  jest.clearAllMocks();
  await runCoreOfflineSync(params());
  for (const request of [fetchStampboxes, fetchMapData, fetchFriendsOverview, fetchProfileOverview, fetchTours, fetchTourPath]) {
    expect(request).not.toHaveBeenCalled();
  }
});

test('a recent sync marker does not hide missing cached list data', async () => {
  await runCoreOfflineSync(params());
  client.removeQueries({ queryKey: queryKeys.stampsOverviewByFilter('alice', 'validToday'), exact: true });
  await runCoreOfflineSync(params());
  expect(fetchStampboxes).toHaveBeenCalledTimes(2);
  expect(fetchMapData).toHaveBeenCalledTimes(1);
});

test('data older than fifteen minutes is refreshed despite the global infinite stale time', async () => {
  await runCoreOfflineSync(params());
  const oldTime = Date.now() - 20 * 60 * 1000;
  for (const query of client.getQueryCache().getAll()) {
    client.setQueryData(query.queryKey, query.state.data, { updatedAt: oldTime });
  }
  await AsyncStorage.setItem(metadataKey, JSON.stringify({ schemaVersion: 2, userId: 'alice', lastSyncAt: new Date(oldTime).toISOString() }));
  await runCoreOfflineSync(params());
  expect(fetchStampboxes).toHaveBeenCalledTimes(2);
  expect(fetchTourPath).toHaveBeenCalledTimes(tours.length * 2);
});

test('tour geometry preload has bounded concurrency', async () => {
  let active = 0, maximum = 0;
  (fetchTourPath as jest.Mock).mockImplementation(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return [];
  });
  await runCoreOfflineSync(params());
  expect(maximum).toBe(2);
});

test('logout or account switch stops subsequent work and does not record a completed sync', async () => {
  let current = true;
  let release!: (value: typeof stamps) => void;
  (fetchStampboxes as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const pending = runCoreOfflineSync({ ...params(), isSessionCurrent: () => current });
  await new Promise(resolve => setImmediate(resolve));
  current = false;
  release(stamps);
  await pending;
  expect(fetchMapData).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(metadataKey)).toBeNull();
  expect(client.getQueryData(queryKeys.mapData('bob'))).toBeUndefined();
});

test('does not start an anonymous sync while the user identity is unresolved', async () => {
  await runCoreOfflineSync({ ...params(), userId: undefined });
  expect(fetchStampboxes).not.toHaveBeenCalled();
});


test('a failed geometry refresh retains an already cached offline tour', async () => {
  const path = [{ rank: 1, travelTime: { positionString: '10;51;0;11;52;0;' } }];
  (fetchTourPath as jest.Mock).mockResolvedValue(path);
  await runCoreOfflineSync(params());
  const key = queryKeys.tourDetail('alice', tours[0].ID);
  const cached = client.getQueryData(key);
  client.setQueryData(key, cached, { updatedAt: Date.now() - 20 * 60 * 1000 });
  await AsyncStorage.removeItem(metadataKey);
  (fetchTourPath as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  await expect(runCoreOfflineSync(params())).rejects.toThrow('Network request failed');
  expect(client.getQueryData(key)).toEqual(cached);
  expect(await AsyncStorage.getItem(metadataKey)).toBeNull();
});


test('fills a missing offline tour even when the last sync marker is recent', async () => {
  await runCoreOfflineSync(params());
  client.removeQueries({ queryKey: queryKeys.tourDetail('alice', tours[0].ID), exact: true });
  await runCoreOfflineSync(params());
  expect(fetchTourPath).toHaveBeenCalledTimes(tours.length + 1);
  expect(fetchStampboxes).toHaveBeenCalledTimes(1);
});
