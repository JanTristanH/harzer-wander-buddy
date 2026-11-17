const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.CDS_ENV = 'dev-basic';
const cds = require('@sap/cds');
cds.env.requires.auth.users.admin = { password: 'pass', roles: ['admin', 'authenticated-user'] };
cds.env.requires.auth.users.offender = { password: 'pass', roles: ['authenticated-user'] };
const server = cds.test('serve', 'all', '--in-memory');
const id = 'user1@hwb.de';
const headers = { authorization: `Basic ${Buffer.from(`${id}:user1@hwb.deA`).toString('base64')}`,
  'content-type': 'application/json' };
const action = (name, body = {}) => fetch(`${server.url}/odata/v4/api/${name}`, {
  method: 'POST', headers, body: JSON.stringify(body)
});

test('privacy routes are public; whole-database export is forbidden to normal users', async () => {
  for (const path of ['impressum', 'datenschutz', 'konto-loeschen', 'nutzungshinweise']) {
    const res = await fetch(`${server.url}/legal/${path}`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Nordfpad Solutions/);
  }
  const content = await (await fetch(`${server.url}/legal/content`)).json();
  assert.equal(content.documents.imprint.text.includes('TMG'), false);
  assert.equal(content.documents.imprint.text.includes('consumers/odr'), false);
  assert.equal((await fetch(`${server.url}/export/csv/ExternalUsers`, { headers })).status, 403);
  assert.equal((await fetch(`${server.url}/odata/v4/api/ContentReports`, { headers })).status, 403);
  assert.equal((await fetch(`${server.url}/odata/v4/api/Users('${id}')`, { method: 'DELETE', headers })).status, 403);
  assert.equal((await fetch(`${server.url}/odata/v4/api/exportMyData`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
});

test('reporting and blocking protect both directions; unblocking does not restore friendship', async () => {
  const db = await cds.connect.to('db');
  const { INSERT, SELECT } = cds.ql;
  await INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'other', name: 'Other' });
  await INSERT.into('hwb.db.Friendships').entries({ ID: cds.utils.uuid(), fromUser_ID: id,
    toUser_ID: 'other', createdBy: id, status: 'accepted', isAllowedToStampForFriend: true });
  assert.equal((await action('reportUser', { targetUser: 'other', reason: 'Problematisches Profilbild' })).status, 200);
  assert.equal((await action('blockUser', { targetUser: 'other' })).status, 200);
  const search = await fetch(`${server.url}/odata/v4/api/Users?$filter=ID%20eq%20%27other%27`, { headers });
  assert.deepEqual((await search.json()).value, []);
  assert.equal((await action('getUsersProgress', { sGroupUserIds: 'other' })).status, 403);
  assert.equal((await fetch(`${server.url}/odata/v4/api/Friendships`, { method: 'POST', headers,
    body: JSON.stringify({ fromUser_ID: 'other', toUser_ID: 'other', status: 'accepted', isAllowedToStampForFriend: true }) })).status >= 400, true);
  assert.equal((await action('moderateReportedUser', { reportId: cds.utils.uuid() })).status, 403);
  await INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'third', name: 'Third' });
  await INSERT.into('hwb.db.Friendships').entries({ ID: cds.utils.uuid(), fromUser_ID: 'other', toUser_ID: 'third', createdBy: 'other', status: 'accepted' });
  const unrelated = await fetch(`${server.url}/odata/v4/api/Friendships?$filter=toUser_ID%20eq%20%27third%27`, { headers });
  assert.deepEqual((await unrelated.json()).value, []);
  assert.deepEqual(await SELECT.from('hwb.db.Friendships').where({ fromUser_ID: id, toUser_ID: 'other' }), []);
  assert.equal((await action('unblockUser', { targetUser: 'other' })).status, 200);
  assert.deepEqual(await SELECT.from('hwb.db.Friendships').where({ fromUser_ID: id, toUser_ID: 'other' }), []);
  const reports = await SELECT.from('hwb.db.ContentReports').where({ createdBy: id });
  assert.equal(reports.length, 1);
});

test('export is subject-scoped; deletion removes owned data and references, prevents login and resurrection', async () => {
  const db = await cds.connect.to('db');
  const { INSERT, SELECT } = cds.ql;
  const stampId = cds.utils.uuid();
  const tourId = cds.utils.uuid();
  const travelId = cds.utils.uuid();
  await INSERT.into('hwb.db.Stampboxes').entries({ ID: stampId, name: 'Test' });
  await INSERT.into('hwb.db.Stampings').entries([
    { ID: cds.utils.uuid(), stamp_ID: stampId, createdBy: id },
    { ID: cds.utils.uuid(), stamp_ID: stampId, createdBy: 'other' }
  ]);
  await INSERT.into('hwb.db.StampNotes').entries({ ID: cds.utils.uuid(), stamp_ID: stampId, createdBy: id, note: 'Private' });
  await INSERT.into('hwb.db.Tours').entries({ ID: tourId, createdBy: id, name: 'Private tour' });
  await INSERT.into('hwb.db.TravelTimes').entries({ ID: travelId });
  await INSERT.into('hwb.db.Tour2TravelTime').entries({ tour_ID: tourId, travelTime_ID: travelId });
  await INSERT.into('hwb.db.Attachments_local').entries({ ID: cds.utils.uuid(), createdBy: id, content: Buffer.from('image'), mimeType: 'image/png' });
  await INSERT.into('hwb.db.RouteCalculationRequest').entries({ ID: cds.utils.uuid(), createdBy: id, latitude: '51', longitude: '10' });
  const friendshipId = cds.utils.uuid();
  await INSERT.into('hwb.db.Friendships').entries({ ID: friendshipId, fromUser_ID: 'other', toUser_ID: id, createdBy: 'other' });
  await INSERT.into('hwb.db.PendingFriendshipRequests').entries({ ID: cds.utils.uuid(), fromUser_ID: 'other', toUser_ID: id, outgoingFriendship_ID: friendshipId });
  const exported = await action('exportMyData');
  assert.equal(exported.status, 200);
  const data = JSON.parse((await exported.json()).value);
  assert.equal(data.profile.ID, id);
  assert.equal(data.Stampings.length, 1);
  assert.equal(data.StampNotes[0].note, 'Private');
  assert.equal((await action('deleteMyAccount', { confirmation: 'no' })).status, 400);
  assert.ok(await SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }));
  const deleted = await action('deleteMyAccount', { confirmation: 'DELETE' });
  assert.equal(deleted.status, 200, await deleted.text());
  assert.equal(await SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }), undefined);
  for (const entity of ['Stampings', 'StampNotes', 'Tours', 'Attachments_local', 'RouteCalculationRequest', 'ContentReports']) {
    assert.deepEqual(await SELECT.from(`hwb.db.${entity}`).where({ createdBy: id }), [], entity);
  }
  assert.deepEqual(await SELECT.from('hwb.db.Tour2TravelTime').where({ tour_ID: tourId }), []);
  assert.deepEqual(await SELECT.from('hwb.db.Friendships').where({ toUser_ID: id }), []);
  assert.deepEqual(await SELECT.from('hwb.db.PendingFriendshipRequests').where({ toUser_ID: id }), []);
  assert.ok(await SELECT.one.from('hwb.db.ExternalUsers').where({ ID: 'other' }));
  assert.equal((await SELECT.from('hwb.db.Stampings').where({ createdBy: 'other' })).length, 1);
  assert.equal((await fetch(`${server.url}/odata/v4/api/getCurrentUser()`, { headers })).status, 401);
  assert.equal(await require('../srv/auth-utils').upsertExternalUser({ sub: id, name: 'Replay' }), false);
});

test('durable external deletion queue survives failures and clears subject only after provider success', async () => {
  const db = await cds.connect.to('db');
  const { SELECT, INSERT } = cds.ql;
  const { subjectHash, processAccountDeletions } = require('../srv/account-privacy');
  const hash = subjectHash('auth0|retry');
  await INSERT.into('hwb.db.AccountDeletions').entries({ subjectHash: hash,
    pendingSubject: 'auth0|retry', requestedAt: new Date().toISOString() });
  const failed = await processAccountDeletions(async () => { throw new Error('provider unavailable'); });
  assert.equal(failed.failed, 1);
  assert.equal(failed.remaining, 1);
  assert.equal((await SELECT.one.from('hwb.db.AccountDeletions').where({ subjectHash: hash })).pendingSubject, 'auth0|retry');
  const succeeded = await processAccountDeletions(async subject => { assert.equal(subject, 'auth0|retry'); });
  assert.equal(succeeded.processed, 1);
  assert.equal(succeeded.failed, 0);
  assert.equal(succeeded.remaining, 0);
  const completed = await SELECT.one.from('hwb.db.AccountDeletions').where({ subjectHash: hash });
  assert.equal(completed.pendingSubject, null);
  assert.ok(completed.completedAt);
});


test('administrator moderation removes exposed content and prevents republication', async () => {
  const { INSERT, SELECT } = cds.ql;
  const reportId = cds.utils.uuid();
  await INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'offender', name: 'Reported name', picture: 'https://example.test/image.png' });
  await INSERT.into('hwb.db.Tours').entries({ ID: cds.utils.uuid(), name: 'Reported tour name', createdBy: 'offender' });
  await INSERT.into('hwb.db.Attachments_local').entries({ ID: cds.utils.uuid(), createdBy: 'offender', content: Buffer.from('image'), mimeType: 'image/png' });
  await INSERT.into('hwb.db.ContentReports').entries({ ID: reportId, targetUser: 'offender', createdBy: 'other', reason: 'Reported image' });
  const adminHeaders = { ...headers, authorization: `Basic ${Buffer.from('admin:pass').toString('base64')}` };
  const result = await fetch(`${server.url}/odata/v4/api/moderateReportedUser`, { method: 'POST',
    headers: adminHeaders, body: JSON.stringify({ reportId }) });
  assert.equal(result.status, 200, await result.text());
  const user = await SELECT.one.from('hwb.db.ExternalUsers').where({ ID: 'offender' });
  assert.equal(user.picture, null);
  assert.equal(user.contentRestricted, true);
  assert.equal(user.name, 'Profil moderiert');
  assert.deepEqual(await SELECT.from('hwb.db.Attachments_local').where({ createdBy: 'offender' }), []);
  const offenderHeaders = { ...headers, authorization: `Basic ${Buffer.from('offender:pass').toString('base64')}` };
  const republish = await fetch(`${server.url}/odata/v4/api/Users('offender')`, { method: 'PATCH',
    headers: offenderHeaders, body: JSON.stringify({ name: 'Republished name' }) });
  assert.equal(republish.status, 403);
});
