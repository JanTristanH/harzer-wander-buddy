import { calculateHikingRoute, type HikingRouteParameters } from '@/lib/api';
jest.mock('@/lib/config', () => ({
  appConfig: { backendUrl: 'https://example.test' },
}));

const parameters: HikingRouteParameters = {
  maxDepth: 16,
  maxDuration: 7200,
  maxDistance: 20000,
  minStampCount: 1,
  allowDriveInRoute: false,
  latitudeStart: '51.8',
  longitudeStart: '10.6',
  groupMode: 'missing_all',
  groupFilterStampings: "friend'with#space",
};

test('uses a typed OData function URL and retains ranked geometry and group metrics', async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      searchLimited: true,
      results: [
        {
          id: 'edge-1;edge-2',
          idListTravelTimes: 'edge-1;edge-2',
          previewSvg: '<svg/>',
          stampCount: 3,
          matchingStampCount: 2,
          newStampCountForUser: 2,
          distance: '1200',
          duration: '3600',
          groupSize: 2,
          AverageGroupStampings: 0.5,
          totalElevationGain: 60,
          totalElevationLoss: 60,
          path: [
            {
              travelTime_ID: 'edge-1',
              rank: 512,
              travelTime: {
                ID: 'edge-1',
                fromPoi: 'parking',
                toPoi: 'stamp',
                durationSeconds: '3600',
                distanceMeters: '1200',
                positionString: '10;51;0;11;52;0;',
                travelMode: 'walk',
              },
            },
          ],
        },
      ],
    }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    const response = await calculateHikingRoute('token', parameters);
    const [url] = (fetchMock.mock.calls as unknown as [string][])[0];
    expect(new URL(url).hash).toBe('');
    expect(decodeURIComponent(new URL(url).pathname)).toContain(
      "groupFilterStampings='friend''with#space'"
    );
    expect(response.searchLimited).toBe(true);
    expect(response.results[0]).toMatchObject({
      id: 'edge-1;edge-2',
      matchingStampCount: 2,
      averageGroupStampings: 0.5,
      previewSvg: '<svg/>',
      groupSize: 2,
      path: [
        {
          travelTime_ID: 'edge-1',
          rank: 512,
          travelTime: {
            durationSeconds: 3600,
            positionString: '10;51;0;11;52;0;',
          },
        },
      ],
    });
  } finally {
    global.fetch = originalFetch;
  }
});
