import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { syncStampNote, type Stampbox } from '@/lib/api';
import { NativeOfflineNotesProvider } from '@/lib/offline-notes';
import { useOfflineNotes } from '@/lib/offline-notes';

let mockUser = 'alice'; let mockOnline = false; let mockNumber = 0;
const mockInvalidate = jest.fn(async () => undefined);
const mockQueryClient = { invalidateQueries: mockInvalidate, setQueriesData: jest.fn() };
const mockToken = jest.fn(async () => `token-for-${mockUser}`);
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: Boolean(mockUser), getValidAccessToken: mockToken }),
  useIdTokenClaims: () => ({ sub: mockUser }),
}));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOnline: mockOnline }) }));
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://backend.test' } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `11111111-1111-4111-8111-${String(++mockNumber).padStart(12, '0')}` }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), syncStampNote: jest.fn(async () => ({ conflict: false, current: { ID: 'note', note: 'Notiz' } })) }));
const mockSync = syncStampNote as jest.MockedFunction<typeof syncStampNote>;
const stamp = { ID: 'stamp', number: '1', name: 'Brocken', hasVisited: false } as Stampbox;
const originalPlatform = Platform.OS;
function wrapper({ children }: React.PropsWithChildren) { return <NativeOfflineNotesProvider>{children}</NativeOfflineNotesProvider>; }
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockUser = 'alice'; mockOnline = false; mockNumber = 0; jest.clearAllMocks(); await AsyncStorage.clear();
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); });

it('records offline, restores on remount and uploads with the same visit time on reconnect', async () => {
  const first = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  await act(async () => { await first.result.current.save(stamp.ID, 'Notiz', null); });
  const original = first.result.current.entries[0]; expect(mockSync).not.toHaveBeenCalled(); first.unmount();
  const second = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(second.result.current.entries).toHaveLength(1));
  mockOnline = true; second.rerender({});
  await waitFor(() => expect(second.result.current.entries).toHaveLength(0));
  expect(mockSync).toHaveBeenCalledWith('token-for-alice', original.stampId, original.note, original.base);
});

it('hides pending visits on logout/account switch and reloads them only for their owner', async () => {
  const view = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  await act(async () => { await view.result.current.save(stamp.ID, 'Notiz', null); });
  mockUser = 'bob'; view.rerender({});
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  expect(view.result.current.entries).toEqual([]);
  mockUser = ''; view.rerender({}); expect(view.result.current.ready).toBe(false); expect(view.result.current.entries).toEqual([]);
  mockUser = 'alice'; view.rerender({});
  await waitFor(() => expect(view.result.current.entries).toHaveLength(1));
  expect(mockSync).not.toHaveBeenCalled();
});

it('never enables the native outbox on web', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  const view = renderHook(useOfflineNotes, { wrapper });
  expect(view.result.current.ready).toBe(false);
  await expect(view.result.current.save(stamp.ID, 'Notiz', null)).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('does not publish a saved visit when device storage rejects the write', async () => {
  const view = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { await expect(view.result.current.save(stamp.ID, 'Notiz', null)).rejects.toThrow('nicht sicher'); });
  expect(view.result.current.entries).toHaveLength(0);
  expect(view.result.current.storageError).toContain('nicht sicher');
});

it('rechecks the account after async token renewal before sending', async () => {
  const view = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  await act(async () => { await view.result.current.save('stamp', 'privat', null); });
  let finish!: (token: string) => void;
  mockToken.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  mockOnline = true; view.rerender({});
  await waitFor(() => expect(finish).toBeDefined());
  mockUser = 'bob'; view.rerender({});
  await act(async () => { finish('token-for-alice'); });
  expect(mockSync).not.toHaveBeenCalled();
  expect(view.result.current.entries).toEqual([]);
});
