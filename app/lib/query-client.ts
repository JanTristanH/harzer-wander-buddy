import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { isPreviewBuild, recordPreviewEvent } from './preview-diagnostics';

export const TAB_QUERY_STALE_TIME = Number.POSITIVE_INFINITY;
export const TAB_QUERY_GC_TIME = Platform.OS === 'web' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  queryCache: isPreviewBuild ? new QueryCache({
    onError: (error, query) => {
      // Never log complete query keys: later entries may contain user IDs/tokens.
      void recordPreviewEvent('query.failed', `${String(query.queryKey[0])}: ${error.message}`, 'error');
    },
  }) : undefined,
  mutationCache: isPreviewBuild ? new MutationCache({
    onError: error => { void recordPreviewEvent('mutation.failed', error.message, 'error'); },
  }) : undefined,
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
