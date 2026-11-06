import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { syncOfflineStamping, type Stampbox } from '@/lib/api';
import { NativeOfflineVisitsProvider } from '@/lib/native-offline-visits';
import { useOfflineVisits } from '@/lib/offline-visits';

let mockUser = 'alice'; let mockOnline = false; let mockNumber = 0;
const mockInvalidate = jest.fn(async () => undefined);
const mockQueryClient = { invalidateQueries: mockInvalidate };
const mockToken = jest.fn(async () => `token-for-${mockUser}`);
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: Boolean(mockUser), getValidAccessToken: mockToken }),
  useIdTokenClaims: () => ({ sub: mockUser }),
}));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOnline: mockOnline }) }));
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://backend.test' } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `11111111-1111-4111-8111-${String(++mockNumber).padStart(12, '0')}` }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), syncOfflineStamping: jest.fn(async () => undefined) }));
const mockSync = syncOfflineStamping as jest.MockedFunction<typeof syncOfflineStamping>;
const stamp = { ID: 'stamp', number: '1', name: 'Brocken', hasVisited: false } as Stampbox;
const originalPlatform = Platform.OS;
function wrapper({ children }: React.PropsWithChildren) { return <NativeOfflineVisitsProvider>{children}</NativeOfflineVisitsProvider>; }
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockUser = 'alice'; mockOnline = false; mockNumber = 0; jest.clearAllMocks(); await AsyncStorage.clear();
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); });

it('records offline, restores on remount and uploads with the same visit time on reconnect', async () => {
  const first = renderHook(useOfflineVisits, { wrapper });
  await waitFor(() => expect(first.result.current.canRecord).toBe(true));
  await act(async () => { await first.result.current.record(stamp); });
  const original = first.result.current.entries[0]; expect(mockSync).not.toHaveBeenCalled(); first.unmount();
  const second = renderHook(useOfflineVisits, { wrapper });
  await waitFor(() => expect(second.result.current.entries).toHaveLength(1));
  mockOnline = true; second.rerender({});
  await waitFor(() => expect(second.result.current.entries).toHaveLength(0));
  expect(mockSync).toHaveBeenCalledWith('token-for-alice', 'alice', original);
});

it('hides pending visits on logout/account switch and reloads them only for their owner', async () => {
  const view = renderHook(useOfflineVisits, { wrapper });
  await waitFor(() => expect(view.result.current.canRecord).toBe(true));
  await act(async () => { await view.result.current.record(stamp); });
  mockUser = 'bob'; view.rerender({});
  await waitFor(() => expect(view.result.current.canRecord).toBe(true));
  expect(view.result.current.entries).toEqual([]);
  mockUser = ''; view.rerender({}); expect(view.result.current.canRecord).toBe(false); expect(view.result.current.entries).toEqual([]);
  mockUser = 'alice'; view.rerender({});
  await waitFor(() => expect(view.result.current.entries).toHaveLength(1));
  expect(mockSync).not.toHaveBeenCalled();
});

it('never enables the native outbox on web', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  const view = renderHook(useOfflineVisits, { wrapper });
  expect(view.result.current.canRecord).toBe(false);
  await expect(view.result.current.record(stamp)).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('does not publish a saved visit when device storage rejects the write', async () => {
  const view = renderHook(useOfflineVisits, { wrapper });
  await waitFor(() => expect(view.result.current.canRecord).toBe(true));
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { await expect(view.result.current.record(stamp)).rejects.toThrow('nicht sicher'); });
  expect(view.result.current.entries).toHaveLength(0);
  expect(view.result.current.canRecord).toBe(false);
  expect(view.result.current.storageError).toContain('nicht sicher');
});
