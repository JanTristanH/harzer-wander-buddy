import { OfflineVisitQueue, type OfflineVisit } from '@/lib/offline-visit-queue';
import type { Stampbox } from '@/lib/api';

const visit = (n = 1): OfflineVisit => ({
  id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
  stamp: { ID: `stamp-${n}`, name: `Stempel ${n}`, number: `${n}`, hasVisited: false } as Stampbox,
  visitedAt: '2026-10-20T08:12:00.000Z', status: 'pending',
});
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
}

it('persists offline visits before publishing success and restores them after restart', async () => {
  const disk = storage(); const queue = new OfflineVisitQueue(disk, 'alice');
  await queue.load(); await queue.add(visit());
  const restarted = new OfflineVisitQueue(disk, 'alice'); await restarted.load();
  expect(restarted.entries).toEqual([visit()]);
  expect(disk.values.get('alice')).not.toContain('token');
});

it('does not claim a visit was saved when disk persistence fails', async () => {
  const disk = storage(); const queue = new OfflineVisitQueue(disk, 'alice'); await queue.load();
  disk.setItem.mockRejectedValueOnce(new Error('disk full'));
  await expect(queue.add(visit())).rejects.toThrow('disk full');
  expect(queue.entries).toEqual([]);
});

it('retains the ID and visit time after a lost response, and only removes an acknowledged visit', async () => {
  const queue = new OfflineVisitQueue(storage(), 'alice'); await queue.load(); await queue.add(visit());
  const server = new Map<string, OfflineVisit>(); let loseResponse = true;
  const send = jest.fn(async (entry: OfflineVisit) => {
    server.set(entry.id, entry);
    if (loseResponse) { loseResponse = false; throw new Error('connection lost after commit'); }
    return true;
  });
  await queue.flush(send, () => true, () => false);
  expect(queue.entries).toEqual([visit()]);
  await queue.flush(send, () => true, () => false);
  expect(server.size).toBe(1); expect(send.mock.calls.map(([entry]) => entry.visitedAt)).toEqual([visit().visitedAt, visit().visitedAt]);
  expect(queue.entries).toEqual([]);
});

it('serializes additions while an upload is in flight and ignores parallel flush calls', async () => {
  const queue = new OfflineVisitQueue(storage(), 'alice'); await queue.load(); await queue.add(visit());
  let finish!: () => void;
  const first = new Promise<void>((resolve) => { finish = resolve; });
  const send = jest.fn(async () => { await first; return true; });
  const running = queue.flush(send, () => true, () => false);
  await queue.add(visit(2)); await queue.flush(send, () => true, () => false);
  finish(); await running;
  expect(send).toHaveBeenCalledTimes(2); expect(queue.entries).toEqual([]);
});

it('keeps permanent rejections visible, continues with other visits and allows explicit retry', async () => {
  const queue = new OfflineVisitQueue(storage(), 'alice'); await queue.load(); await queue.add(visit()); await queue.add(visit(2));
  const send = jest.fn(async (entry: OfflineVisit) => { if (entry.id === visit().id) throw new Error('stamp removed'); return true; });
  await queue.flush(send, () => true, () => true);
  expect(queue.entries).toEqual([{ ...visit(), status: 'failed' }]);
  await queue.retry(); expect(queue.entries[0].status).toBe('pending');
  await queue.flush(async () => true, () => true, () => false); expect(queue.entries).toEqual([]);
});

it('does not send while offline, or discard an unacknowledged visit without authentication', async () => {
  const queue = new OfflineVisitQueue(storage(), 'alice'); await queue.load(); await queue.add(visit());
  const send = jest.fn(async () => false);
  await queue.flush(send, () => false, () => false); expect(send).not.toHaveBeenCalled();
  await queue.flush(send, () => true, () => false); expect(queue.entries).toEqual([visit()]);
});

it('isolates accounts and refuses to overwrite corrupt or newer storage', async () => {
  const disk = storage(); const alice = new OfflineVisitQueue(disk, 'alice'); const bob = new OfflineVisitQueue(disk, 'bob');
  await alice.load(); await alice.add(visit()); await bob.load(); expect(bob.entries).toEqual([]);
  disk.values.set('broken', '{broken'); const broken = new OfflineVisitQueue(disk, 'broken');
  await expect(broken.load()).rejects.toThrow(); expect(disk.values.get('broken')).toBe('{broken');
  disk.values.set('future', '{"version":2,"entries":[]}');
  await expect(new OfflineVisitQueue(disk, 'future').load()).rejects.toThrow();
});

it('keeps an upload retryable if persisting its acknowledgement fails', async () => {
  const disk = storage(); const queue = new OfflineVisitQueue(disk, 'alice'); await queue.load(); await queue.add(visit());
  disk.setItem.mockRejectedValueOnce(new Error('disk full'));
  await expect(queue.flush(async () => true, () => true, () => false)).rejects.toThrow('disk full');
  expect(queue.entries).toEqual([visit()]); expect(queue.syncing).toBe(false);
  const restarted = new OfflineVisitQueue(disk, 'alice'); await restarted.load(); expect(restarted.entries).toEqual([visit()]);
});


it('rejects well-formed JSON with corrupt visit fields without replacing it', async () => {
  const disk = storage();
  const raw = JSON.stringify({ version: 1, entries: [{ ...visit(), stamp: { ID: 17, name: {} } }] });
  disk.values.set('alice', raw);
  await expect(new OfflineVisitQueue(disk, 'alice').load()).rejects.toThrow();
  expect(disk.values.get('alice')).toBe(raw);
});
