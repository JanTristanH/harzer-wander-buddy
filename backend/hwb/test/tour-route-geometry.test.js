const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const cds = require('@sap/cds/lib');

cds.env.requires.auth = {
  kind: 'mocked', users: { alice: { password: 'pass', roles: ['authenticated-user'] } },
};
const server = cds.test('serve', 'all', '--in-memory');

test('saving a tour returns ordered, expanded geometry for existing legs and repeated stops', async () => {
  await server;
  const db = await cds.connect.to('db');
  const { Tours, Stampboxes, TravelTimes, ExternalUsers } = db.entities('hwb.db');
  const tourId = randomUUID();
  const a = randomUUID();
  const b = randomUUID();
  const positionString = '10.6;51.8;0;10.61;51.81;0;';
  await db.run(INSERT.into(ExternalUsers).entries({ ID: 'alice', name: 'Alice' }));
  await db.run(INSERT.into(Stampboxes).entries([{ ID: a, name: 'A' }, { ID: b, name: 'B' }]));
  await db.run(INSERT.into(Tours).entries({ ID: tourId, name: 'Geometry test', createdBy: 'alice' }));
  const legs = [[a, b], [b, a]].map(([fromPoi, toPoi]) => ({
    ID: randomUUID(), fromPoi, toPoi, positionString, travelMode: 'walk',
    distanceMeters: 100, durationSeconds: 60, elevationGain: 12, elevationLoss: 8,
  }));
  await db.run(INSERT.into(TravelTimes).entries(legs));
  const response = await fetch(`${server.url}/odata/v4/api/updateTourByPOIList`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ TourID: tourId, POIList: `${a};${b};${a}` }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.path.length, 2);
  body.path.forEach((entry, index) => {
    assert.equal(entry.travelTime_ID, legs[index].ID);
    assert.equal(entry.travelTime.positionString, positionString);
    assert.equal(entry.travelTime.fromPoi, legs[index].fromPoi);
    assert.equal(entry.travelTime.toPoi, legs[index].toPoi);
    assert.equal(Number(entry.travelTime.elevationGain), 12);
  });
});
