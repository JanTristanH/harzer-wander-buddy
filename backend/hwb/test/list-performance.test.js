const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: { alice: { password: 'pass', roles: ['authenticated-user'] } } };
const server = cds.test('serve', 'all', '--in-memory');
const headers = { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}` };

test('batched tour enrichment retains repeat visits, missing users, empty tours and page counts', async () => {
  const db = await cds.connect.to('db');
  const [first, second, empty, edge, tour] = Array.from({ length: 5 }, randomUUID);
  await db.run(INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'alice', name: 'Alice' }));
  await db.run(INSERT.into('hwb.db.Stampboxes').entries([
    { ID: first, name: 'First', validFrom: '2020-01-01T00:00:00Z', validTo: '2099-01-01T00:00:00Z' },
    { ID: second, name: 'Second', validFrom: '2020-01-01T00:00:00Z', validTo: '2099-01-01T00:00:00Z' },
  ]));
  await db.run(INSERT.into('hwb.db.Tours').entries([{ ID: tour, createdBy: 'alice' }, { ID: empty, createdBy: 'alice' }]));
  await db.run(INSERT.into('hwb.db.TravelTimes').entries({ ID: edge, fromPoi: first, toPoi: second, positionString: 'large geometry' }));
  await db.run(INSERT.into('hwb.db.Tour2TravelTime').entries({ tour_ID: tour, travelTime_ID: edge, rank: 1 }));
  await db.run(INSERT.into('hwb.db.Stampings').entries([
    { ID: randomUUID(), stamp_ID: first, createdBy: 'alice' },
    { ID: randomUUID(), stamp_ID: first, createdBy: 'alice' },
  ]));
  const read = async path => {
    const res = await fetch(`${server.url}/odata/v4/api/${path}`, { headers });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    return body;
  };
  const tours = await read('Tours?$count=true');
  assert.equal(tours['@odata.count'], 2);
  assert.equal(tours.value.find(row => row.ID === tour).AverageGroupStampings, 2);
  assert.equal(tours.value.find(row => row.ID === tour).newStampCountForUser, 1);
  assert.equal(tours.value.find(row => row.ID === empty).AverageGroupStampings, 0);
  const filtered = await read(`Tours?$filter=${encodeURIComponent("groupFilterStampings ne 'alice,missing'")}`);
  assert.equal(filtered.value.find(row => row.ID === tour).AverageGroupStampings, 1);
  const progressResponse = await fetch(`${server.url}/odata/v4/api/getUsersProgress`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ sGroupUserIds: 'alice,missing,alice' }),
  });
  const progressBody = await progressResponse.json();
  assert.equal(progressResponse.status, 200, JSON.stringify(progressBody));
  assert.deepEqual(JSON.parse(progressBody.value), [
    { userId: 'alice', visitedCount: 1, completionPercent: 50 },
    { userId: 'missing', visitedCount: 0, completionPercent: 0 },
  ]);
  const boxes = await read('Stampboxes?$count=true&$top=1&$orderby=name');
  assert.equal(boxes['@odata.count'], 2);
  assert.equal(boxes.value[0].totalGroupStampings, 1);
  assert.equal(boxes.value[0].hasVisited, true);
  assert.deepEqual(boxes.value[0].stampedUserIds, ['alice']);
});
