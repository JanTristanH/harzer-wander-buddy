import { OfflineVisitQueue } from '@/lib/offline-visit-queue';
import { OfflineNoteQueue } from '@/lib/offline-note-queue';
import { clearOfflineCaches } from '@/lib/offline-cache-registry';
it('logout clears in-memory outboxes and an in-flight acknowledgement cannot restore personal entries', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); } };
  const visits = new OfflineVisitQueue(storage, 'visits');
  const notes = new OfflineNoteQueue(storage, 'notes');
  await visits.add({ id: '124d5f18-52ef-43d5-9628-37ff647790eb', stamp: { ID: 'stamp', name: 'Test', number: '1' }, visitedAt: new Date().toISOString(), status: 'pending' });
  await notes.save('stamp', 'private note', null);
  let acknowledge!: (value: boolean) => void;
  const flush = visits.flush(() => new Promise(resolve => { acknowledge = resolve; }), () => true, () => false);
  await clearOfflineCaches();
  acknowledge(true); await flush;
  expect(visits.entries).toEqual([]); expect(notes.entries).toEqual([]);
  expect(JSON.parse(data.get('visits')!).entries).toEqual([]);
  expect(JSON.parse(data.get('notes')!).entries).toEqual([]);
});
