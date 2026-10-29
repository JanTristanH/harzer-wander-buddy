const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: {
  alice: { password: 'pass', roles: ['authenticated-user'] },
  bob: { password: 'pass', roles: ['authenticated-user'] }
} };
const server = cds.test('serve', 'all', '--in-memory');
const stampId = '11111111-1111-4111-8111-111111111111';
let db;
before(async () => {
  await server; db = await cds.connect.to('db');
  await db.run(INSERT.into('hwb.db.ExternalUsers').entries([{ ID: 'alice', name: 'Alice' }, { ID: 'bob', name: 'Bob' }]));
  await db.run(INSERT.into('hwb.db.Stampboxes').entries({ ID: stampId, number: '1', name: 'Offline notes test' }));
});
async function request(path, body, user = 'alice', method = 'POST') {
  return fetch(`${server.url}/odata/v4/api/${path}`, { method,
    headers: { authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify(body) });
}
async function sync(note, base = null, user = 'alice') {
  const response = await request('syncStampNote', { stampId, note, expectedId: base?.ID ?? null,
    expectedModifiedAt: base?.modifiedAt ?? null, expectedNote: base?.note ?? null }, user);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
test('new note, lost-response replay, concurrent stale device, resolution and clearing', async () => {
  const first = await sync('  erster Entwurf  ');
  assert.equal(first.conflict, false); assert.equal(first.current.note, 'erster Entwurf');
  assert.equal(first.current.createdBy, 'alice'); assert.ok(first.current.modifiedAt);
  const replay = await sync('erster Entwurf'); assert.equal(replay.conflict, false);
  assert.equal(replay.current.ID, first.current.ID);
  const staleCreation = await sync('anderes Gerät'); assert.equal(staleCreation.conflict, true);
  assert.equal(staleCreation.current.note, 'erster Entwurf');
  const next = await sync('zweite Fassung', first.current); assert.equal(next.conflict, false);
  const staleUpdate = await sync('offline bearbeitet', first.current); assert.equal(staleUpdate.conflict, true);
  assert.equal(staleUpdate.current.note, 'zweite Fassung');
  const resolved = await sync('beide Fassungen kombiniert', staleUpdate.current); assert.equal(resolved.conflict, false);
  const cleared = await sync('', resolved.current); assert.equal(cleared.current.note, '');
  assert.equal((await db.run(SELECT.from('hwb.db.StampNotes').where({ createdBy: 'alice' }))).length, 1);
});
test('another account cannot read or overwrite the first account through sync', async () => {
  const bob = await sync('Bobs Notiz', null, 'bob'); assert.equal(bob.current.createdBy, 'bob');
  const alice = await db.run(SELECT.one.from('hwb.db.StampNotes').where({ createdBy: 'alice' }));
  const result = await sync('Angriff', alice, 'bob'); assert.equal(result.conflict, true);
  assert.equal(result.current.createdBy, 'bob');
  assert.equal((await db.run(SELECT.one.from('hwb.db.StampNotes').where({ createdBy: 'alice' }))).note, '');
});
test('legacy online writes are detected as conflicts by an offline device', async () => {
  const base = (await sync('')).current;
  const online = await request('StampNotes', { stamp: { ID: stampId }, note: 'Web geändert' });
  assert.equal(online.status, 201, await online.clone().text());
  const stale = await sync('Offline geändert', base); assert.equal(stale.conflict, true);
  assert.equal(stale.current.note, 'Web geändert');
});
test('simultaneous devices cannot both overwrite the same base', async () => {
  const base = (await sync('Web geändert')).current;
  const results = await Promise.all([sync('Gerät A', base), sync('Gerät B', base)]);
  assert.equal(results.filter((r) => !r.conflict).length, 1);
  assert.equal(results.filter((r) => r.conflict).length, 1);
});
test('validates length, stamp existence and authentication', async () => {
  assert.equal((await request('syncStampNote', { stampId, note: 'x'.repeat(501) })).status, 400);
  assert.equal((await request('syncStampNote', { stampId: '22222222-2222-4222-8222-222222222222', note: 'x' })).status, 404);
  const unauthenticated = await fetch(`${server.url}/odata/v4/api/syncStampNote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stampId, note: 'x' }) });
  assert.equal(unauthenticated.status, 401);
});
