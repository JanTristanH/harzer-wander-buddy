import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import type { NetInfoState } from '@react-native-community/netinfo';

import { AuthProvider, useAuth } from '@/lib/auth';
import { ConnectivityProvider } from '@/lib/connectivity';

let mockNetwork: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'> = { isConnected: null, isInternetReachable: null };
const mockStorage = new Map<string, string>();
const mockProfile = { id: 'alice', name: 'Alice', onboardingCompleted: true };
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => mockNetwork), addEventListener: jest.fn(() => () => {}) },
  useNetInfo: () => mockNetwork as unknown as NetInfoState,
}));
jest.mock('expo-auth-session', () => ({
  ...jest.requireActual('expo-auth-session'),
  fetchDiscoveryAsync: jest.fn(async () => ({ tokenEndpoint: 'https://auth.test/token' })),
  refreshAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'sso', auth0Domain: 'auth.test' }, getMissingConfig: () => [], getAuth0ClientIdForPlatform: () => 'client' }));
jest.mock('@/lib/api', () => ({ fetchCurrentUserProfile: jest.fn(async () => mockProfile) }));
jest.mock('@/lib/query-client', () => ({ queryClient: {
  getQueryData: jest.fn(() => mockProfile), setQueryData: jest.fn(),
  fetchQuery: jest.fn(async () => mockProfile), clear: jest.fn(),
} }));
jest.mock('@/lib/query-persistence', () => ({ clearPersistedQueryCache: async () => {} }));
jest.mock('@/lib/static-website', () => ({ isStaticWebsite: false }));

function wrapper({ children }: React.PropsWithChildren) {
  return <ConnectivityProvider><AuthProvider>{children}</AuthProvider></ConnectivityProvider>;
}
function seed(refreshToken?: string) {
  mockStorage.set('hwb-auth-token-response-metadata', JSON.stringify({ storageVersion: 2, issuedAt: 1, expiresIn: 60 }));
  mockStorage.set('hwb-auth-token-response-access-token', 'expired-access-token');
  if (refreshToken) mockStorage.set('hwb-auth-token-response-refresh-token', refreshToken);
}
beforeEach(() => {
  jest.clearAllMocks(); mockStorage.clear();
  mockNetwork = { isConnected: null, isInternetReachable: null };
});

it('restores an expired session before connectivity is known and survives an offline remount', async () => {
  seed();
  const first = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(first.result.current.isLoading).toBe(false));
  expect(first.result.current.isAuthenticated).toBe(true);
  expect(first.result.current.currentUserProfile?.name).toBe('Alice');
  first.unmount();
  mockNetwork = { isConnected: false, isInternetReachable: false };
  const second = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(second.result.current.isLoading).toBe(false));
  expect(second.result.current.isAuthenticated).toBe(true);
  expect(second.result.current.sessionMode).toBe('offline_grace');
  await act(async () => { expect(await second.result.current.getValidAccessToken()).toBe('expired-access-token'); });
  expect(AuthSession.fetchDiscoveryAsync).not.toHaveBeenCalled();
  expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('does not refresh offline, then refreshes and persists the session on reconnect', async () => {
  seed('refresh-token');
  (AuthSession.refreshAsync as jest.Mock).mockResolvedValue(new AuthSession.TokenResponse({ accessToken: 'fresh-token', expiresIn: 3600, issuedAt: Math.floor(Date.now() / 1000) }));
  const view = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  mockNetwork = { isConnected: true, isInternetReachable: true };
  view.rerender({});
  await waitFor(() => expect(view.result.current.accessToken).toBe('fresh-token'));
  expect(mockStorage.get('hwb-auth-token-response-refresh-token')).toBe('refresh-token');
  expect(view.result.current.sessionMode).toBe('online');
});

it('keeps the cached session when reachability fails during token refresh', async () => {
  seed('refresh-token');
  mockNetwork = { isConnected: true, isInternetReachable: true };
  (AuthSession.refreshAsync as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
  const view = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(view.result.current.sessionMode).toBe('offline_grace'));
  expect(view.result.current.isAuthenticated).toBe(true);
  expect(mockStorage.get('hwb-auth-token-response-access-token')).toBe('expired-access-token');
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('waits for Internet reachability before refreshing or invalidating a session', async () => {
  seed();
  mockNetwork = { isConnected: true, isInternetReachable: null };
  const view = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  expect(view.result.current.isAuthenticated).toBe(true);
  expect(AuthSession.fetchDiscoveryAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});

it('shares a single token refresh between startup and simultaneous outbox consumers', async () => {
  seed('refresh-token');
  mockNetwork = { isConnected: true, isInternetReachable: true };
  let finish!: (value: AuthSession.TokenResponse) => void;
  (AuthSession.refreshAsync as jest.Mock).mockImplementation(() => new Promise<AuthSession.TokenResponse>((resolve) => { finish = resolve; }));
  const view = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(AuthSession.refreshAsync).toHaveBeenCalledTimes(1));
  await act(async () => {
    const first = view.result.current.getValidAccessToken();
    const second = view.result.current.getValidAccessToken();
    finish(new AuthSession.TokenResponse({ accessToken: 'fresh-token', refreshToken: 'rotated-refresh-token', expiresIn: 3600, issuedAt: Math.floor(Date.now() / 1000) }));
    expect(await first).toBe('fresh-token');
    expect(await second).toBe('fresh-token');
  });
  expect(AuthSession.refreshAsync).toHaveBeenCalledTimes(1);
  expect(mockStorage.get('hwb-auth-token-response-refresh-token')).toBe('rotated-refresh-token');
});
