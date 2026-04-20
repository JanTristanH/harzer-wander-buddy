import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function TourEditRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const tourId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!tourId) {
      router.replace('/(tabs)/tours' as never);
      return;
    }

    router.replace({
      pathname: '/tours/[id]',
      params: {
        id: tourId,
        edit: '1',
      },
    } as never);
  }, [router, tourId]);

  return null;
}
