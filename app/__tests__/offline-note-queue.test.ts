import { OfflineNoteQueue } from '@/lib/offline-note-queue';
import type { StampNote } from '@/lib/api';

const base: StampNote = { ID: 'note', note: 'alt', modifiedAt: '2026-10-22T10:00:00Z' };
const updated: StampNote = { ...base, note: 'neu', modifiedAt: '2026-10-22T10:01:00Z' };
function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }) };
  return { storage, queue: new OfflineNoteQueue(storage, 'alice') };
}
it('persists/coalesces edits and clearing, preserving the original server version across restarts', async () => {
  const { storage, queue } = setup();
  await queue.save('stamp', 'neu', base); await queue.save('stamp', '  ', updated);
  const restored = new OfflineNoteQueue(storage, 'alice'); await restored.load();
  expect(restored.entries).toEqual([expect.objectContaining({ note: '', base, status: 'pending' })]);
  const other = new OfflineNoteQueue(storage, 'bob'); await other.load(); expect(other.entries).toEqual([]);
});
it('keeps a newer edit made during upload and advances its base only after acknowledgement', async () => {
  const { queue } = setup(); await queue.save('stamp', 'neu', base);
  await queue.flush(async () => { await queue.save('stamp', 'neuer', base); return { conflict: false, current: updated }; }, () => true);
  expect(queue.entries[0]).toMatchObject({ note: 'neuer', base: updated, status: 'pending' });
});
it('retains a failed upload across restart and retries without losing its base', async () => {
  const { queue, storage } = setup(); await queue.save('stamp', 'neu', base);
  await queue.flush(async () => { throw new Error('response lost'); }, () => true);
  const restored = new OfflineNoteQueue(storage, 'alice'); await restored.load();
  expect(restored.entries[0].status).toBe('error');
  await restored.flush(async (e) => { expect(e.base).toEqual(base); return { conflict: false, current: updated }; }, () => true);
  expect(restored.entries).toEqual([]);
});
it('persists both conflict versions, blocks automatic retries, and conditionally resolves local', async () => {
  const { queue, storage } = setup(); await queue.save('stamp', 'neu', base);
  const remote = { ...updated, note: 'anderes Gerät' };
  await queue.flush(async () => ({ conflict: true, current: remote }), () => true);
  const restored = new OfflineNoteQueue(storage, 'alice'); await restored.load();
  const send = jest.fn(); await restored.retry(); await restored.flush(send, () => true); expect(send).not.toHaveBeenCalled();
  await restored.save('stamp', 'kombiniert', base);
  expect(restored.entries[0]).toMatchObject({ status: 'conflict', remote });
  await restored.resolve('stamp', 'local');
  expect(restored.entries[0]).toMatchObject({ note: 'kombiniert', base: remote, status: 'pending' });
  // Another device may change again even after explicit resolution.
  await restored.flush(async () => ({ conflict: true, current: updated }), () => true);
  expect(restored.entries[0].status).toBe('conflict');
  await restored.resolve('stamp', 'remote'); expect(restored.entries).toEqual([]);
});
it('does not publish a successful save when storage fails, and retains work if acknowledgement persistence fails', async () => {
  const { queue, storage } = setup(); storage.setItem.mockRejectedValueOnce(new Error('full'));
  await expect(queue.save('stamp', 'neu', base)).rejects.toThrow('full'); expect(queue.entries).toEqual([]);
  await queue.save('stamp', 'neu', base); storage.setItem.mockRejectedValueOnce(new Error('full'));
  await expect(queue.flush(async () => ({ conflict: false, current: updated }), () => true)).rejects.toThrow('full');
  expect(queue.entries[0].note).toBe('neu'); expect(queue.syncing).toBe(false);
});
it('stops on account change and serializes parallel flush attempts', async () => {
  const { queue } = setup(); await queue.save('one', 'neu', base); await queue.save('two', 'neu', base);
  let active = true;
  const send = jest.fn(async () => { await queue.flush(jest.fn(), () => true); active = false; return { conflict: false, current: updated }; });
  await queue.flush(send, () => active); expect(send).toHaveBeenCalledTimes(1); expect(queue.entries[0].stampId).toBe('two');
});
it('rejects corrupt/unknown persisted state without overwriting it', async () => {
  const { queue, storage } = setup(); storage.getItem.mockResolvedValueOnce('{"version":2,"entries":[]}');
  await expect(queue.load()).rejects.toThrow('beschädigt'); expect(storage.setItem).not.toHaveBeenCalled();
});
