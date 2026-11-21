import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { fetchPendingNoticeCount } from '@/lib/api';
import { usePendingNoticeBadge } from '@/lib/queries';

let mockOnline = true;
jest.mock('@/lib/connectivity', () => ({ useConnectivity: () => ({ isOnline: mockOnline }) }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ accessToken: 'session', isAuthenticated: true, getValidAccessToken: async () => 'session' }),
  useIdTokenClaims: () => ({ sub: 'admin' }),
}));
jest.mock('@/lib/api', () => ({ fetchPendingNoticeCount: jest.fn() }));

test('only shows positive counts while authorized and online, and refreshes on profile focus', async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: React.PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const fetchCount = jest.mocked(fetchPendingNoticeCount);
  fetchCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  const { result, rerender } = renderHook((active: boolean) => usePendingNoticeBadge(active), {
    initialProps: false, wrapper,
  });
  expect(fetchCount).not.toHaveBeenCalled();
  expect(result.current).toBeUndefined();
  rerender(true);
  await waitFor(() => expect(result.current).toBe('2 offene Meldungen'));
  rerender(false);
  expect(result.current).toBeUndefined();
  rerender(true);
  await waitFor(() => expect(result.current).toBe('1 offene Meldung'));
  mockOnline = false;
  rerender(true);
  expect(result.current).toBeUndefined();
  mockOnline = true;
  rerender(true);
  await waitFor(() => expect(result.current).toBeUndefined());
  expect(fetchCount).toHaveBeenCalledTimes(3);
});
