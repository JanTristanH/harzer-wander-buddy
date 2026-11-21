const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const cds = require('@sap/cds/lib');
const aliases = require('../catalogue/special-stamp-key-aliases.json');
const theme = require('../catalog/theme-booklets.json');
const { catalogRows, planInitialization } = require('../srv/special-stamp-catalog');
const { resolveSpecialStamp, canonicalCatalogKey } = require('../srv/special-stamp-identity');
const { buildAlbum, catalog } = require('../srv/badge-catalog');
const { buildStampingFeedback } = require('../srv/stamping-feedback');
const { regularStampKey } = require('../srv/tour-stamp-counts');
cds.env.requires.auth = { kind: 'mocked', users: {
  admin: { password: 'pass', roles: ['admin', 'authenticated-user'] },
  alice: { password: 'pass', roles: ['authenticated-user'] },
} };
const server = cds.test('serve', 'all', '--in-memory');
let db;
before(async () => { await server; db = await cds.connect.to('db'); });
const rows = catalogRows();
async function action(path, body) {
  const response = await fetch(`${server.url}/odata/v4/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Basic ${Buffer.from('admin:pass').toString('base64')}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
const runImport = () => promisify(execFile)(process.execPath, ['scripts/import-theme-catalog.cjs', '--apply'], {
  cwd: process.cwd(), env: { ...process.env, HWB_BACKEND_URL: server.url,
    HWB_ADMIN_AUTHORIZATION: `Basic ${Buffer.from('admin:pass').toString('base64')}` },
});

test('all 46 historical keys map one-to-one to reviewed canonical UUIDs', () => {
  assert.equal(Object.keys(aliases).length, 46);
  assert.equal(new Set(Object.values(aliases)).size, 46);
  for (const [alias, key] of Object.entries(aliases)) {
    const row = rows.find(item => item.catalogKey === key);
    assert.ok(row, key);
    assert.equal(resolveSpecialStamp({ catalogKey: alias }, [row]).ID, row.ID);
    assert.equal(resolveSpecialStamp(row, [{ ...row, ID: cds.utils.uuid(), catalogKey: alias }]).catalogKey, alias);
    assert.equal(planInitialization([{ ...row, catalogKey: alias }]).missing.some(item => item.ID === row.ID), false);
  }
  assert.equal(aliases['hwn:special:jungborn'], 'special-jungborn');
  assert.ok(aliases['hwn:special:luther-kalte-stelle'].endsWith('kalte-stelle-unterrissdorf'));
  assert.ok(aliases['hwn:special:karst-feldherrenhuegel'].endsWith('feldherrenhuegel-osterode'));
  assert.ok(aliases['hwn:special:geschichte-wernigerode'].endsWith('schloss-wernigerode'));
});

test('ambiguous aliases, reserved UUID conflicts and unresolved names fail closed', () => {
  const canonical = rows.find(row => row.catalogKey === 'special-jungborn');
  const legacy = { ...canonical, ID: cds.utils.uuid(), catalogKey: 'hwn:special:jungborn' };
  assert.throws(() => resolveSpecialStamp(canonical, [canonical, legacy]), /Ambiguous/);
  assert.throws(() => resolveSpecialStamp(canonical, [{ ...canonical, catalogKey: 'unrelated:stamp' }]), /Conflicting/);
  assert.throws(() => resolveSpecialStamp(canonical, [{ ID: cds.utils.uuid(), name: canonical.name, number: 'old' }]), /Unresolved/);
  for (const number of ['9901', 'SX-Jungborn', 'Jungborn']) {
    const old = { ID: cds.utils.uuid(), number, name: 'Historical name' };
    assert.equal(resolveSpecialStamp(canonical, [old]).ID, old.ID);
  }
});

for (const order of ['initialize-first', 'import-first', 'canonical-initialized']) {
  test(`${order}: repeated initialization/import preserve UUIDs, visits, notes, editions and 222 progress`, async () => {
    for (const entity of ['ThemeStampLinks', 'ThemeCollections', 'StampNotes', 'Stampings', 'Stampboxes']) {
      await db.run(DELETE.from(`hwb.db.${entity}`));
    }
    const regular = Array.from({ length: 222 }, (_, i) => ({ ID: cds.utils.uuid(), number: String(i + 1), catalogKey: `hwn-${i + 1}`, name: `HWN ${i + 1}` }));
    // Simulate PR 88's pre-existing identities, with editorial names/coordinates.
    const old = Object.entries(aliases).map(([alias, key]) => ({ ...rows.find(row => row.catalogKey === key),
      ...(order === 'canonical-initialized' ? {} : { ID: cds.utils.uuid() }),
      stampType: order === 'canonical-initialized' ? 'special' : 'regular',
      catalogKey: order === 'canonical-initialized' ? key : alias, name: `Editorial ${alias}`, latitude: 51.5,
    }));
    await db.run(INSERT.into('hwb.db.Stampboxes').entries([...regular, ...old]));
    const visits = [...regular, ...old].map(stamp => ({ ID: cds.utils.uuid(), stamp_ID: stamp.ID, createdBy: 'alice', visitedAt: '2026-01-01' }));
    await db.run(INSERT.into('hwb.db.Stampings').entries(visits));
    const note = { ID: cds.utils.uuid(), stamp_ID: old[0].ID, note: 'Keep my note', createdBy: 'alice' };
    await db.run(INSERT.into('hwb.db.StampNotes').entries(note));
    const visitSnapshot = await db.run(SELECT.from('hwb.db.Stampings'));
    const noteSnapshot = await db.run(SELECT.from('hwb.db.StampNotes'));
    if (order !== 'import-first') await action('initializeSpecialStamps', { preview: false });
    await runImport();
    await action('initializeSpecialStamps', { preview: false });
    const first = await db.run(SELECT.from('hwb.db.Stampboxes'));
    const links = await db.run(SELECT.from('hwb.db.ThemeStampLinks'));
    await action('initializeSpecialStamps', { preview: false });
    await runImport();
    const after = await db.run(SELECT.from('hwb.db.Stampboxes'));
    assert.equal(after.length, 373);
    assert.deepEqual(after, first);
    assert.deepEqual(await db.run(SELECT.from('hwb.db.Stampings')), visitSnapshot);
    assert.deepEqual(await db.run(SELECT.from('hwb.db.StampNotes')), noteSnapshot);
    assert.deepEqual(await db.run(SELECT.from('hwb.db.ThemeStampLinks')), links);
    for (const stamp of old) {
      assert.equal(after.find(row => row.ID === stamp.ID).name, stamp.name);
      assert.equal(after.find(row => row.ID === stamp.ID).latitude, 51.5);
      assert.ok(links.some(link => link.stamp_ID === stamp.ID));
    }
    const collections = await db.run(SELECT.from('hwb.db.ThemeCollections'));
    assert.equal(collections.length, 12);
    assert.equal(collections.filter(row => row.published).length, 7);
    for (const edition of theme.collections) {
      const collection = collections.find(row => row.code === edition.code && row.edition === edition.edition);
      const actual = links.filter(link => link.collection_ID === collection.ID).sort((a, b) => a.position - b.position);
      assert.deepEqual(actual.map(link => link.stamp_ID), edition.entries.map(entry => entry.catalogKey
        ? old.find(stamp => canonicalCatalogKey(stamp.catalogKey) === entry.catalogKey).ID
        : regular.find(stamp => stamp.number === String(entry.regularNumber)).ID));
    }
    const border = history => buildAlbum(after, history).find(badge => badge.id === 'border');
    assert.equal(border(visits).unlocked, true);
    const jungborn = old.find(stamp => canonicalCatalogKey(stamp.catalogKey) === 'special-jungborn');
    assert.equal(border(visits.filter(visit => visit.stamp_ID !== jungborn.ID)).unlocked, false);
    assert.equal(buildAlbum(after, visits).find(badge => badge.id === 'emperor').unlocked, true);
    const regularVisits = visits.filter(visit => regular.some(stamp => stamp.ID === visit.stamp_ID));
    for (const badge of catalog.filter(badge => badge.threshold)) {
      assert.deepEqual(buildAlbum(after, visits).find(item => item.id === badge.id).progress,
        buildAlbum(after, regularVisits).find(item => item.id === badge.id).progress);
    }
    assert.equal(new Set(after.map(regularStampKey).filter(Boolean)).size, 222);
    const feedback = buildStampingFeedback(after, visits, visits.map(visit => visit.ID));
    assert.equal(feedback.afterCount, 222);
    assert.equal(buildStampingFeedback(after, visits.filter(visit => old.some(stamp => stamp.ID === visit.stamp_ID)), []).afterCount, 0);
  });
}

test('import preflight rejects duplicate identities before creating stamps or collections', async () => {
  const canonical = rows.find(row => row.catalogKey === 'special-jungborn');
  await db.run(INSERT.into('hwb.db.Stampboxes').entries({ ...canonical, ID: cds.utils.uuid(), catalogKey: 'hwn:special:jungborn' }));
  const before = await db.run(SELECT.from('hwb.db.Stampboxes'));
  const links = await db.run(SELECT.from('hwb.db.ThemeStampLinks'));
  await assert.rejects(runImport(), /Ambiguous special stamp identity/);
  assert.deepEqual(await db.run(SELECT.from('hwb.db.Stampboxes')), before);
  assert.deepEqual(await db.run(SELECT.from('hwb.db.ThemeStampLinks')), links);
});
