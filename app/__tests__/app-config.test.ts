import expoConfig, {
  createExpoConfig,
  LOCAL_BACKEND_URL,
  resolveBackendUrl,
} from '../app.config';
import { resolveBackendUrlForPlatform } from '@/lib/config';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        backendUrl: 'http://localhost:4004',
      },
    },
  },
}));

describe('Expo backend configuration', () => {
  it('uses the package release version and fingerprint runtime compatibility', () => {
    const config = createExpoConfig({});
    expect(config.version).toBe(require('../package.json').version);
    expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' });
  });

  it('preserves the static configuration passed by Expo', () => {
    const config = {
      name: 'Config context name',
      slug: 'config-context-slug',
      android: {
        package: 'de.example.app',
        config: { googleMaps: { apiKey: 'test-maps-key' } },
      },
      extra: { contextValue: 'preserved' },
    };

    const resolved = expoConfig({
      config,
      projectRoot: '/tmp/project',
      staticConfigPath: null,
      packageJsonPath: '/tmp/project/package.json',
    });

    expect(resolved.name).toBe(config.name);
    expect(resolved.slug).toBe(config.slug);
    expect(resolved.android).toMatchObject(config.android);
    expect(resolved.extra?.contextValue).toBe('preserved');

  });

  it('uses the local backend as the development default', () => {
    expect(resolveBackendUrl()).toBe(LOCAL_BACKEND_URL);
    expect(createExpoConfig({}).extra?.backendUrl).toBe(LOCAL_BACKEND_URL);
  });

  it('normalizes a deployment override', () => {
    expect(resolveBackendUrl('  https://app.harzer-wander-buddy.de/  ')).toBe(
      'https://app.harzer-wander-buddy.de'
    );
  });

  it('uses the Expo root for Basic web and preserves the CAP mount path for SSO', () => {
    expect(createExpoConfig({ EXPO_PUBLIC_AUTH_MODE: 'basic' }).experiments?.baseUrl).toBe('');
    expect(createExpoConfig({ EXPO_PUBLIC_AUTH_MODE: 'sso' }).experiments?.baseUrl).toBe('/app/rnweb');
  });

  it('rejects invalid or unsupported backend URLs', () => {
    expect(() => resolveBackendUrl('app.harzer-wander-buddy.de')).toThrow(
      /Invalid EXPO_PUBLIC_BACKEND_URL/
    );
    expect(() => resolveBackendUrl('file:///tmp/backend')).toThrow(/must use http or https/);
  });

  it('mounts the actual app at the static website path without changing live builds', () => {
    expect(createExpoConfig({ EXPO_PUBLIC_DATA_MODE: 'static' }).experiments?.baseUrl).toBe('/preview/overview/app');
    expect(createExpoConfig({ EXPO_PUBLIC_DATA_MODE: 'static', EXPO_PUBLIC_STATIC_BASE_PATH: '/overview/app' }).experiments?.baseUrl).toBe('/overview/app');
    expect(createExpoConfig({}).experiments?.baseUrl).toBe('/app/rnweb');
  });

  it('maps localhost to the Android emulator while preserving other platforms', () => {
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'android')).toBe(
      'http://10.0.2.2:4004'
    );
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'ios')).toBe(LOCAL_BACKEND_URL);
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'web')).toBe(LOCAL_BACKEND_URL);
  });
});
