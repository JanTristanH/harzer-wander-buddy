const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const cds = require('@sap/cds/lib');
const { catalogue, catalogRows, planInitialization } = require('../srv/special-stamp-catalog');
const { buildAlbum, catalog, normalizeNumber } = require('../srv/badge-catalog');
const { buildStampingFeedback } = require('../srv/stamping-feedback');
const { parseOfficialNotices } = require('../srv/official-notices');

const special = catalogRows();
const regular = Array.from({ length: 222 }, (_, i) => ({ ID: `regular-${i + 1}`, number: String(i + 1), name: `HWN ${i + 1}` }));
test('reviewed catalog and development CSV contain all special entries without duplicating regular identities', () => {
  assert.equal(special.length, 151);
  assert.equal(new Set(special.map(s => s.ID)).size, 151);
  assert.equal(new Set(special.map(s => s.catalogKey)).size, 151);
  assert.equal(special.filter(s => s.locationStatus === 'verified').length, 124);
  for (const stamp of special) {
    assert.equal(stamp.stampType, 'special');
    assert.match(stamp.sourceUrl, /^https:\/\/www\.harzer-wandernadel\.de\//);
    if (stamp.locationStatus === 'verified') {
      assert.ok(stamp.latitude > 50 && stamp.latitude < 53, stamp.name);
      assert.ok(stamp.longitude > 9 && stamp.longitude < 13, stamp.name);
    } else { assert.equal(stamp.latitude, null); assert.equal(stamp.longitude, null); }
  }
  const [columns, ...csv] = cds.parse.csv(readFileSync(path.join(__dirname, '../db/doNotDeploy-data/hwb.db.Stampboxes.csv'), 'utf8'));
  assert.equal(csv.length, 373);
  const rows = csv.map(row => Object.fromEntries(columns.map((key, i) => [key, row[i]])));
  assert.deepEqual(rows.filter(row => row.stampType === 'regular').map(row => Number(row.number)).sort((a, b) => a - b), regular.map(s => Number(s.number)));
  assert.deepEqual(rows.filter(row => row.stampType === 'special').map(row => row.ID).sort(), special.map(row => row.ID).sort());
  assert.equal(planInitialization(rows).missing.length, 0);
});

test('reviewed image links and credits reach initialization and dummy CSV without touching existing records', () => {
  const [columns, ...csv] = cds.parse.csv(readFileSync(path.join(__dirname, '../db/doNotDeploy-data/hwb.db.Stampboxes.csv'), 'utf8'));
  const rows = csv.map(row => Object.fromEntries(columns.map((key, i) => [key, row[i]])));
  const images = special.filter(stamp => stamp.heroImageUrl);
  assert.equal(images.length, 50);
  for (const stamp of images) {
    assert.equal(stamp.heroImageUrl, `https://www.harzer-wander-buddy.de/assets/images/stampboxes/special/${stamp.catalogKey}.webp`);
    assert.match(stamp.imageCaption, /https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(stamp.imageCaption, /https:\/\/creativecommons\.org\//);
    const fixture = rows.find(row => row.ID === stamp.ID);
    assert.equal(fixture.heroImageUrl, stamp.heroImageUrl);
    assert.equal(fixture.imageCaption, stamp.imageCaption);
  }
  const existing = { ...images[0], heroImageUrl: 'https://example.org/admin.webp', imageCaption: 'Admin credit' };
  const before = structuredClone(existing);
  const plan = planInitialization([existing]);
  assert.equal(plan.missing.some(row => row.ID === existing.ID), false);
  assert.deepEqual(existing, before);
  assert.ok(special.filter(stamp => !stamp.heroImageUrl).every(stamp => !stamp.imageCaption));
});

test('the real Grenzweg special identities unlock only their own requirements; other specials remain separate', () => {
  const rule = catalog.find(rule => rule.id === 'border');
  const required = rule.required.filter(n => typeof n === 'number');
  const visits = required.map(n => ({ ID: `v${n}`, stamp_ID: `regular-${n}`, visitedAt: '2026-01-01' }));
  const all = [...regular, ...special];
  const border = history => buildAlbum(all, history).find(rule => rule.id === 'border');
  assert.equal(border(visits).unlocked, false);
  const specialVisits = ['special-jungborn', 'special-two-countries-oak', 'special-three-countries-stone'].map((key, i) => ({
    ID: `vs${i}`, stamp_ID: special.find(s => s.catalogKey === key).ID, visitedAt: '2026-01-02',
  }));
  assert.equal(border([...visits, ...specialVisits]).unlocked, true);
  assert.equal(border([...visits, ...specialVisits.slice(1)]).unlocked, false);
  const allVisits = special.map((s, i) => ({ ID: `s${i}`, stamp_ID: s.ID, visitedAt: '2026-01-03' }));
  const album = buildAlbum(all, allVisits);
  assert.equal(album.find(rule => rule.id === 'bronze').progress[0].current, 0);
  const feedback = buildStampingFeedback(all, allVisits, allVisits.map(v => v.ID));
  assert.equal(feedback.afterCount, 0);
  assert.equal(feedback.newPlaces, 151);
  assert.equal(normalizeNumber('Not-Jungborn-other-place'), 'Not-Jungborn-other-place');
});

test('exact reviewed notice texts match special identities, while Brandberg and unknown descriptions remain unresolved', () => {
  const messages = catalogue.stamps.flatMap(s => s.noticeAliases);
  const html = `<h2>Aktuell gemeldete Defekte</h2><ul>${[...messages, 'Brandberg', 'Kloster Michaelstein ganz anderer Hinweis'].map(m => `<li>${m}</li>`).join('')}</ul>`;
  const result = parseOfficialNotices(html, [...regular, ...special]);
  assert.equal(result.filter(e => e.stamp_ID).length, 10);
  assert.deepEqual(result.filter(e => !e.stamp_ID).map(e => e.message), ['Brandberg', 'Kloster Michaelstein ganz anderer Hinweis']);
  const michaelstein = result.find(e => e.message.includes('Kloster Michaelstein'));
  assert.equal(michaelstein.stamp_ID, special.find(s => s.catalogKey.includes('klosterwanderweg-kloster-michaelstein')).ID);
  const [columns, ...csv] = cds.parse.csv(readFileSync(path.join(__dirname, '../db/doNotDeploy-data/hwb.db.Stampboxes.csv'), 'utf8'));
  const stamps = csv.map(row => Object.fromEntries(columns.map((key, i) => [key, row[i]])));
  const liveFixture = readFileSync(path.join(__dirname, 'fixtures/official-notices-2026-11-07.html'), 'utf8');
  const before = parseOfficialNotices(liveFixture, stamps.filter(s => s.stampType === 'regular'));
  assert.equal(before.filter(e => e.stamp_ID).length, 17);
  assert.equal(before.filter(e => !e.stamp_ID).length, 11);
  const after = parseOfficialNotices(liveFixture, stamps);
  assert.equal(after.filter(e => e.stamp_ID).length, 27);
  assert.deepEqual(after.filter(e => !e.stamp_ID).map(e => e.message), ['Brandberg']);
  const misleading = '<h2>Aktuell gemeldete Defekte</h2><h4>Sonderstempelstellen</h4><ul><li>HWN 12</li></ul>';
  assert.equal(parseOfficialNotices(misleading, stamps)[0].stamp_ID, null);
});

cds.env.requires.auth = { kind: 'mocked', users: {
  alice: { password: 'pass', roles: ['authenticated-user'] },
  admin: { password: 'pass', roles: ['authenticated-user', 'admin'] },
} };
const server = cds.test('serve', 'all', '--in-memory');
async function initialize(user, preview) {
  const response = await fetch(`${server.url}/odata/v4/api/initializeSpecialStamps`, {
    method: 'POST', headers: { authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify(preview === undefined ? {} : { preview }),
  });
  const body = await response.json();
  return { status: response.status, result: response.ok ? JSON.parse(body.value) : body };
}
test('admin initialization is explicit, serialized, idempotent and preserves existing catalog, visits and notices', async () => {
  const db = await cds.connect.to('db');
  const { Stampboxes, Stampings, StampNotices } = db.entities('hwb.db');
  const legacy = '134ca494-5c84-4884-a694-88811fe50001';
  const regularId = '134ca494-5c84-4884-a694-88811fe50002';
  await INSERT.into(Stampboxes).entries([
    { ID: legacy, number: '9910', name: 'Lokaler Altbestand', latitude: 51.1, longitude: 10.1 },
    { ID: regularId, number: '12', name: 'Achtermannshöhe' },
  ]);
  await INSERT.into(Stampings).entries({ ID: '134ca494-5c84-4884-a694-88811fe50003', stamp_ID: regularId, createdBy: 'alice' });
  await INSERT.into(StampNotices).entries({ ID: '134ca494-5c84-4884-a694-88811fe50004', stamp_ID: regularId, status: 'approved', source: 'official', kind: 'defect', message: 'Vorhandene Warnung' });
  assert.equal((await initialize('alice', false)).status, 403);
  let response = await initialize('admin');
  assert.equal(response.status, 200);
  assert.equal(response.result.preview, true);
  assert.equal(response.result.pending, 150);
  assert.equal((await SELECT.from(Stampboxes)).length, 2);
  const concurrent = await Promise.all([initialize('admin', false), initialize('admin', false)]);
  concurrent.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.result)));
  assert.equal(concurrent.reduce((sum, result) => sum + result.result.created, 0), 150);
  assert.equal(concurrent[0].result.conflicts.length, 1);
  const jungborn = special.find(s => s.catalogKey === 'special-jungborn');
  await UPDATE(Stampboxes).set({ name: 'Admin-korrigierter Name', latitude: 51.2, heroImageUrl: 'https://example.org/custom.webp', imageCaption: 'Eigener Bildnachweis' }).where({ ID: jungborn.ID });
  response = await initialize('admin', false);
  assert.equal(response.result.created, 0);
  assert.equal(response.result.existing, 150);
  assert.equal((await SELECT.one.from(Stampboxes).where({ ID: jungborn.ID })).name, 'Admin-korrigierter Name');
  assert.equal((await SELECT.one.from(Stampboxes).where({ ID: jungborn.ID })).heroImageUrl, 'https://example.org/custom.webp');
  assert.equal((await SELECT.one.from(Stampboxes).where({ ID: jungborn.ID })).imageCaption, 'Eigener Bildnachweis');
  assert.equal((await SELECT.one.from(Stampboxes).where({ ID: legacy })).latitude, 51.1);
  assert.equal((await SELECT.from(Stampings)).length, 1);
  assert.equal((await SELECT.one.from(StampNotices)).status, 'approved');
  const headers = { authorization: `Basic ${Buffer.from('admin:pass').toString('base64')}` };
  const unlocated = special.find(s => s.catalogKey === 'special-kartoffelhaus-wernigerode');
  const noRoute = await fetch(`${server.url}/odata/v4/api/getRouteToStampFromPosition`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ stampId: unlocated.ID, latitude: 51, longitude: 10 }),
  });
  assert.equal(noRoute.status, 422, await noRoute.text());
  const points = await fetch(`${server.url}/odata/v4/api/AllPointsOfInterest`, { headers });
  assert.equal(points.status, 200);
  assert.ok((await points.json()).value.every(p => p.latitude !== null && p.longitude !== null));
  const neighbors = await fetch(`${server.url}/odata/v4/api/NeighborsStampStamp?$filter=NeighborsID eq ${unlocated.ID}`, { headers });
  assert.equal(neighbors.status, 200);
  assert.equal((await neighbors.json()).value.length, 0);
  const progressResponse = await fetch(`${server.url}/odata/v4/api/getUsersProgress`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from('admin:pass').toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sGroupUserIds: 'alice' }),
  });
  assert.equal(progressResponse.status, 200);
  const progress = JSON.parse((await progressResponse.json()).value);
  assert.equal(progress[0].visitedCount, 1);
  assert.equal(progress[0].completionPercent, 100);
});
