const { Readable, Transform } = require('node:stream');

// Per-process LRU cache. Authorization still runs through CAP on every request.
class ImageCache {
  constructor({ ttl = 300_000, maxBytes = 32 * 1024 * 1024, maxEntryBytes = 2 * 1024 * 1024, now = Date.now } = {}) {
    Object.assign(this, { ttl, maxBytes, maxEntryBytes, now });
    this.entries = new Map();
    this.bytes = 0;
    this.generation = 0;
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
    this.generation++;
  }
  delete(key) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.size;
    this.entries.delete(key);
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expires <= this.now()) { this.delete(key); return; }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key, value, size) {
    if (size > this.maxEntryBytes || size > this.maxBytes) return;
    this.delete(key);
    for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.delete(id);
    while (this.bytes + size > this.maxBytes) this.delete(this.entries.keys().next().value);
    this.entries.set(key, { value, size, expires: this.now() + this.ttl });
    this.bytes += size;
  }
}

function registerImageCache(service) {
  const cache = new ImageCache();
  service.before(['CREATE', 'UPDATE', 'DELETE'], 'Attachments', req => {
    req.on('succeeded', () => cache.clear());
  });
  service.on('READ', 'Attachments', async (req, next) => {
    // Only cache media requests, never arbitrary OData projections or filters.
    if (!req.query?.SELECT?.columns?.some(c => c.as === '$mediaContentType')) return next();
    const key = JSON.stringify([req.tenant, req.user.id, req.query.SELECT]);
    const restore = saved => {
      const row = { ...saved.row, [saved.field]: Readable.from([saved.buffer]) };
      return saved.array ? [row] : row;
    };
    const saved = cache.get(key);
    if (saved) return restore(saved);
    const generation = cache.generation;
    const result = await next();
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.$mediaContentType?.startsWith('image/')) return result;
    const field = ['content', 'value'].find(name => row[name] != null);
    if (!field) return result;
    let committed = false;
    let buffer;
    const save = () => {
      if (committed && buffer && cache.generation === generation) {
        const metadata = { ...row };
        delete metadata[field];
        cache.set(key, { row: metadata, buffer, field, array: Array.isArray(result) }, buffer.length);
      }
    };
    req.on('succeeded', () => { committed = true; save(); });
    if (Buffer.isBuffer(row[field])) { buffer = row[field]; save(); return result; }
    if (!(row[field] instanceof Readable)) return result;
    const chunks = [];
    let size = 0;
    const capture = new Transform({
      transform(chunk, encoding, callback) {
        size += chunk.length;
        if (size <= cache.maxEntryBytes) chunks.push(Buffer.from(chunk));
        else chunks.length = 0;
        callback(null, chunk);
      },
      flush(callback) {
        if (size <= cache.maxEntryBytes) { buffer = Buffer.concat(chunks); save(); }
        callback();
      },
    });
    const source = row[field];
    source.on('error', error => capture.destroy(error));
    capture.on('close', () => source.destroy());
    row[field] = source.pipe(capture);
    return result;
  });
  return cache;
}

module.exports = { ImageCache, registerImageCache };
