import { fetchTourPath, fetchTransientTourByIdListTravelTimes, updateTourByPOIList } from '@/lib/api';
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://example.test' } }));

const positionString = '10.6;51.7;0;10.61;51.72;0;10.62;51.71;0';
const path = [{ tour_ID: 'tour', travelTime_ID: 'leg', rank: 1, travelTime: { ID: 'leg', positionString, travelMode: 'drive' } }];
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function respond(body: unknown) {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

it('retains service geometry when loading a saved tour with expanded travel times', async () => {
  respond({ value: path });
  const result = await fetchTourPath('token', 'tour');
  expect(result[0].travelTime?.positionString).toBe(positionString);
  expect(result[0].travelTime?.travelMode).toBe('drive');
  expect(decodeURIComponent(String((global.fetch as jest.Mock).mock.calls[0][0]))).toContain('$expand=travelTime');
});

it('retains service geometry for transient tours', async () => {
  respond({ value: JSON.stringify({ id: 'tour', path }) });
  const result = await fetchTransientTourByIdListTravelTimes('token', 'leg');
  expect(result.path[0].travelTime?.positionString).toBe(positionString);
  expect(result.path[0].travelTime?.travelMode).toBe('drive');
});

it('retains recalculated geometry after editing tour stops', async () => {
  respond({ value: JSON.stringify({ ID: 'tour', path }) });
  const result = await updateTourByPOIList('token', { TourID: 'tour', POIList: 'a;b' });
  expect(result.path[0].travelTime?.positionString).toBe(positionString);
  expect(result.path[0].travelTime?.travelMode).toBe('drive');
});
