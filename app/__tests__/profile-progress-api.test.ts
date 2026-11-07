import { fetchProfileOverview } from '@/lib/api';
import { fetchStampsOverviewData } from '@/lib/queries';
jest.mock('@/lib/auth', () => ({}));
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'https://example.test' } }));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
test('profile counts and visit names load stamps with the same owner filter as the list', async () => {
  const stamps = Array.from({ length: 8 }, (_, i) => ({
    ID: `stamp-${i}`,
    number: String(i + 1),
    name: `Stamp ${i + 1}`,
    hasVisited: true,
  }));
  global.fetch = jest.fn(async (input) => {
    const url = new URL(String(input));
    let value: unknown[] = [];
    if (
      url.pathname.endsWith('/Stampboxes') &&
      url.searchParams.get('$filter')?.includes("groupFilterStampings ne 'owner'") && url.searchParams.get('$filter')?.includes('validFrom')
    )
      value = stamps;
    if (url.pathname.endsWith('/Stampings') && url.searchParams.get('$top') !== '1')
      value = [{ ID: 'visit', stamp_ID: 'stamp-0', visitedAt: '2026-10-01T10:00:00Z' }];
    return { ok: true, status: 200, json: async () => ({ value }) } as Response;
  });
  const offlineSnapshot = await fetchStampsOverviewData('token', 'owner');
  expect(offlineSnapshot.stamps).toHaveLength(8);
  const profile = await fetchProfileOverview('token', 'owner', { id: 'owner', name: 'Owner' });
  expect(profile.visitedCount).toBe(8);
  expect(profile.completionPercent).toBe(100);
  expect(profile.latestVisits[0].stampName).toBe('Stamp 1');
});
