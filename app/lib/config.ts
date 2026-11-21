import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExtraConfig = {
  backendUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseOAuthProviders?: string;

};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function readConfig(key: keyof ExtraConfig, envValue?: string) {
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }

  const value = extra[key];
  return typeof value === 'string' ? value : '';
}

export function resolveBackendUrlForPlatform(url: string, platform = Platform.OS) {
  if (url === 'same-origin') {
    if (platform !== 'web') throw new Error('Native builds require an explicit backend URL.');
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  if (platform !== 'android') {
    return url;
  }

  return url.replace(/^(https?):\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i, '$1://10.0.2.2');
}

const backendUrl = resolveBackendUrlForPlatform(readConfig('backendUrl'));

export const appConfig = {
  backendUrl,
  authMode: process.env.EXPO_PUBLIC_AUTH_MODE === 'basic' ? 'basic' : 'sso',
  supabaseUrl: readConfig('supabaseUrl', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: readConfig('supabasePublishableKey', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  supabaseOAuthProviders: readConfig('supabaseOAuthProviders', process.env.EXPO_PUBLIC_SUPABASE_OAUTH_PROVIDERS),
} as const;

export function getMissingConfig() {
  if (appConfig.authMode === 'basic') return appConfig.backendUrl || Platform.OS === 'web' ? [] : ['backendUrl'];
  return [
    ...(!appConfig.backendUrl && Platform.OS !== 'web' ? ['backendUrl'] : []),
    ...(!/^https:\/\//.test(appConfig.supabaseUrl) ? ['supabaseUrl'] : []),
    ...(!appConfig.supabasePublishableKey.startsWith('sb_publishable_') ? ['supabasePublishableKey'] : []),
  ];
}
