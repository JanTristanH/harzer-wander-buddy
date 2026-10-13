import {
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
  it('uses the local backend as the development default', () => {
    expect(resolveBackendUrl()).toBe(LOCAL_BACKEND_URL);
    expect(createExpoConfig({}).extra?.backendUrl).toBe(LOCAL_BACKEND_URL);
  });

  it('normalizes a deployment override', () => {
    expect(resolveBackendUrl('  https://app.harzer-wander-buddy.de/  ')).toBe(
      'https://app.harzer-wander-buddy.de'
    );
  });

  it('rejects invalid or unsupported backend URLs', () => {
    expect(() => resolveBackendUrl('app.harzer-wander-buddy.de')).toThrow(
      /Invalid EXPO_PUBLIC_BACKEND_URL/
    );
    expect(() => resolveBackendUrl('file:///tmp/backend')).toThrow(/must use http or https/);
  });

  it('maps localhost to the Android emulator while preserving other platforms', () => {
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'android')).toBe(
      'http://10.0.2.2:4004'
    );
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'ios')).toBe(LOCAL_BACKEND_URL);
    expect(resolveBackendUrlForPlatform(LOCAL_BACKEND_URL, 'web')).toBe(LOCAL_BACKEND_URL);
  });
});
