import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Chunk at 400 Unicode code points: even multibyte values stay below SecureStore's 2 KB limit.
// Commit the manifest last so an interrupted write never mixes two sessions.
export function createChunkedStorage(store: { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> }) {
  let pending: Promise<unknown> = Promise.resolve();
  const serialize = <T,>(work: () => Promise<T>) => {
    const result = pending.then(work); pending = result.catch(() => undefined); return result;
  };
  const readManifest = async (key: string): Promise<{ generation: string; count: number } | null> => {
    const raw = await store.getItemAsync(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!/^[a-f0-9-]+$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > 128) throw new Error('Invalid secure session');
    return value;
  };
  const removeChunks = async (key: string, old: Awaited<ReturnType<typeof readManifest>>) => {
    if (old) for (let i = 0; i < old.count; i++) await store.deleteItemAsync(`${key}.${old.generation}.${i}`);
  };
  return {
    getItem: (key: string) => serialize(async () => {
      const manifest = await readManifest(key);
      if (!manifest) return null;
      let value = '';
      for (let i = 0; i < manifest.count; i++) {
        const chunk = await store.getItemAsync(`${key}.${manifest.generation}.${i}`);
        if (chunk === null) throw new Error('Incomplete secure session');
        value += chunk;
      }
      return value;
    }),
    setItem: (key: string, value: string) => serialize(async () => {
      const old = await readManifest(key);
      const generation = Crypto.randomUUID();
      const points = Array.from(value);
      const count = Math.max(1, Math.ceil(points.length / 400));
      if (count > 128) throw new Error('Session exceeds secure storage capacity');
      try {
        for (let i = 0; i < count; i++) await store.setItemAsync(`${key}.${generation}.${i}`, points.slice(i * 400, (i + 1) * 400).join(''));
        await store.setItemAsync(key, JSON.stringify({ generation, count }));
      } catch (error) {
        for (let i = 0; i < count; i++) await store.deleteItemAsync(`${key}.${generation}.${i}`).catch(() => undefined);
        throw error;
      }
      await removeChunks(key, old);
    }),
    removeItem: (key: string) => serialize(async () => {
      const old = await readManifest(key);
      await store.deleteItemAsync(key);
      await removeChunks(key, old);
    }),
  };
}
export const authStorage = Platform.OS === 'web' ? {
  getItem: async (key: string) => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: async (key: string, value: string) => { localStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
} : createChunkedStorage(SecureStore);

export async function clearLegacyAuthStorage() {
  // Retired Auth0 credentials cannot be reused for this provider. Never read or log them.
  for (const key of ['hwb-auth-token-response', 'hwb-auth-token-response-metadata',
    'hwb-auth-token-response-access-token', 'hwb-auth-token-response-id-token',
    'hwb-auth-token-response-refresh-token', 'hwb-auth-pending-web-request']) {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
    } else await SecureStore.deleteItemAsync(key);
  }
}
