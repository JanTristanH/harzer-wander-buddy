import type { StampNote } from '@/lib/api';

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type OfflineNote = {
  stampId: string;
  revision: number;
  note: string;
  base: StampNote | null;
  status: 'pending' | 'error' | 'conflict';
  remote?: StampNote | null;
};
export type NoteSyncResult = { conflict: boolean; current: StampNote | null };

// Separate from the expiring query cache, scoped by backend and authenticated subject.
export class OfflineNoteQueue {
  entries: readonly OfflineNote[] = [];
  syncing = false;
  private writes: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(private storage: Storage, private key: string) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach((listener) => listener()); }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work); this.writes = next.catch(() => undefined); return next;
  }
  private async persist(entries: readonly OfflineNote[]) {
    await this.storage.setItem(this.key, JSON.stringify({ version: 1, entries }));
    this.entries = entries; this.notify();
  }
  load() {
    return this.serialize(async () => {
      const raw = await this.storage.getItem(this.key);
      const data = raw ? JSON.parse(raw) : { version: 1, entries: [] };
      const validNote = (note: StampNote | null | undefined) => note === null ||
        (typeof note?.ID === 'string' && typeof note?.note === 'string' && note.note.length <= 500);
      if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.some((e: OfflineNote) =>
        !e || typeof e.stampId !== 'string' || !e.stampId || (!Number.isSafeInteger(e.revision) || e.revision < 1) ||
        typeof e.note !== 'string' || e.note.length > 500 || !['pending', 'error', 'conflict'].includes(e.status) ||
        !validNote(e.base) || (e.status === 'conflict' && !validNote(e.remote)))) throw new Error('Lokaler Notizspeicher ist beschädigt.');
      this.entries = data.entries; this.notify();
    });
  }
  save(stampId: string, note: string, base: StampNote | null) {
    return this.serialize(async () => {
      const existing = this.entries.find((e) => e.stampId === stampId);
      const normalized = note.trim();
      if (!stampId || normalized.length > 500) throw new Error('Ungültige Notiz.');
      const entry: OfflineNote = { stampId, note: normalized, base: existing ? existing.base : base,
        revision: (existing?.revision ?? 0) + 1, status: existing?.status === 'conflict' ? 'conflict' : 'pending',
        ...(existing?.status === 'conflict' ? { remote: existing.remote } : {}) };
      await this.persist([...this.entries.filter((e) => e.stampId !== stampId), entry]);
    });
  }
  resolve(stampId: string, choice: 'local' | 'remote') {
    return this.serialize(async () => {
      const entry = this.entries.find((e) => e.stampId === stampId);
      if (entry?.status !== 'conflict') return;
      await this.persist(choice === 'remote' ? this.entries.filter((e) => e !== entry) : this.entries.map((e) =>
        e === entry ? { ...e, base: e.remote ?? null, remote: undefined, status: 'pending', revision: e.revision + 1 } : e));
    });
  }
  retry(stampId?: string) {
    return this.serialize(() => this.persist(this.entries.map((e) =>
      e.status === 'error' && (!stampId || e.stampId === stampId) ? { ...e, status: 'pending' } : e)));
  }
  async flush(send: (entry: OfflineNote) => Promise<NoteSyncResult | undefined>, active: () => boolean) {
    if (this.syncing) return;
    this.syncing = true; this.notify();
    // One attempt per note per pass. Errors wait for reconnect/foreground/interval/manual retry.
    const attempts = this.entries.filter((e) => e.status !== 'conflict');
    try {
      for (const entry of attempts) {
        if (!active()) break;
        let result: NoteSyncResult | undefined;
        try { result = await send(entry); }
        catch {
          await this.serialize(() => this.persist(this.entries.map((e) =>
            e.stampId === entry.stampId && e.revision === entry.revision ? { ...e, status: 'error' } : e)));
          continue;
        }
        if (!result) break;
        await this.serialize(() => this.persist(this.entries.flatMap((e): OfflineNote[] => {
          if (e.stampId !== entry.stampId) return [e];
          if (result!.conflict) return [{ ...e, status: 'conflict', remote: result!.current }];
          // An edit made while uploading survives, now based on the acknowledged version.
          return e.revision === entry.revision ? [] : [{ ...e, base: result!.current, status: 'pending' }];
        })));
      }
    } finally { this.syncing = false; this.notify(); }
  }
}
