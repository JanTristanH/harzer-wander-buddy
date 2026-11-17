// Keep in-memory outboxes and their serialized writes aligned with logout/deletion.
const caches = new Set<{ clear(): Promise<void> }>();
export function registerOfflineCache(cache: { clear(): Promise<void> }) { caches.add(cache); }
export async function clearOfflineCaches() {
  const current = [...caches]; caches.clear();
  await Promise.all(current.map(cache => cache.clear()));
}
