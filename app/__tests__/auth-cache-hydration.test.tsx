import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dehydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, type PersistedClient } from '@tanstack/react-query-persist-client';
import React from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ConnectivityProvider } from '@/lib/connectivity';
import { fetchCurrentUserProfile } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { queryKeys, useFilteredStampsOverviewQuery } from '@/lib/queries';

const mockSecrets = new Map<string, string>();
let mockSavedClient: PersistedClient | undefined;
let mockNetwork = { isConnected: false, isInternetReachable: false };
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => mockNetwork, addEventListener: () => () => {} },
  useNetInfo: () => mockNetwork,
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecrets.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecrets.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecrets.delete(key); }),
}));
jest.mock('expo-auth-session', () => ({
  ...jest.requireActual('expo-auth-session'), fetchDiscoveryAsync: jest.fn(), refreshAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'sso', auth0Domain: 'auth.test' },
  getMissingConfig: () => [], getAuth0ClientIdForPlatform: () => 'client' }));
jest.mock('@/lib/api', () => ({ fetchCurrentUserProfile: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ queryClient: new (jest.requireActual('@tanstack/react-query').QueryClient)({
  defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnMount: false } },
}) }));
jest.mock('@/lib/query-persistence', () => ({ clearPersistedQueryCache: async () => { mockSavedClient = undefined; } }));
jest.mock('@/lib/static-website', () => ({ isStaticWebsite: false }));

const profile = { id: 'alice', name: 'Alice', onboardingCompleted: true };
const overview = { stamps: [{ ID: 'cached-stamp', name: 'Brocken', hasVisited: true }], lastVisited: null };
function seedSession(userId = 'alice') {
  const jwt = ['header', Buffer.from(JSON.stringify({ sub: userId, name: userId })).toString('base64url'), 'signature'].join('.');
  mockSecrets.set('hwb-auth-token-response-metadata', JSON.stringify({ storageVersion: 2, issuedAt: 1, expiresIn: 60 }));
  mockSecrets.set('hwb-auth-token-response-access-token', jwt);
  mockSecrets.set('hwb-auth-token-response-id-token', jwt);
}
function snapshot(legacyList: boolean, updatedAt = Date.now()): PersistedClient {
  const source = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  source.setQueryData(['current-user-profile', 'alice'], profile, { updatedAt });
  source.setQueryData(legacyList ? queryKeys.stampsOverview('alice')
    : queryKeys.stampsOverviewByFilter('alice', 'validToday'), overview);
  const result = { timestamp: Date.now(), buster: 'test', clientState: dehydrate(source) };
  source.clear();
  return result;
}
function setupRestore() {
  let release!: (value: PersistedClient) => void;
  const pending = new Promise<PersistedClient>(resolve => { release = resolve; });
  const persister = {
    restoreClient: jest.fn().mockImplementationOnce(() => pending).mockImplementation(async () => mockSavedClient),
    persistClient: async (value: PersistedClient) => { mockSavedClient = value; },
    removeClient: async () => { mockSavedClient = undefined; },
  };
  function wrapper({ children }: React.PropsWithChildren) {
    return <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, buster: 'test' }}>
      <ConnectivityProvider><AuthProvider>{children}</AuthProvider></ConnectivityProvider>
    </PersistQueryClientProvider>;
  }
  return { wrapper, release };
}
beforeEach(() => {
  mockNetwork = { isConnected: false, isInternetReachable: false };
  jest.clearAllMocks(); mockSecrets.clear(); mockSavedClient = undefined; queryClient.clear();
  onlineManager.setOnline(false);
});
afterEach(() => { queryClient.clear(); onlineManager.setOnline(true); });

it.each([false, true])('restores the offline session and cached list after delayed hydration (legacy=%s)', async legacy => {
  seedSession();
  const { wrapper, release } = setupRestore();
  const view = renderHook(() => ({ auth: useAuth(), list: useFilteredStampsOverviewQuery('validToday') }), { wrapper });
  expect(view.result.current.auth.isLoading).toBe(true);
  expect(view.result.current.auth.isAuthenticated).toBe(false);
  expect(fetchCurrentUserProfile).not.toHaveBeenCalled();
  await act(async () => { release(snapshot(legacy)); });
  await waitFor(() => expect(view.result.current.auth.isLoading).toBe(false));
  expect(view.result.current.auth.isAuthenticated).toBe(true);
  expect(view.result.current.auth.sessionMode).toBe('offline_grace');
  expect(view.result.current.auth.currentUserProfile).toEqual(profile);
  expect(view.result.current.auth.hasCompletedOnboarding).toBe(true);
  expect(view.result.current.list.data).toEqual(overview);
  expect(fetchCurrentUserProfile).not.toHaveBeenCalled();
  view.unmount();
});

it('an explicitly logged-out user stays logged out on an offline restart', async () => {
  seedSession();
  const { wrapper, release } = setupRestore();
  const first = renderHook(useAuth, { wrapper });
  await act(async () => { release(snapshot(false)); });
  await waitFor(() => expect(first.result.current.isLoading).toBe(false));
  await act(async () => { await first.result.current.logout(); });
  expect(first.result.current.isAuthenticated).toBe(false);
  first.unmount();
  queryClient.clear();
  const second = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(second.result.current.isLoading).toBe(false));
  expect(second.result.current.isAuthenticated).toBe(false);
  expect(second.result.current.currentUserProfile).toBeNull();
  expect([...mockSecrets.keys()].some(key => key.startsWith('hwb-auth-token-response'))).toBe(false);
  expect(queryClient.getQueryData(['current-user-profile', 'alice'])).toBeUndefined();
  second.unmount();
});

it('does not show another account profile or list from the restored cache', async () => {
  seedSession('bob');
  const { wrapper, release } = setupRestore();
  const view = renderHook(() => ({ auth: useAuth(), list: useFilteredStampsOverviewQuery('validToday') }), { wrapper });
  await act(async () => { release(snapshot(false)); });
  await waitFor(() => expect(view.result.current.auth.isLoading).toBe(false));
  expect(view.result.current.auth.isAuthenticated).toBe(true);
  expect(view.result.current.auth.currentUserProfile).toBeNull();
  expect(view.result.current.list.data).toBeUndefined();
  view.unmount();
});

it('applying a restored account profile does not make old cached data look freshly fetched', async () => {
  seedSession();
  const updatedAt = Date.now() - 5 * 60 * 1000;
  const { wrapper, release } = setupRestore();
  const view = renderHook(useAuth, { wrapper });
  await act(async () => { release(snapshot(false, updatedAt)); });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(queryClient.getQueryState(['current-user-profile', 'alice'])?.dataUpdatedAt).toBe(updatedAt);
  view.unmount();
});

it('shows an old profile immediately and refreshes it once in the background when online', async () => {
  seedSession();
  mockNetwork = { isConnected: true, isInternetReachable: true };
  onlineManager.setOnline(true);
  mockSecrets.set('hwb-auth-token-response-metadata', JSON.stringify({ storageVersion: 2,
    issuedAt: Math.floor(Date.now() / 1000), expiresIn: 3600 }));
  let finish!: (value: typeof profile) => void;
  (fetchCurrentUserProfile as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { wrapper, release } = setupRestore();
  const view = renderHook(useAuth, { wrapper });
  await act(async () => { release(snapshot(false, Date.now() - 20 * 60 * 1000)); });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(view.result.current.currentUserProfile).toEqual(profile);
  await waitFor(() => expect(fetchCurrentUserProfile).toHaveBeenCalledTimes(1));
  await act(async () => { finish({ ...profile, name: 'Alice aktualisiert' }); });
  await waitFor(() => expect(view.result.current.currentUserProfile?.name).toBe('Alice aktualisiert'));
  view.unmount();
});


it('reuses the correct offline user cache when the stored session has no separate ID token', async () => {
  seedSession();
  mockSecrets.delete('hwb-auth-token-response-id-token');
  const { wrapper, release } = setupRestore();
  const view = renderHook(() => ({ auth: useAuth(), list: useFilteredStampsOverviewQuery('validToday') }), { wrapper });
  await act(async () => { release(snapshot(false)); });
  await waitFor(() => expect(view.result.current.auth.isLoading).toBe(false));
  expect(view.result.current.auth.isAuthenticated).toBe(true);
  expect(view.result.current.list.data).toEqual(overview);
  expect(fetchCurrentUserProfile).not.toHaveBeenCalled();
  view.unmount();
});
