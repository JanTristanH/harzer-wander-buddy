import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { syncStampNote } from '@/lib/api';
import { NativeOfflineNotesProvider, useOfflineNotes } from '@/lib/offline-notes';

let mockUser = 'alice'; let mockOnline = false;
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
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), syncStampNote: jest.fn(async () => ({ conflict: false, current: { ID: 'note', note: 'Notiz' } })) }));
const mockSync = syncStampNote as jest.MockedFunction<typeof syncStampNote>;
const stamp = { ID: 'stamp' };
const originalPlatform = Platform.OS;
function wrapper({ children }: React.PropsWithChildren) { return <NativeOfflineNotesProvider>{children}</NativeOfflineNotesProvider>; }
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockUser = 'alice'; mockOnline = false; jest.clearAllMocks(); await AsyncStorage.clear();
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); });

it('saves offline, restores on remount and uploads the same note and base on reconnect', async () => {
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

it('hides pending notes on logout/account switch and reloads them only for their owner', async () => {
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

it('does not report a saved note when device storage rejects the write', async () => {
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

it('keeps conflicts through remount and resumes only after explicit resolution', async () => {
  mockSync.mockResolvedValueOnce({ conflict: true, current: { ID: 'remote', note: 'anderes Gerät', modifiedAt: '2026-10-29T10:00:00Z' } });
  const first = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  await act(async () => { await first.result.current.save('stamp', 'lokal', null); });
  mockOnline = true; first.rerender({});
  await waitFor(() => expect(first.result.current.entries[0]?.status).toBe('conflict'));
  first.unmount();
  const restored = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(restored.result.current.ready).toBe(true));
  expect(restored.result.current.entries[0]).toMatchObject({ note: 'lokal', remote: { note: 'anderes Gerät' } });
  expect(mockSync).toHaveBeenCalledTimes(1);
  await act(async () => { await restored.result.current.resolve('stamp', 'local'); });
  await waitFor(() => expect(restored.result.current.entries).toHaveLength(0));
  expect(mockSync).toHaveBeenLastCalledWith('token-for-alice', 'stamp', 'lokal', expect.objectContaining({ ID: 'remote' }));
});

it('shows an upload error without losing work and retries after reconnect', async () => {
  mockSync.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(useOfflineNotes, { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  await act(async () => { await view.result.current.save('stamp', 'lokal', null); });
  mockOnline = true; view.rerender({});
  await waitFor(() => expect(view.result.current.entries[0]?.status).toBe('error'));
  expect(view.result.current.entries[0].note).toBe('lokal');
  mockOnline = false; view.rerender({}); mockOnline = true; view.rerender({});
  await waitFor(() => expect(view.result.current.entries).toHaveLength(0));
  expect(mockSync).toHaveBeenCalledTimes(2);
});
