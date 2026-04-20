import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExtraConfig = {
  backendUrl?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientIdNative?: string;
  auth0ClientIdWeb?: string;
  auth0Audience?: string;
  auth0Scope?: string;
  auth0LogoutReturnPath?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function readConfig(key: keyof ExtraConfig, envValue?: string) {
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }

  const value = extra[key];
  return typeof value === 'string' ? value : '';
}

function resolveBackendUrlForPlatform(url: string) {
  if (Platform.OS !== 'android') {
    return url;
  }

  return url.replace(/^(https?):\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i, '$1://10.0.2.2');
}

const backendUrl = resolveBackendUrlForPlatform(
  readConfig('backendUrl', process.env.EXPO_PUBLIC_BACKEND_URL)
);

export const appConfig = {
  backendUrl,
  auth0Domain: readConfig('auth0Domain', process.env.EXPO_PUBLIC_AUTH0_DOMAIN),
  auth0ClientId: readConfig('auth0ClientId', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID),
  auth0ClientIdNative:
    readConfig('auth0ClientIdNative', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID_NATIVE) ||
    readConfig('auth0ClientId', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID),
  auth0ClientIdWeb:
    readConfig('auth0ClientIdWeb', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID_WEB) ||
    readConfig('auth0ClientId', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID),
  auth0Audience: readConfig('auth0Audience', process.env.EXPO_PUBLIC_AUTH0_AUDIENCE),
  auth0Scope:
    readConfig('auth0Scope', process.env.EXPO_PUBLIC_AUTH0_SCOPE) ||
    'openid profile email offline_access',
  auth0LogoutReturnPath:
    readConfig('auth0LogoutReturnPath', process.env.EXPO_PUBLIC_AUTH0_LOGOUT_RETURN_PATH) ||
    'auth/logout',
} as const;

export function getAuth0ClientIdForPlatform(
  platform: 'web' | 'native' = Platform.OS === 'web' ? 'web' : 'native'
) {
  return platform === 'web' ? appConfig.auth0ClientIdWeb : appConfig.auth0ClientIdNative;
}

export function getMissingConfig() {
  const requiredEntries: Array<[string, string | undefined]> = [
    ['backendUrl', appConfig.backendUrl],
    ['auth0Domain', appConfig.auth0Domain],
    ['auth0Audience', appConfig.auth0Audience],
    ['auth0Scope', appConfig.auth0Scope],
    ['auth0LogoutReturnPath', appConfig.auth0LogoutReturnPath],
    ['auth0ClientId', getAuth0ClientIdForPlatform()],
  ];

  return requiredEntries.filter(([, value]) => !value).map(([key]) => key);
}
