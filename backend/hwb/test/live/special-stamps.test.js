// Explicit live acceptance test, outside npm test's glob. Always uses its own in-memory DB.
// Official notices change over time. Verify import invariants rather than a dated notice count.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: {
  admin: { password: 'pass', roles: ['authenticated-user', 'admin'] },
} };
const server = cds.test('serve', 'all', '--in-memory');

test('live official import after initialization remains idempotent and retains previous warnings', async () => {
  const db = await cds.connect.to('db');
  const { Stampboxes, StampNotices } = db.entities('hwb.db');
  const [columns, ...rows] = cds.parse.csv(readFileSync(path.join(__dirname, '../../db/doNotDeploy-data/hwb.db.Stampboxes.csv'), 'utf8'));
  const regular = rows.map(row => Object.fromEntries(columns.map((key, i) => [key, row[i]])))
    .filter(s => s.stampType === 'regular')
    .map(s => ({ ID: s.ID, name: s.name, number: s.number, latitude: s.latitude, longitude: s.longitude }));
  assert.equal(regular.length, 222);
  await INSERT.into(Stampboxes).entries(regular);
  const legacyId = '134ca494-5c84-4884-a694-88811fe59999';
  await INSERT.into(StampNotices).entries({ ID: legacyId, stamp_ID: regular[0].ID,
    source: 'official', sourceKey: 'synthetic-previous-warning', status: 'approved', kind: 'defect', message: 'Synthetische Alt-Warnung' });
  async function action(name, preview) {
    const response = await fetch(`${server.url}/odata/v4/api/${name}`, {
      method: 'POST', headers: { authorization: `Basic ${Buffer.from('admin:pass').toString('base64')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ preview }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return JSON.parse(body.value);
  }
  const before = await action('syncOfficialNotices', true);
  assert.ok(before.matched.length > 0, 'The live source must contain mapped regular notices');
  const sourceEntryCount = before.matched.length + before.unmatched.length;
  const initialized = await action('initializeSpecialStamps', false);
  assert.equal(initialized.created, 151);
  assert.equal((await SELECT.from(StampNotices)).length, 1);
  const preview = await action('syncOfficialNotices', true);
  assert.ok(preview.matched.length > before.matched.length, 'Initializing specials must resolve more source notices');
  assert.equal(preview.matched.length + preview.unmatched.length, sourceEntryCount, 'Initialization must not lose source notices');
  assert.deepEqual(preview.unmatched.map(e => e.message), ['Brandberg']);
  assert.equal((await SELECT.from(StampNotices)).length, 1);
  const first = await action('syncOfficialNotices', false);
  assert.equal(first.retainedPrevious, true);
  const notices = await SELECT.from(StampNotices);
  assert.equal(notices.length, preview.matched.length + 1);
  assert.equal(notices.find(n => n.ID === legacyId).status, 'approved');
  const second = await action('syncOfficialNotices', false);
  assert.equal(second.retainedPrevious, true);
  assert.deepEqual((await SELECT.from(StampNotices)).map(n => n.ID).sort(), notices.map(n => n.ID).sort());
  assert.equal((await SELECT.one.from(StampNotices).where({ ID: legacyId })).status, 'approved');
  console.log('LIVE_RESULT', JSON.stringify({ checkedAt: first.checkedAt, before: [before.matched.length, before.unmatched.length], after: [preview.matched.length, preview.unmatched.length], retainedPrevious: true, idempotent: true }));
});
