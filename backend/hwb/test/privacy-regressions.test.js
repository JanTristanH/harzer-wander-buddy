const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.CDS_ENV = 'dev-basic';
const cds = require('@sap/cds');
for (const id of ['exporter', 'viewer', 'offender', 'deleting', 'admin']) {
  cds.env.requires.auth.users[id] = { password: 'pass', roles: ['authenticated-user', ...(id === 'admin' ? ['admin'] : [])] };
}
const server = cds.test('serve', 'all', '--in-memory');
const { SELECT, INSERT, DELETE } = cds.ql;
const request = (path, user = 'viewer', options = {}) => fetch(`${server.url}/odata/v4/api/${path}`, {
  ...options, headers: { authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}`,
    'content-type': 'application/json', ...options.headers },
});
const action = (name, user, body) => request(name, user, { method: 'POST', body: JSON.stringify(body) });

test('account export includes base64 image bytes, empty images and null content without foreign images', async () => {
  assert.equal((await request('getCurrentUser()', 'exporter')).status, 200);
  const imageId = cds.utils.uuid(), emptyId = cds.utils.uuid(), nullId = cds.utils.uuid();
  await INSERT.into('hwb.db.Attachments_local').entries([
    { ID: imageId, createdBy: 'exporter', content: Buffer.from('export-image'), mimeType: 'image/png' },
    { ID: emptyId, createdBy: 'exporter', content: Buffer.alloc(0), mimeType: 'image/png' },
    { ID: nullId, createdBy: 'exporter', mimeType: 'image/png' },
    { ID: cds.utils.uuid(), createdBy: 'other', content: Buffer.from('foreign-image'), mimeType: 'image/png' },
  ]);
  const response = await action('exportMyData', 'exporter', {});
  assert.equal(response.status, 200);
  const exported = JSON.parse((await response.json()).value);
  assert.equal(exported.Attachments_local.length, 3);
  assert.equal(Buffer.from(exported.Attachments_local.find(a => a.ID === imageId).content, 'base64').toString(), 'export-image');
  assert.equal(exported.Attachments_local.find(a => a.ID === emptyId).content, '');
  assert.equal(exported.Attachments_local.find(a => a.ID === nullId).content, null);
});

test('twenty repeatedly failing deletions do not starve a later healthy deletion', async () => {
  const { subjectHash, processAccountDeletions } = require('../srv/account-privacy');
  const entries = Array.from({ length: 21 }, (_, i) => ({ subjectHash: subjectHash(`fairness|${i}`),
    pendingSubject: `fairness|${i}`, requestedAt: '2000-01-01T00:00:00Z' }));
  await INSERT.into('hwb.db.AccountDeletions').entries(entries);
  // Choose the last entry in the worker's deterministic ordering as the healthy one.
  const ordered = await SELECT.from('hwb.db.AccountDeletions').orderBy('subjectHash');
  const healthy = ordered.at(-1).pendingSubject;
  const seen = [];
  const provider = async id => { seen.push(id); if (id !== healthy) throw new Error('persistent failure'); };
  try {
    const first = await processAccountDeletions(provider);
    assert.equal(first.failed, 20);
    assert.equal(seen.includes(healthy), false);
    const second = await processAccountDeletions(provider);
    assert.equal(second.processed, 1);
    assert.equal(second.remaining, 20);
    assert.equal(seen.includes(healthy), true);
    const completed = await SELECT.one.from('hwb.db.AccountDeletions').where({ subjectHash: subjectHash(healthy) });
    assert.equal(completed.pendingSubject, null);
    assert.ok(completed.lastAttemptAt);
    const timestamps = await SELECT.from('hwb.db.AccountDeletions').columns('lastAttemptAt');
    assert.ok(timestamps.every(row => row.lastAttemptAt));
  } finally {
    await DELETE.from('hwb.db.AccountDeletions').where({ subjectHash: { in: entries.map(e => e.subjectHash) } });
  }
});

async function imageFixture(owner) {
  assert.equal((await request('getCurrentUser()', owner)).status, 200);
  const ID = cds.utils.uuid();
  await INSERT.into('hwb.db.Attachments_local').entries({ ID, createdBy: owner,
    content: Buffer.from('cached-photo'), mimeType: 'image/png' });
  const path = `Attachments(${ID})/content`;
  const first = await request(path);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), 'cached-photo');
  return { ID, path };
}

test('moderation makes a cached image unavailable immediately after commit', async () => {
  const { ID, path } = await imageFixture('offender');
  const reportId = cds.utils.uuid();
  await INSERT.into('hwb.db.ContentReports').entries({ ID: reportId, createdBy: 'viewer',
    targetUser: 'offender', reason: 'Test moderation' });
  const response = await action('moderateReportedUser', 'admin', { reportId });
  assert.equal(response.status, 200, await response.text());
  assert.equal(await SELECT.one.from('hwb.db.Attachments_local').where({ ID }), undefined);
  assert.equal((await request(path)).status, 404);
});

test('account deletion makes an image cached by another user unavailable', async () => {
  const { ID, path } = await imageFixture('deleting');
  const response = await action('deleteMyAccount', 'deleting', { confirmation: 'DELETE' });
  assert.equal(response.status, 200, await response.text());
  assert.equal(await SELECT.one.from('hwb.db.Attachments_local').where({ ID }), undefined);
  assert.equal((await request(path)).status, 404);
});

test('a database deletion on another instance also invalidates a cached media response', async () => {
  const { ID, path } = await imageFixture('viewer');
  // Bypass local service hooks just as deletion on another process would.
  await DELETE.from('hwb.db.Attachments_local').where({ ID });
  assert.equal((await request(path)).status, 404);
});
