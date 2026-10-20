const assert = require('node:assert/strict');
const { test } = require('node:test');
const sharp = require('sharp');
const cds = require('@sap/cds/lib');
const { ImageCache } = require('../srv/image-cache');
const { PROFILE, optimizeImage } = require('../srv/image-processing');

cds.env.requires.auth = { kind: 'mocked', users: {
  admin: { password: 'pass', roles: ['admin', 'authenticated-user'] },
  alice: { password: 'pass', roles: ['authenticated-user'] },
} };
const server = cds.test('serve', 'all', '--in-memory');
const headers = (user = 'admin') => ({ authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}` });
const request = (path, options = {}, user = 'admin') => fetch(`${server.url}${path}`, {
  ...options, headers: { ...headers(user), ...options.headers },
});
const action = (body, user) => request('/odata/v4/api/compressExistingImages', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}, user);

async function fixture() {
  return sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#168359' } }).png().toBuffer();
}

test('image cache expires and evicts by bytes', () => {
  let time = 0;
  const cache = new ImageCache({ ttl: 10, maxBytes: 6, maxEntryBytes: 4, now: () => time });
  cache.set('a', 'A', 3);
  cache.set('b', 'B', 3);
  assert.equal(cache.get('a'), 'A');
  cache.set('c', 'C', 3);
  assert.equal(cache.get('b'), undefined);
  cache.set('large', 'large', 5);
  assert.equal(cache.get('large'), undefined);
  time = 11;
  assert.equal(cache.get('a'), undefined);
  cache.clear();
  assert.equal(cache.bytes, 0);
});

test('optimization reduces dimensions and bytes without enlarging small images', async () => {
  const input = await fixture();
  const result = await optimizeImage(input, 'photo.png');
  const metadata = await sharp(result.content).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 614);
  assert.equal(metadata.format, 'webp');
  assert.ok(result.content.length < input.length);
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).webp().toBuffer();
  assert.ok((await optimizeImage(tiny, 'tiny.webp')).content.length <= tiny.length);
});

test('V2 upload compresses, V2/V4 media reads cache, updates invalidate, admin backfill is resumable', async () => {
  const db = await cds.connect.to('db');
  const entity = 'hwb.db.Attachments_local';
  const id = '10000000-0000-4000-8000-000000000001';
  const original = await fixture();
  const create = await request('/odata/v4/api/Attachments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ID: id, filename: 'photo.png', mimeType: 'image/png' }),
  });
  assert.equal(create.status, 201, await create.text());
  const upload = await request(`/odata/v2/api/Attachments/${id}/content`, {
    method: 'PUT', headers: { 'content-type': 'image/png' }, body: original,
  });
  assert.ok(upload.ok, await upload.text());
  const stored = await SELECT.one.from(entity).columns('mimeType', 'filename', 'compressionProfile').where({ ID: id });
  assert.equal(stored.mimeType, 'image/webp');
  assert.equal(stored.filename, 'photo.webp');
  assert.equal(stored.compressionProfile, PROFILE);

  for (const path of [`/odata/v2/api/Attachments/${id}/content`, `/odata/v4/api/Attachments(${id})/content`]) {
    const first = await request(path);
    assert.equal(first.status, 200, await first.clone().text());
    assert.match(first.headers.get('content-type'), /image\/webp/);
    const bytes = Buffer.from(await first.arrayBuffer());
    assert.ok(bytes.length < original.length);
    // Alter DB directly: a repeat must still come from cache, with no blob SELECT.
    await UPDATE(entity).set({ content: Buffer.from('uncached') }).where({ ID: id });
    const second = await request(path);
    assert.deepEqual(Buffer.from(await second.arrayBuffer()), bytes);
    const update = await request(`/odata/v4/api/Attachments(${id})/content`, {
      method: 'PUT', headers: { 'content-type': 'image/png' }, body: original,
    });
    assert.ok(update.ok, await update.text());
    const refreshed = await request(path);
    assert.deepEqual(Buffer.from(await refreshed.arrayBuffer()), bytes);
  }
  const forbidden = await action({}, 'alice');
  assert.equal(forbidden.status, 403);
  assert.equal((await action({ batchSize: 0 })).status, 400);
  const ids = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'];
  await INSERT.into(entity).entries(ids.map(ID => ({ ID, content: original, mimeType: 'image/png', filename: 'old.png' })));
  const firstBatch = await action({ batchSize: 1 });
  const firstBody = await firstBatch.json();
  assert.equal(firstBatch.status, 200, JSON.stringify(firstBody));
  assert.equal(firstBody.compressed, 1);
  assert.equal(firstBody.hasMore, true);
  assert.ok(Number(firstBody.bytesSaved) > 0);
  const secondBatch = await action({ batchSize: 1, afterId: firstBody.nextAfterId });
  const secondBody = await secondBatch.json();
  assert.equal(secondBody.compressed, 1, JSON.stringify(secondBody));
  assert.equal(secondBody.hasMore, false);
  const repeated = await (await action({})).json();
  assert.equal(repeated.processed, 0, JSON.stringify(repeated));
  const anonymous = await fetch(`${server.url}/odata/v4/api/Attachments(${id})/content`);
  assert.equal(anonymous.status, 401);
  const invalid = await request(`/odata/v4/api/Attachments(${id})/content`, {
    method: 'PUT', headers: { 'content-type': 'image/png' }, body: Buffer.from('invalid image'),
  });
  assert.equal(invalid.status, 400);
  const stillValid = await request(`/odata/v4/api/Attachments(${id})/content`);
  assert.equal((await sharp(Buffer.from(await stillValid.arrayBuffer())).metadata()).format, 'webp');

  const badId = '30000000-0000-4000-8000-000000000001';
  const goodId = '30000000-0000-4000-8000-000000000002';
  await INSERT.into(entity).entries([
    { ID: badId, mimeType: 'image/png', content: Buffer.from('broken') },
    { ID: goodId, mimeType: 'image/png', content: original },
  ]);
  const mixed = await (await action({})).json();
  assert.equal(mixed.failed, 1, JSON.stringify(mixed));
  assert.deepEqual(mixed.failedIds, [badId]);
  assert.equal(mixed.compressed, 1);
  // Backfill invalidates cached old media too.
  await UPDATE(entity).set({ content: original, mimeType: 'image/png', compressionProfile: null }).where({ ID: id });
  await action({});
  const afterBackfill = await request(`/odata/v4/api/Attachments(${id})/content`);
  assert.match(afterBackfill.headers.get('content-type'), /image\/webp/);
  await afterBackfill.arrayBuffer();
  const cleared = await request(`/odata/v4/api/Attachments(${id})`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: null }),
  });
  assert.ok(cleared.ok, await cleared.text());
  assert.equal((await request(`/odata/v4/api/Attachments(${id})/content`)).status, 204);
});

test('inline uploads are optimized and client cannot spoof the compression marker', async () => {
  const id = '40000000-0000-4000-8000-000000000001';
  const response = await request('/odata/v4/api/Attachments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ID: id, filename: 'inline.png', mimeType: 'image/png',
      content: (await fixture()).toString('base64'), compressionProfile: 'spoofed' }),
  });
  assert.equal(response.status, 201, await response.text());
  const stored = await SELECT.one.from('hwb.db.Attachments_local')
    .columns('compressionProfile', 'mimeType').where({ ID: id });
  assert.equal(stored.compressionProfile, PROFILE);
  assert.equal(stored.mimeType, 'image/webp');
});
