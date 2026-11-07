import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authStorage } from '@/lib/auth-storage';
import { appConfig } from '@/lib/config';

export const supabaseStorageKey = `hwb-supabase-session-${(appConfig.supabaseUrl || '').replace(/[^a-zA-Z0-9.-]/g, '-')}`;
let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  return client ??= createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
    auth: { storageKey: supabaseStorageKey, storage: authStorage, flowType: 'pkce', persistSession: true, autoRefreshToken: true,
      detectSessionInUrl: false, ...(Platform.OS !== 'web' ? { lock: processLock } : {}) },
  });
}
