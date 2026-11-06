// Browser-only service stubs. The production view renders fixed data from preview.tsx.
export const useAuth = () => ({ isAuthenticated: true });
export const useConnectivity = () => ({ isOffline: true, isReady: true });
export const useOfflineVisits = () => ({ entries: [], syncing: false, storageError: null });
export const useOfflineNotes = () => ({ entries: [], syncing: false, storageError: null });
export const useRouter = () => ({ push() {} });
