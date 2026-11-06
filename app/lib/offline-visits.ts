import { createContext, useContext } from 'react';

import type { Stampbox } from '@/lib/api';
import type { OfflineVisit } from '@/lib/offline-visit-queue';

export type OfflineVisitsValue = {
  isNative: boolean;
  canRecord: boolean;
  userId?: string;
  entries: readonly OfflineVisit[];
  syncing: boolean;
  storageError: string | null;
  record(stamp: Stampbox): Promise<void>;
  retry(): Promise<void>;
  discard(id: string): Promise<void>;
};

export const OfflineVisitsContext = createContext<OfflineVisitsValue>({
  isNative: false, canRecord: false, entries: [], syncing: false, storageError: null,
  record: async () => { throw new Error('Lokaler Besuchsspeicher ist nicht bereit.'); },
  retry: async () => undefined,
  discard: async () => undefined,
});

export function useOfflineVisits() { return useContext(OfflineVisitsContext); }
