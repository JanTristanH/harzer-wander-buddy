import { act, render, waitFor } from '@testing-library/react-native';
import { IsRestoringProvider, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { CoreOfflineSyncBridge } from '@/lib/startup-sync';
import { runCoreOfflineSync } from '@/lib/core-offline-sync';

let mockRestoring = true;
let mockOnline = true;
let mockUserId: string | undefined = 'alice';
const mockGetToken = jest.fn();
let mockAuth = { accessToken: 'old-token', currentUserProfile: null,
  getValidAccessToken: mockGetToken, isAuthenticated: true, isLoading: false };
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth, useIdTokenClaims: () => ({ sub: mockUserId }) }));
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOnline: mockOnline }) }));
jest.mock('@/lib/core-offline-sync', () => ({ runCoreOfflineSync: jest.fn(async () => undefined) }));
let client: QueryClient;
function Harness() {
  return <QueryClientProvider client={client}><IsRestoringProvider value={mockRestoring}>
    <CoreOfflineSyncBridge />
  </IsRestoringProvider></QueryClientProvider>;
}
beforeEach(() => {
  jest.clearAllMocks(); mockGetToken.mockReset().mockResolvedValue('fresh-token');
  mockRestoring = true; mockOnline = true; mockUserId = 'alice';
  mockAuth = { accessToken: 'old-token', currentUserProfile: null,
    getValidAccessToken: mockGetToken, isAuthenticated: true, isLoading: false };
  client = new QueryClient();
});
afterEach(() => client.clear());

it('waits for hydration and uses the shared valid token instead of the restored expired token', async () => {
  const view = render(<Harness />);
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(runCoreOfflineSync).not.toHaveBeenCalled();
  mockRestoring = false;
  view.rerender(<Harness />);
  await waitFor(() => expect(runCoreOfflineSync).toHaveBeenCalledTimes(1));
  expect(runCoreOfflineSync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', accessToken: 'fresh-token' }));
});

it('does not start anonymous, offline or still-authenticating work', async () => {
  mockRestoring = false; mockOnline = false;
  const view = render(<Harness />);
  expect(mockGetToken).not.toHaveBeenCalled();
  mockOnline = true; mockUserId = undefined;
  view.rerender(<Harness />);
  expect(mockGetToken).not.toHaveBeenCalled();
  mockUserId = 'alice'; mockAuth.isLoading = true;
  view.rerender(<Harness />);
  expect(mockGetToken).not.toHaveBeenCalled();
});

it('does not launch an old account sync when token restoration finishes after logout', async () => {
  mockRestoring = false;
  let release!: (token: string) => void;
  mockGetToken.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = render(<Harness />);
  await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(1));
  mockAuth.isAuthenticated = false;
  view.rerender(<Harness />);
  await act(async () => { release('old-account-token'); });
  expect(runCoreOfflineSync).not.toHaveBeenCalled();
});
