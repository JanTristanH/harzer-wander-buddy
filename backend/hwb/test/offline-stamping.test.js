const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: { alice: { password: 'pass', roles: ['authenticated-user'] } } };
const server = cds.test('serve', 'all', '--in-memory');
const stampId = '11111111-1111-4111-8111-111111111111';
const visitId = '22222222-2222-4222-8222-222222222222';
const when = '2026-10-18T09:30:00.000Z';
let db;
before(async () => {
  await server; db = await cds.connect.to('db');
  await db.run(INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'alice', name: 'Alice' }));
  await db.run(INSERT.into('hwb.db.Stampboxes').entries({ ID: stampId, number: '1', name: 'Offline test' }));
});
const headers = { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}`, 'content-type': 'application/json' };
async function post(id) {
  return fetch(`${server.url}/odata/v4/api/Stampings`, { method: 'POST', headers,
    body: JSON.stringify({ ID: id, stamp: { ID: stampId }, visitedAt: when }) });
}
test('existing stamping API preserves offline visit IDs and times and rejects a replay as a duplicate', async () => {
  const first = await post(visitId); assert.equal(first.status, 201, await first.text());
  const duplicate = await post(visitId); assert.ok([400, 409].includes(duplicate.status), await duplicate.text());
  const rows = await db.run(SELECT.from('hwb.db.Stampings').where({ ID: visitId }));
  assert.equal(rows.length, 1); assert.equal(rows[0].createdBy, 'alice');
  assert.equal(new Date(rows[0].visitedAt).toISOString(), when);
  const read = await fetch(`${server.url}/odata/v4/api/Stampings(${visitId})`, { headers });
  assert.equal(read.status, 200); const body = await read.json();
  assert.equal(body.ID, visitId); assert.equal(body.stamp_ID, stampId); assert.equal(body.createdBy, 'alice');
});
test('a deliberate second visit to the same stamp has its own stable ID', async () => {
  const response = await post('33333333-3333-4333-8333-333333333333'); assert.equal(response.status, 201, await response.text());
});
