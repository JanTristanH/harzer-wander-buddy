import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AdminImageCompression } from '@/components/admin-image-compression';
import { compressExistingImages, HttpStatusError, type ImageCompressionResult } from '@/lib/api';

let mockOnline = true;
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
const mockLogout = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => ({
  accessToken: 'token', canPerformWrites: mockOnline, isOffline: !mockOnline, logout: mockLogout,
}) }));
jest.mock('@/lib/api', () => ({
  compressExistingImages: jest.fn(),
  HttpStatusError: class extends Error {
    status: number;
    constructor(code: number) { super(); this.status = code; }
  },
}));
const compress = compressExistingImages as jest.Mock;
const batch: ImageCompressionResult = {
  compressed: 2, processed: 2, skipped: 0, failed: 0, bytesSaved: 1048576, hasMore: false, nextAfterId: 'last',
};
function deferred() {
  let resolve!: (value: ImageCompressionResult) => void;
  const promise = new Promise<ImageCompressionResult>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockFocused = true;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});

test('processes all batches and displays total savings and failures', async () => {
  compress.mockResolvedValueOnce({ ...batch, hasMore: true, nextAfterId: 'cursor' })
    .mockResolvedValueOnce({ ...batch, failed: 1 });
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  await screen.findByText('Durchlauf abgeschlossen');
  expect(compress.mock.calls).toEqual([['token', undefined], ['token', 'cursor']]);
  expect(screen.getByText('2.00 MiB eingespart')).toBeTruthy();
  expect(screen.getByText('4 verkleinert · 0 unverändert · 1 fehlgeschlagen')).toBeTruthy();
});

test('pauses after the in-flight batch and resumes from its cursor', async () => {
  const pending = deferred();
  compress.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(batch);
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  fireEvent.press(screen.getByText('Pausieren'));
  await act(async () => pending.resolve({ ...batch, hasMore: true, nextAfterId: 'cursor' }));
  expect(screen.getByText('Pausiert')).toBeTruthy();
  expect(compress).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Komprimierung fortsetzen'));
  await screen.findByText('Durchlauf abgeschlossen');
  expect(compress).toHaveBeenLastCalledWith('token', 'cursor');
});

test('retries failed batches from the last successful cursor', async () => {
  compress.mockResolvedValueOnce({ ...batch, hasMore: true, nextAfterId: 'cursor' })
    .mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce(batch);
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  await screen.findByText('Durchlauf unterbrochen');
  fireEvent.press(screen.getByText('Komprimierung fortsetzen'));
  await screen.findByText('Durchlauf abgeschlossen');
  expect(compress.mock.calls).toEqual([['token', undefined], ['token', 'cursor'], ['token', 'cursor']]);
});

test('does not start offline', () => {
  mockOnline = false;
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  expect(compress).not.toHaveBeenCalled();
});

test('stops scheduling requests when the screen unmounts', async () => {
  const pending = deferred();
  compress.mockReturnValueOnce(pending.promise);
  const { unmount } = render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  unmount();
  await act(async () => pending.resolve({ ...batch, hasMore: true, nextAfterId: 'cursor' }));
  expect(compress).toHaveBeenCalledTimes(1);
});

test('pauses when the app enters the background', async () => {
  let onChange!: (state: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    onChange = callback;
    return { remove: jest.fn() };
  });
  const pending = deferred();
  compress.mockReturnValueOnce(pending.promise);
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  act(() => onChange('background'));
  await act(async () => pending.resolve({ ...batch, hasMore: true, nextAfterId: 'cursor' }));
  expect(screen.getByText('Pausiert')).toBeTruthy();
  expect(compress).toHaveBeenCalledTimes(1);
  listener.mockRestore();
});

test('shows permission errors and logs out for expired sessions', async () => {
  compress.mockRejectedValueOnce(new HttpStatusError(403, 'Forbidden'));
  render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  await screen.findByText('Nur Admins dürfen Bilder komprimieren.');
  compress.mockRejectedValueOnce(Object.assign(new Error('Expired'), { name: 'UnauthorizedError' }));
  fireEvent.press(screen.getByText('Komprimierung fortsetzen'));
  await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
});

test('pauses when navigating away even if the screen remains mounted', async () => {
  const pending = deferred();
  compress.mockReturnValueOnce(pending.promise);
  const { rerender } = render(<AdminImageCompression />);
  fireEvent.press(screen.getByText('Komprimierung starten'));
  mockFocused = false;
  rerender(<AdminImageCompression />);
  await act(async () => pending.resolve({ ...batch, hasMore: true, nextAfterId: 'cursor' }));
  expect(screen.getByText('Pausiert')).toBeTruthy();
  expect(compress).toHaveBeenCalledTimes(1);
});
