import type { ExpoConfig } from 'expo/config';

const config = (require('./app.json') as { expo: ExpoConfig }).expo;
const androidGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const isAndroidEasBuild = process.env.EAS_BUILD_PLATFORM === 'android';

if (isAndroidEasBuild && !androidGoogleMapsApiKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Android build. For EAS cloud builds, create or update it with `eas env:create`/`eas env:update` using `--visibility sensitive` (or `plaintext`). For `--local` builds, export it in your shell or add it to a local .env file before running EAS.'
  );
}

export default (): ExpoConfig => ({
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
});
