import type { ConfigContext, ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read JSON as data: require() also registers the raw files as config-plugin
// sources, bypassing fingerprint's ExpoConfigVersions normalization.
const config = (JSON.parse(readFileSync(join(__dirname, 'app.json'), 'utf8')) as {
  expo: ExpoConfig;
}).expo;
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};
export const LOCAL_BACKEND_URL = 'http://localhost:4004';

type BuildEnvironment = Record<string, string | undefined>;

export function resolveBackendUrl(envValue?: string) {
  const candidate = envValue?.trim() || LOCAL_BACKEND_URL;
  // Static web previews call the CAP server that serves their own bundle.
  if (candidate === 'same-origin') return candidate;
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

export function createExpoConfig(
  env: BuildEnvironment = process.env,
  baseConfig: ExpoConfig = config
): ExpoConfig {
  const androidGoogleMapsApiKey = env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const isAndroidEasBuild = env.EAS_BUILD_PLATFORM === 'android';
  const previewPr = env.HWB_PREVIEW_PR;
  if (previewPr && !/^[1-9]\d*$/.test(previewPr)) {
    throw new Error('HWB_PREVIEW_PR must be a positive PR number.');
  }
  if (previewPr && env.EXPO_PUBLIC_AUTH_MODE !== 'basic') {
    throw new Error('PR previews require EXPO_PUBLIC_AUTH_MODE=basic.');
  }

  if (isAndroidEasBuild && !androidGoogleMapsApiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Android build. For EAS cloud builds, create or update it with `eas env:create`/`eas env:update` using `--visibility sensitive` (or `plaintext`). For `--local` builds, export it in your shell or add it to a local .env file before running EAS.'
    );
  }

  return {
    ...baseConfig,
    version,
    ...(previewPr ? {
      name: `HWB PR ${previewPr}`,
      scheme: `hwb-preview-${previewPr}`,
      updates: { ...baseConfig.updates, enabled: false },
      // Standalone Gradle builds do not need EAS runtime fingerprint resolution.
      runtimeVersion: version,
    } : {}),
    experiments: {
      ...baseConfig.experiments,
      baseUrl: previewPr ? '/app/rnweb'
        : env.EXPO_PUBLIC_DATA_MODE === 'static'
          ? env.EXPO_PUBLIC_STATIC_BASE_PATH || '/preview/overview/app'
          : env.EXPO_PUBLIC_AUTH_MODE === 'basic' ? '' : baseConfig.experiments?.baseUrl,
    },
    android: {
      ...baseConfig.android,
      ...(previewPr ? { package: `${baseConfig.android?.package}.preview.pr${previewPr}` } : {}),
      config: {
        ...(baseConfig.android?.config ?? {}),
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
      ...(baseConfig.extra ?? {}),
      backendUrl: resolveBackendUrl(env.EXPO_PUBLIC_BACKEND_URL),
      ...(previewPr ? {
        preview: {
          pr: previewPr,
          sha: env.HWB_PREVIEW_SHA || '',
          // android.config is stripped from Expo's public manifest. Expose only
          // this boolean so JS can avoid mounting Maps without a native key.
          mapsConfigured: !!(androidGoogleMapsApiKey || baseConfig.android?.config?.googleMaps?.apiKey?.trim()),
        },
      } : {}),
    },
  };
}

export default ({ config: contextConfig }: ConfigContext): ExpoConfig =>
  createExpoConfig(process.env, { ...config, ...contextConfig });
