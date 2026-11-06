const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: {
  admin: { password: 'pass', roles: ['admin', 'authenticated-user'] },
  alice: { password: 'pass', roles: ['authenticated-user'] }, bob: { password: 'pass', roles: ['authenticated-user'] },
} };
const server = cds.test('serve', 'all', '--in-memory');
let db, stamp, collection;
async function request(path, body, user = 'admin') {
  return fetch(`${server.url}/odata/v4/api/${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const payload = () => ({ code: 'test-booklet', edition: '2026', name: 'Testheft', kind: 'booklet', sourceUrl: 'https://example.org/source',
  reviewedAt: '2026-10-20', expectedStampCount: 1, minimumOptionalCount: 0, regularVisitTarget: 0,
  published: true, entries: [{ stampId: stamp.ID, required: true }] });
before(async () => { await server; db = await cds.connect.to('db'); });
test('admin-only special stamps, stable identities and reserved regular numbers', async () => {
  const input = { catalogKey: 'hwn:special:test', number: 'S-01', name: 'Sonderstempel', latitude: 51.8, longitude: 10.6, sourceUrl: 'https://example.org/source' };
  assert.equal((await request('createSpecialStamp', input, 'alice')).status, 403);
  assert.equal((await request('createSpecialStamp', { ...input, number: '1' })).status, 400);
  assert.equal((await request('createSpecialStamp', { ...input, latitude: 100 })).status, 400);
  const response = await request('createSpecialStamp', input);
  assert.equal(response.status, 200, await response.clone().text()); stamp = await response.json();
  assert.equal(stamp.stampKind, 'special'); assert.equal((await request('createSpecialStamp', input)).status, 409);
});
test('publication validates complete membership; generic CRUD cannot bypass checks', async () => {
  assert.equal((await request('saveThemeCollection', payload(), 'alice')).status, 403);
  for (const changes of [{ expectedStampCount: 2 }, { entries: [{ stampId: cds.utils.uuid(), required: true }] },
    { expectedStampCount: 2, entries: [...payload().entries, ...payload().entries] }, { sourceUrl: 'http://example.org' }]) {
    assert.equal((await request('saveThemeCollection', { ...payload(), ...changes })).status, 400);
  }
  const response = await request('saveThemeCollection', payload());
  assert.equal(response.status, 200, await response.clone().text()); collection = await response.json();
  assert.equal((await request('ThemeCollections', payload())).status, 405);
  assert.equal((await request('ThemeCollections', undefined, 'alice')).status, 403);
});
test('personal progress deduplicates visits and shared membership never leaks friend visits', async () => {
  await db.run(INSERT.into('hwb.db.Stampings').entries([1, 2].map(() => ({ ID: cds.utils.uuid(), stamp_ID: stamp.ID, createdBy: 'alice' }))));
  let result = await (await request('getThemeCatalog()', undefined, 'alice')).json();
  assert.equal(result.value[0].collectedCount, 1); assert.equal(result.value[0].complete, true);
  result = await (await request('getThemeCatalog()', undefined, 'bob')).json();
  assert.equal(result.value[0].collectedCount, 0); assert.equal(result.value[0].complete, false);
  assert.equal((await request('saveThemeCollection', { ...payload(), code: 'shared-trail', kind: 'trail' })).status, 200);
  result = await (await request('getThemeCatalog()', undefined, 'alice')).json();
  assert.equal(result.value.length, 2); assert.ok(result.value.every(item => item.collectedCount === 1));
});
test('revision prevents lost updates; failed writes preserve links and drafts are hidden', async () => {
  assert.equal((await request('saveThemeCollection', { ...payload(), ID: collection.ID, revision: 0 })).status, 409);
  assert.equal((await request('saveThemeCollection', { ...payload(), ID: collection.ID, revision: 1, entries: [{ stampId: cds.utils.uuid(), required: true }] })).status, 400);
  assert.equal((await db.run(SELECT.from('hwb.db.ThemeStampLinks').where({ collection_ID: collection.ID }))).length, 1);
  const response = await request('saveThemeCollection', { ...payload(), ID: collection.ID, revision: 1, published: false });
  assert.equal(response.status, 200); assert.equal((await response.json()).revision, 2);
  assert.equal((await (await request('getThemeCatalog()', undefined, 'alice')).json()).value.length, 1);
});
test('special stamps never inflate regular HWN progress', async () => {
  await db.run(INSERT.into('hwb.db.Stampboxes').entries({ ID: cds.utils.uuid(), name: 'Regular', number: '1' }));
  const response = await request('getUsersProgress', { sGroupUserIds: 'alice' }, 'alice');
  assert.equal(response.status, 200, await response.clone().text());
  const rows = JSON.parse((await response.json()).value);
  assert.equal(rows[0].visitedCount, 0); assert.equal(rows[0].completionPercent, 0);
});
test('required, optional and regular-total conditions are evaluated independently', async () => {
  const optional = cds.utils.uuid(), optional2 = cds.utils.uuid();
  await db.run(INSERT.into('hwb.db.Stampboxes').entries([
    { ID: optional, number: '2', name: 'Wahl 1' }, { ID: optional2, number: '3', name: 'Wahl 2' },
  ]));
  const response = await request('saveThemeCollection', { ...payload(), code: 'choice-rule', expectedStampCount: 3,
    minimumOptionalCount: 1, regularVisitTarget: 1,
    entries: [...payload().entries, { stampId: optional, required: false }, { stampId: optional2, required: false }] });
  assert.equal(response.status, 200);
  const read = async () => (await (await request('getThemeCatalog()', undefined, 'alice')).json()).value.find(item => item.code === 'choice-rule');
  assert.equal((await read()).complete, false);
  await db.run(INSERT.into('hwb.db.Stampings').entries({ ID: cds.utils.uuid(), stamp_ID: optional, createdBy: 'alice' }));
  const progress = await read(); assert.equal(progress.complete, true); assert.equal(progress.collectedCount, 2); assert.equal(progress.regularVisited, 1);
});
test('reviewed catalog imports through admin endpoints and repeat import preserves editorial changes', async () => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const regulars = await db.run(SELECT.from('hwb.db.Stampboxes').columns('number').where({ stampKind: 'regular' }));
  const existing = new Set(regulars.map(stamp => stamp.number));
  const missing = Array.from({ length: 222 }, (_, index) => String(index + 1)).filter(number => !existing.has(number));
  await db.run(INSERT.into('hwb.db.Stampboxes').entries(missing.map(number => ({ ID: cds.utils.uuid(), number, name: `HWN ${number}` }))));
  const run = () => promisify(execFile)(process.execPath, ['scripts/import-theme-catalog.cjs', '--apply'], {
    cwd: process.cwd(), env: { ...process.env, HWB_BACKEND_URL: server.url,
      HWB_ADMIN_AUTHORIZATION: `Basic ${Buffer.from('admin:pass').toString('base64')}` },
  });
  await run();
  const readCollections = () => db.run(SELECT.from('hwb.db.ThemeCollections'));
  const before = await readCollections();
  const snapshot = require('../catalog/theme-booklets.json');
  const imported = before.filter(item => snapshot.collections.some(row => row.code === item.code && row.edition === item.edition));
  assert.equal(imported.length, 12); assert.equal(imported.filter(item => item.published).length, 7);
  const luther = imported.find(item => item.code === 'lutherweg');
  await db.run(UPDATE('hwb.db.ThemeCollections').set({ rulesNote: 'Editorial correction' }).where({ ID: luther.ID }));
  await run();
  assert.equal((await readCollections()).length, before.length);
  assert.equal((await readCollections()).find(item => item.ID === luther.ID).rulesNote, 'Editorial correction');
  const response = await request('getThemeMappingReport()', undefined, 'alice'); assert.equal(response.status, 403);
  const report = JSON.parse((await (await request('getThemeMappingReport()')).json()).value);
  assert.equal(report.collections.find(item => item.ID === luther.ID).mappedCount, 10);
  const themes = (await (await request('getThemeCatalog()', undefined, 'alice')).json()).value;
  const album = JSON.parse((await (await request('getBadgeAlbum()', undefined, 'alice')).json()).value);
  for (const theme of themes.filter(item => item.badgeId)) {
    assert.equal(theme.complete, album.entries.find(item => item.id === theme.badgeId).unlocked);
  }
});

test('published edition controls the same badge engine; unknown targets and competing editions are rejected', async () => {
  const goethe = await db.run(SELECT.one.from('hwb.db.ThemeCollections').where({ badgeId: 'goethe', published: true }));
  const row = { ...payload(), ID: goethe.ID, revision: goethe.revision, code: goethe.code, edition: goethe.edition, badgeId: 'goethe' };
  const changed = await request('saveThemeCollection', row);
  assert.equal(changed.status, 200, await changed.clone().text());
  const album = JSON.parse((await (await request('getBadgeAlbum()', undefined, 'alice')).json()).value);
  assert.equal(album.entries.find(item => item.id === 'goethe').unlocked, true);
  assert.equal((await request('saveThemeCollection', { ...payload(), code: 'competing', badgeId: 'goethe' })).status, 409);
  assert.equal((await request('saveThemeCollection', { ...payload(), code: 'invalid-badge', badgeId: 'emperor' })).status, 400);
});

test('special stamps without validity limits stay visible to map and public clients', async () => {
  const personal = await request('Stampboxes?$select=ID,stampKind', undefined, 'alice');
  assert.equal(personal.status, 200);
  assert.ok((await personal.json()).value.some(row => row.ID === stamp.ID));
  const response = await fetch(`${server.url}/odata/v4/public/Stampboxes?$select=ID,stampKind`);
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok((await response.json()).value.some(row => row.ID === stamp.ID && row.stampKind === 'special'));
});
