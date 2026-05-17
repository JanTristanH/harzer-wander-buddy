import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

export const TAB_QUERY_STALE_TIME = Number.POSITIVE_INFINITY;
export const TAB_QUERY_GC_TIME = Platform.OS === 'web' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TAB_QUERY_STALE_TIME,
      gcTime: TAB_QUERY_GC_TIME,
      retry: 1,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
