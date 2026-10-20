jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

describe('static website data boundary', () => {
  const originalMode = process.env.EXPO_PUBLIC_DATA_MODE;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_DATA_MODE = 'static';
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.EXPO_PUBLIC_DATA_MODE;
    else process.env.EXPO_PUBLIC_DATA_MODE = originalMode;
    global.fetch = originalFetch;
  });

  function mockCatalogue() {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 1,
      stamps: [{ id: 'stamp-9', number: 9, name: 'Brockenhaus', description: 'Harz',
        latitude: 51.8, longitude: 10.6, validFrom: '2025-01-01T00:00:00Z', validTo: '2037-01-01T00:00:00Z',
        articleUrl: '/stempelstelle-009-brockenhaus/' }],
      parkingSpots: [],
    }) });
  }

  it('shares one same-origin catalogue request and returns only guest state', async () => {
    mockCatalogue();
    const adapter = require('@/lib/static-website');
    const [stamps] = await Promise.all([adapter.staticStampboxes('validToday'), adapter.loadStaticCatalogue()]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/preview/overview/app/public-catalogue.json', { credentials: 'omit' });
    expect(stamps[0]).toMatchObject({ ID: 'stamp-9', hasVisited: false, totalGroupStampings: 0, stampedUsers: [] });
    expect(await adapter.staticStampboxes('visited')).toEqual([]);
    expect(await adapter.staticStampboxes('relocated')).toEqual([]);
  });

  it('rejects backend reads and writes in static mode before making a request', () => {
    global.fetch = jest.fn();
    expect(() => require('@/lib/static-website').assertLiveBackend()).toThrow(/angemeldeten App/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not affect live builds', () => {
    delete process.env.EXPO_PUBLIC_DATA_MODE;
    const adapter = require('@/lib/static-website');
    expect(adapter.isStaticWebsite).toBe(false);
    expect(() => adapter.assertLiveBackend()).not.toThrow();
  });

  it('retries a failed static catalogue instead of caching a rejected promise', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1, stamps: [], parkingSpots: [] }) });
    const adapter = require('@/lib/static-website');
    await expect(adapter.loadStaticCatalogue()).rejects.toThrow();
    await expect(adapter.loadStaticCatalogue()).resolves.toMatchObject({ schemaVersion: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
