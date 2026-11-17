import { act, renderHook } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
} from '@tanstack/react-query';
import React from 'react';
import {
  calculateHikingRoute,
  createTour,
  type HikingRouteParameters,
} from '@/lib/api';
import { useTourSuggestions } from '@/lib/tour-suggestions';

let mockUserId = 'alice';
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: true, canPerformWrites: true }),
  useIdTokenClaims: () => ({ sub: mockUserId }),
}));
jest.mock('@/lib/queries', () => ({
  useAuthorizedRequest: () => (request: (token: string) => unknown) =>
    request('token'),
}));
jest.mock('@/lib/api', () => ({
  calculateHikingRoute: jest.fn(),
  createTour: jest.fn(),
}));

test('retains all proposals and saved IDs, prevents repeated saves, persists and isolates accounts', async () => {
  mockUserId = 'alice';
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const route = { id: 'edge-1', idListTravelTimes: 'edge-1' };
  jest
    .mocked(calculateHikingRoute)
    .mockResolvedValue({
      results: [route, { id: 'edge-2' }],
      searchLimited: false,
    } as Awaited<ReturnType<typeof calculateHikingRoute>>);
  jest
    .mocked(createTour)
    .mockResolvedValue({ ID: 'saved-tour' } as Awaited<
      ReturnType<typeof createTour>
    >);
  const { result, rerender } = renderHook(() => useTourSuggestions(), {
    wrapper,
  });
  const parameters = { maxDuration: 7200 } as HikingRouteParameters;
  let sessionId = '';
  await act(async () => {
    sessionId = (await result.current.generation.mutateAsync(parameters))
      .sessionId;
  });
  await act(async () => {
    await result.current.save.mutateAsync({
      route: route as never,
      name: 'Meine Runde',
      sessionId,
    });
  });
  await act(async () => {
    await result.current.save.mutateAsync({
      route: route as never,
      name: 'Meine Runde',
      sessionId,
    });
  });
  expect(createTour).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['tour-suggestions', 'alice'])).toMatchObject({
    savedTourIds: { 'edge-1': 'saved-tour' },
    results: [route, { id: 'edge-2' }],
  });
  const restored = new QueryClient();
  hydrate(restored, JSON.parse(JSON.stringify(dehydrate(client))));
  expect(restored.getQueryData(['tour-suggestions', 'alice'])).toMatchObject({
    sessionId,
    savedTourIds: { 'edge-1': 'saved-tour' },
  });
  mockUserId = 'bob';
  rerender({});
  expect(result.current.suggestions).toBeUndefined();
  client.clear();
  restored.clear();
});
