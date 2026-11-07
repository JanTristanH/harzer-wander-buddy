import { fetchBadgeStampboxes } from '@/lib/api';
jest.mock('@/lib/config', () => ({
  appConfig: { backendUrl: 'https://example.test' },
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
test('does not load the complete stamp catalog for a performance badge without requirements', async () => {
  global.fetch = jest.fn();
  expect(await fetchBadgeStampboxes('token', [])).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});
test('loads only unique requirement IDs, includes artwork metadata and escapes literal input', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        value: [
          {
            ID: 'stamp-1',
            number: '9',
            name: 'Brockenhaus',
            heroImageUrl: '/brocken.jpg',
          },
        ],
      }),
    });
  global.fetch = fetchMock;
  const result = await fetchBadgeStampboxes('token', [
    ' stamp-1 ',
    'stamp-1',
    "stamp'2",
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('$filter')).toBe(
    "ID eq 'stamp-1' or ID eq 'stamp''2'"
  );
  expect(url.searchParams.get('$top')).toBe('2');
  expect(url.searchParams.get('$select')).toContain('heroImageUrl');
  expect(result[0].heroImageUrl).toBe('/brocken.jpg');
});
