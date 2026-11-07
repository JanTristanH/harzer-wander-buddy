import type { Stampbox } from '@/lib/api';

export type OfflineVisit = {
  id: string;
  stamp: Stampbox;
  visitedAt: string;
  status: 'pending' | 'failed';
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// This outbox is independent of the expiring query cache. Credentials are never stored here.
export class OfflineVisitQueue {
  entries: readonly OfflineVisit[] = [];
  syncing = false;
  private writes: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(private storage: Storage, private key: string) {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() { this.listeners.forEach((listener) => listener()); }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work);
    this.writes = next.catch(() => undefined);
    return next;
  }

  async load() {
    return this.serialize(async () => {
      const raw = await this.storage.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : { version: 1, entries: [] };
      if (parsed.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.some((entry: OfflineVisit) =>
        !entry || typeof entry.id !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(entry.id) ||
        typeof entry.stamp?.ID !== 'string' || !entry.stamp.ID || typeof entry.stamp.name !== 'string' ||
        typeof entry.visitedAt !== 'string' || !Number.isFinite(Date.parse(entry.visitedAt)) ||
        !['pending', 'failed'].includes(entry.status)
      )) throw new Error('Der lokale Besuchsspeicher konnte nicht gelesen werden.');
      this.entries = parsed.entries;
      this.notify();
    });
  }

  private async save(entries: readonly OfflineVisit[]) {
    await this.storage.setItem(this.key, JSON.stringify({ version: 1, entries }));
    this.entries = entries;
    this.notify();
  }

  async add(entry: OfflineVisit) {
    return this.serialize(async () => {
      if (!this.entries.some((item) => item.id === entry.id)) {
        await this.save([...this.entries, entry]);
      }
    });
  }

  async retry() {
    return this.serialize(() => this.save(this.entries.map((entry) => ({ ...entry, status: 'pending' }))));
  }

  async discard(id: string) {
    // Do not discard an in-flight upload: it may already have reached the server.
    if (this.syncing) return;
    return this.serialize(() => this.save(this.entries.filter((entry) => entry.id !== id)));
  }

  async flush(
    send: (entry: OfflineVisit) => Promise<boolean>,
    shouldContinue: () => boolean,
    isPermanent: (error: unknown) => boolean,
  ) {
    if (this.syncing) return;
    this.syncing = true;
    this.notify();
    try {
      while (shouldContinue()) {
        const entry = this.entries.find((item) => item.status === 'pending');
        if (!entry) break;
        try {
          if (!await send(entry)) break;
        } catch (error) {
          if (!isPermanent(error)) break; // Network/auth failures remain retryable.
          await this.serialize(() => this.save(this.entries.map((item) =>
            item.id === entry.id ? { ...item, status: 'failed' } : item
          )));
          continue;
        }
        // Persist acknowledgement before removing the local overlay. A failed save
        // leaves the same stable ID available for a safe retry after a restart.
        await this.serialize(() => this.save(this.entries.filter((item) => item.id !== entry.id)));
      }
    } finally {
      this.syncing = false;
      this.notify();
    }
  }
}
