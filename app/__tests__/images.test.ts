import { buildAuthenticatedImageSource } from '@/lib/images';
jest.mock('@/lib/config', () => ({ appConfig: { backendUrl: 'http://localhost:4004', authMode: 'basic' } }));
jest.mock('@/lib/static-website', () => ({ isStaticWebsite: false }));
test('keeps browser photo previews local without backend authentication headers', () => {
  expect(buildAuthenticatedImageSource('blob:http://localhost:8081/local-photo', 'token')).toEqual({ uri: 'blob:http://localhost:8081/local-photo', cacheKey: 'blob:http://localhost:8081/local-photo' });
});
