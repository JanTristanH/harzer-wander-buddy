import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateHikingRoute,
  createTour,
  type HikingRouteParameters,
  type HikingRouteResult,
} from '@/lib/api';
import { useAuth, useIdTokenClaims } from '@/lib/auth';
import { requireOnlineForWrite } from '@/lib/offline-write';
import { useAuthorizedRequest } from '@/lib/queries';

export type TourSuggestions = {
  sessionId: string;
  generatedAt: string;
  parameters: HikingRouteParameters;
  searchLimited: boolean;
  results: HikingRouteResult[];
  savedTourIds: Record<string, string>;
};

export function useTourSuggestions() {
  const { sub: userId } = useIdTokenClaims<{ sub?: string }>() ?? {};
  const { canPerformWrites, isAuthenticated } = useAuth();
  const client = useQueryClient();
  const authorizedRequest = useAuthorizedRequest();
  // User-scoped, persisted by the existing query persister. Reopening a detail
  // never recalculates, creates a Tour, or consumes another suggestion.
  const key = ['tour-suggestions', userId ?? 'anonymous'] as const;
  const query = useQuery<TourSuggestions | null>({
    queryKey: key,
    queryFn: async () => null,
    enabled: false,
    gcTime: Infinity,
  });
  const generation = useMutation({
    mutationKey: ['generate-tour', userId],
    mutationFn: async (parameters: HikingRouteParameters) => {
      requireOnlineForWrite(canPerformWrites);
      const response = await authorizedRequest((token) =>
        calculateHikingRoute(token, parameters)
      );
      const data: TourSuggestions = {
        ...response,
        sessionId: Date.now().toString(36),
        generatedAt: new Date().toISOString(),
        parameters,
        savedTourIds: {},
      };
      client.setQueryData(key, data);
      return data;
    },
  });
  const save = useMutation({
    mutationKey: ['save-tour-suggestion', userId],
    mutationFn: async ({
      route,
      name,
      sessionId,
    }: {
      route: HikingRouteResult;
      name: string;
      sessionId: string;
    }) => {
      requireOnlineForWrite(canPerformWrites);
      const current = client.getQueryData<TourSuggestions>(key);
      const savedId =
        current?.sessionId === sessionId
          ? current.savedTourIds[route.id]
          : undefined;
      if (savedId) return savedId;
      const tour = await authorizedRequest((token) =>
        createTour(token, {
          name,
          idListTravelTimes: route.idListTravelTimes,
        })
      );
      client.setQueryData<TourSuggestions | null>(key, (previous) =>
        previous?.sessionId === sessionId
          ? {
              ...previous,
              savedTourIds: { ...previous.savedTourIds, [route.id]: tour.ID },
            }
          : previous
      );
      // Updating the suggestions before awaiting refresh prevents duplicate saves
      // when a refresh is slow or its network request fails.
      void client.invalidateQueries({
        queryKey: ['tours-overview', userId ?? 'anonymous'],
      });
      return tour.ID;
    },
  });
  return {
    suggestions: isAuthenticated && userId ? query.data : null,
    generation,
    save,
  };
}
