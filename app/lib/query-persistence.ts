import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const QUERY_PERSISTENCE_STORAGE_KEY = 'hwb-react-query-cache-v1';
const QUERY_PERSISTENCE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_PERSISTENCE_STORAGE_KEY,
  throttleTime: 1000,
});

export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: QUERY_PERSISTENCE_MAX_AGE_MS,
  buster: 'v2-offline-core-sync',
};

export async function clearPersistedQueryCache() {
  await AsyncStorage.removeItem(QUERY_PERSISTENCE_STORAGE_KEY);
}
