const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const cds = require('@sap/cds/lib');

cds.env.requires.auth = {
  kind: 'mocked',
  users: { alice: { password: 'pass', roles: ['authenticated-user'] } },
};
const server = cds.test('serve', 'all', '--in-memory');

test('successive planning requests see inserted, updated and deleted travel times', async () => {
  await server;
  const db = await cds.connect.to('db');
  const { ParkingSpots, Stampboxes, TravelTimes, ExternalUsers } = db.entities('hwb.db');
  const parking = randomUUID();
  const stamp1 = randomUUID();
  const stamp2 = randomUUID();
  await db.run(INSERT.into(ExternalUsers).entries({ ID: 'alice', name: 'Alice' }));
  await db.run(INSERT.into(ParkingSpots).entries({ ID: parking, name: 'Start', latitude: 51.8, longitude: 10.6 }));
  await db.run(INSERT.into(Stampboxes).entries([
    { ID: stamp1, name: 'Stamp 1', number: '1' },
    { ID: stamp2, name: 'Stamp 2', number: '2' },
  ]));

  function roundTrip(stamp) {
    return [[parking, stamp], [stamp, parking]].map(([fromPoi, toPoi]) => ({
      ID: randomUUID(), fromPoi, toPoi, durationSeconds: 60, distanceMeters: 100,
      travelMode: 'walk', positionString: '10.6;51.8;0;',
    }));
  }

  async function plan() {
    const query = "maxDepth=2,maxDuration=1000,maxDistance=2000,minStampCount=1,allowDriveInRoute=false,latitudeStart='51.8',longitudeStart='10.6'";
    const response = await fetch(`${server.url}/odata/v4/api/calculateHikingRoute(${query})`, {
      headers: { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body.results;
  }

  const first = roundTrip(stamp1);
  await db.run(INSERT.into(TravelTimes).entries(first));
  assert.deepEqual((await plan()).map(r => Number(r.distance)), [200]);

  const second = roundTrip(stamp2);
  await db.run(INSERT.into(TravelTimes).entries(second));
  assert.equal((await plan()).length, 2, 'new routes must appear without restarting the backend');

  await db.run(UPDATE(TravelTimes).set({ distanceMeters: 350 }).where({ ID: first[0].ID }));
  assert.deepEqual((await plan()).map(r => Number(r.distance)).sort((a, b) => a - b), [200, 450]);

  await db.run(DELETE.from(TravelTimes).where({ ID: { in: second.map(e => e.ID) } }));
  const remaining = await plan();
  assert.equal(remaining.length, 1, 'deleted routes must disappear without restarting the backend');
  assert.equal(Number(remaining[0].distance), 450);
  assert.ok(remaining[0].path.every(p => first.some(e => e.ID === p.travelTime_ID)));
});
