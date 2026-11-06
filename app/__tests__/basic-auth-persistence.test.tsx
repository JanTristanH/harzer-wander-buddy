import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Platform } from 'react-native';

import { fetchCurrentUserProfile } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';

const mockStorage = new Map<string, string>();
let mockOffline = false;
const profile = { id: 'test-user', name: 'Test user', onboardingCompleted: true };
jest.mock('expo-auth-session', () => ({}));
jest.mock('expo-web-browser', () => ({}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));
jest.mock('@/lib/config', () => ({ appConfig: { authMode: 'basic' } }));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOffline: mockOffline }) }));
jest.mock('@/lib/api', () => ({ fetchCurrentUserProfile: jest.fn(), updateCurrentUserOnboardingCompleted: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@/lib/query-persistence', () => ({ clearPersistedQueryCache: async () => {} }));
jest.mock('@/lib/static-website', () => ({ isStaticWebsite: false }));

function wrapper({ children }: React.PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
async function start() {
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  mockOffline = false;
  (fetchCurrentUserProfile as jest.Mock).mockResolvedValue(profile);
});

test.each(['android', 'ios'] as const)('restores login and onboarding after a %s process restart, including offline', async (platform) => {
  const originalPlatform = Platform.OS;
  Platform.OS = platform;
  try {
    const first = await start();
    await act(async () => { await first.result.current.login('test-user', 'test-password'); });
    expect(first.result.current.isAuthenticated).toBe(true);
    const token = first.result.current.accessToken;
    first.unmount();
    mockOffline = true;
    (fetchCurrentUserProfile as jest.Mock).mockRejectedValue(new Error('Offline'));
    const second = await start();
    expect(second.result.current.accessToken).toBe(token);
    expect(second.result.current.currentUserProfile).toEqual(profile);
    expect(second.result.current.hasCompletedOnboarding).toBe(true);
    expect(second.result.current.canPerformWrites).toBe(false);
    expect(fetchCurrentUserProfile).toHaveBeenCalledTimes(1);
    await act(async () => { await second.result.current.logout(); });
    second.unmount();
    const third = await start();
    expect(third.result.current.isAuthenticated).toBe(false);
    expect(third.result.current.currentUserProfile).toBeNull();
  } finally {
    Platform.OS = originalPlatform;
  }
});

test('does not report successful login when secure persistence fails', async () => {
  (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Keystore unavailable'));
  const hook = await start();
  await act(async () => { await hook.result.current.login('test-user', 'test-password'); });
  expect(hook.result.current.isAuthenticated).toBe(false);
  expect(hook.result.current.authError).toBeTruthy();
  expect(mockStorage.size).toBe(0);
});

test('does not persist rejected credentials', async () => {
  (fetchCurrentUserProfile as jest.Mock).mockRejectedValue(Object.assign(new Error('Unauthorized'), { name: 'UnauthorizedError' }));
  const hook = await start();
  await act(async () => { await hook.result.current.login('test-user', 'wrong-password'); });
  expect(hook.result.current.isAuthenticated).toBe(false);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('discards corrupt session data without getting stuck during startup', async () => {
  mockStorage.set('hwb-basic-auth-session', '{broken');
  const hook = await start();
  expect(hook.result.current.isAuthenticated).toBe(false);
  expect(mockStorage.size).toBe(0);
});

test('a profile request completing after logout cannot restore the saved session', async () => {
  const hook = await start();
  await act(async () => { await hook.result.current.login('test-user', 'test-password'); });
  let finishProfile!: (value: typeof profile) => void;
  (fetchCurrentUserProfile as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finishProfile = resolve; }));
  let request!: Promise<unknown>;
  act(() => { request = hook.result.current.preloadCurrentUserProfile(); });
  await act(async () => { await hook.result.current.logout(); });
  await act(async () => { finishProfile(profile); await request; });
  expect(hook.result.current.isAuthenticated).toBe(false);
  expect(mockStorage.size).toBe(0);
  hook.unmount();
  const restarted = await start();
  expect(restarted.result.current.isAuthenticated).toBe(false);
});

test('updated onboarding status survives the next restart', async () => {
  const hook = await start();
  (fetchCurrentUserProfile as jest.Mock).mockResolvedValueOnce({ ...profile, onboardingCompleted: false });
  await act(async () => { await hook.result.current.login('test-user', 'test-password'); });
  expect(hook.result.current.hasCompletedOnboarding).toBe(false);
  await act(async () => { await hook.result.current.preloadCurrentUserProfile(); });
  hook.unmount();
  const restarted = await start();
  expect(restarted.result.current.hasCompletedOnboarding).toBe(true);
});

test('keeps browser Basic credentials in memory only', async () => {
  const originalPlatform = Platform.OS;
  Platform.OS = 'web';
  try {
    const hook = await start();
    await act(async () => { await hook.result.current.login('test-user', 'test-password'); });
    expect(hook.result.current.isAuthenticated).toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    hook.unmount();
    const restarted = await start();
    expect(restarted.result.current.isAuthenticated).toBe(false);
  } finally {
    Platform.OS = originalPlatform;
  }
});
