import type { ExpoConfig } from 'expo/config';

const config = (require('./app.json') as { expo: ExpoConfig }).expo;
export const LOCAL_BACKEND_URL = 'http://localhost:4004';

type BuildEnvironment = Record<string, string | undefined>;

export function resolveBackendUrl(envValue?: string) {
  const candidate = envValue?.trim() || LOCAL_BACKEND_URL;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_BACKEND_URL: ${candidate}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_BACKEND_URL must use http or https.');
  }

  return candidate.replace(/\/+$/, '');
}

export function createExpoConfig(env: BuildEnvironment = process.env): ExpoConfig {
  const androidGoogleMapsApiKey = env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isAndroidEasBuild = env.EAS_BUILD_PLATFORM === 'android';

  if (isAndroidEasBuild && !androidGoogleMapsApiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Android build. For EAS cloud builds, create or update it with `eas env:create`/`eas env:update` using `--visibility sensitive` (or `plaintext`). For `--local` builds, export it in your shell or add it to a local .env file before running EAS.'
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        ...(androidGoogleMapsApiKey
          ? {
              googleMaps: {
                apiKey: androidGoogleMapsApiKey,
              },
            }
          : {}),
      },
    },
    extra: {
      ...(config.extra ?? {}),
      backendUrl: resolveBackendUrl(env.EXPO_PUBLIC_BACKEND_URL),
    },
  };
}

export default (): ExpoConfig => createExpoConfig();
