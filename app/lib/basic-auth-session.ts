import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { CurrentUserProfileData } from '@/lib/api';

const SESSION_KEY = 'hwb-basic-auth-session';
// Serialize writes so a late profile save cannot overtake logout's deletion.
let pendingWrite: Promise<void> = Promise.resolve();
function writeSession(operation: () => Promise<void>) {
  const result = pendingWrite.then(operation);
  pendingWrite = result.catch(() => {});
  return result;
}

export type BasicAuthSession = { token: string; profile: CurrentUserProfileData };

// Basic credentials are secrets, even though the Authorization value is base64.
// Never fall back to unencrypted or process-only storage on native devices.
export async function saveBasicAuthSession(session: BasicAuthSession) {
  if (Platform.OS === 'web') return;
  await writeSession(() => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)));
}

export async function loadBasicAuthSession(): Promise<BasicAuthSession | null> {
  if (Platform.OS === 'web') return null;
  await pendingWrite;
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as BasicAuthSession;
    if (typeof session.token !== 'string' || !session.token ||
        typeof session.profile?.id !== 'string' || typeof session.profile?.name !== 'string') {
      throw new Error('Invalid Basic session');
    }
    return session;
  } catch {
    await clearBasicAuthSession();
    return null;
  }
}

export async function clearBasicAuthSession() {
  if (Platform.OS === 'web') return;
  await writeSession(() => SecureStore.deleteItemAsync(SESSION_KEY));
}
