import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';
import { fetchCurrentUserProfile } from '@/lib/api';
let mockOffline = false;
let mockSession: any = null;
let mockLinkListener: (event: { url: string }) => void;
let mockAuthListener: (event: string, session: any) => void;
const mockStorage = new Map<string, string>();
const mockExchange = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
const mockRefreshStart = jest.fn(), mockRefreshStop = jest.fn();
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'harzerwanderbuddyapp://auth/callback' }));
jest.mock('expo-linking', () => ({ addEventListener: (_event: string, listener: typeof mockLinkListener) => { mockLinkListener = listener; return { remove: jest.fn() }; }, getInitialURL: async () => null }));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'sso', supabaseUrl: 'https://test.supabase.co', supabaseOAuthProviders: '' }, getMissingConfig: () => [] }));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOffline: mockOffline }) }));
jest.mock('@/lib/auth-storage', () => ({ clearLegacyAuthStorage: async () => {}, authStorage: {
  getItem: async (k: string) => mockStorage.get(k) ?? null,
  setItem: async (k: string, v: string) => { mockStorage.set(k, v); },
  removeItem: async (k: string) => { mockStorage.delete(k); },
} }));
jest.mock('@/lib/supabase', () => ({ supabaseStorageKey: 'session-key', getSupabase: () => ({ auth: {
  getSession: async () => ({ data: { session: mockSession }, error: null }),
  onAuthStateChange: (listener: typeof mockAuthListener) => { mockAuthListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
  startAutoRefresh: mockRefreshStart, stopAutoRefresh: mockRefreshStop, signOut: mockSignOut,
  exchangeCodeForSession: mockExchange,
} }) }));
jest.mock('@/lib/api', () => ({ fetchCurrentUserProfile: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ queryClient: { cancelQueries: jest.fn(async () => {}), clear: jest.fn() } }));
jest.mock('@/lib/query-persistence', () => ({ clearPersistedQueryCache: jest.fn(async () => {}) }));
jest.mock('@/lib/static-website', () => ({ isStaticWebsite: false }));
const session = (id: string, expired = false) => ({ user: { id }, access_token: id, refresh_token: 'test-only', expires_at: expired ? 1 : Date.now() / 1000 + 300, expires_in: 300 });
const profileKey = (id: string) => `hwb-supabase-profile-https---test.supabase.co-${id}`;
function wrapper({ children }: React.PropsWithChildren) { return <AuthProvider>{children}</AuthProvider>; }
beforeEach(() => {
  jest.clearAllMocks(); mockStorage.clear(); mockOffline = false; mockSession = null;
  (fetchCurrentUserProfile as jest.Mock).mockImplementation(async id => ({ id: `internal-${id}`, name: id, onboardingCompleted: true }));
});
it('keeps only the same owner offline profile and never returns an expired token for network writes', async () => {
  mockOffline = true; mockSession = session('alice', true);
  mockStorage.set('session-key', JSON.stringify(mockSession));
  mockStorage.set('hwb-supabase-cache-owner', 'https://test.supabase.co|alice');
  mockStorage.set(profileKey('alice'), JSON.stringify({ id: 'internal-alice', name: 'Alice', onboardingCompleted: true }));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.currentUserProfile?.id).toBe('internal-alice');
  expect(hook.result.current.canPerformWrites).toBe(false);
  expect(await hook.result.current.getValidAccessToken()).toBeNull();
  expect(fetchCurrentUserProfile).not.toHaveBeenCalled();
});
it('clears personal caches before exposing another user and uses the backend internal ID', async () => {
  mockSession = session('alice');
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.currentUserProfile?.id).toBe('internal-alice'));
  await act(async () => { mockAuthListener('SIGNED_IN', session('bob')); });
  await waitFor(() => expect(hook.result.current.currentUserProfile?.id).toBe('internal-bob'));
  expect(queryClient.clear).toHaveBeenCalledTimes(2);
});
it('discards a profile request completing after logout and rejects delayed signed-in events', async () => {
  mockSession = session('alice');
  let resolve!: (profile: unknown) => void;
  (fetchCurrentUserProfile as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(fetchCurrentUserProfile).toHaveBeenCalled());
  await act(async () => { await hook.result.current.logout(); resolve({ id: 'internal-alice' }); mockAuthListener('TOKEN_REFRESHED', session('alice')); });
  await waitFor(() => expect(hook.result.current.isAuthenticated).toBe(false));
  expect(hook.result.current.currentUserProfile).toBeNull();
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('marks password recovery so the login route shows the password update form', async () => {
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  await act(async () => { mockAuthListener('PASSWORD_RECOVERY', session('alice')); });
  await waitFor(() => expect(hook.result.current.passwordRecovery).toBe(true));
});

it('only exchanges exact native callbacks, deduplicates codes and surfaces expired-link errors', async () => {
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  mockExchange.mockResolvedValueOnce({ data: { session: session('alice') }, error: null });
  await act(async () => {
    mockLinkListener({ url: 'otherapp://auth/callback?code=foreign' });
    mockLinkListener({ url: 'harzerwanderbuddyapp://auth/callback?code=valid' });
    mockLinkListener({ url: 'harzerwanderbuddyapp://auth/callback?code=valid' });
  });
  await waitFor(() => expect(hook.result.current.currentUserProfile?.id).toBe('internal-alice'));
  expect(mockExchange).toHaveBeenCalledTimes(1);
  expect(mockExchange).toHaveBeenCalledWith('valid');
  mockExchange.mockResolvedValueOnce({ data: { session: null }, error: { message: 'expired' } });
  await act(async () => { mockLinkListener({ url: 'harzerwanderbuddyapp://auth/callback?code=expired' }); });
  await waitFor(() => expect(hook.result.current.authError).toContain('abgelaufen'));
});

it('never hands an outbox a different SDK user token during account transition', async () => {
  mockSession = session('alice');
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.currentUserProfile?.id).toBe('internal-alice'));
  mockSession = session('bob');
  expect(await hook.result.current.getValidAccessToken()).toBeNull();
});
