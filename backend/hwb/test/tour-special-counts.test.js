const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const cds = require('@sap/cds/lib');
const { summarizeTourStamps } = require('../srv/tour-stamp-counts');

test('tour counts use unique regular identities, including visits at earlier locations', () => {
  const stamps = [
    { ID: 'r1', number: '1' }, { ID: 'old1', number: '001' }, { ID: 'r2', number: '2' },
    { ID: 's1', number: '9901', stampType: 'special' },
    { ID: 's2', number: '2', stampType: 'special' },
  ];
  const visits = [{ stamp_ID: 'old1', createdBy: 'alice' }, { stamp_ID: 'old1', createdBy: 'alice' },
    { stamp_ID: 's1', createdBy: 'alice' }, { stamp_ID: 's2', createdBy: 'bob' }];
  assert.deepEqual(summarizeTourStamps(stamps, ['r1', 's1', 'r2', 'r1', 's2'], visits, 'alice', ['alice', 'bob']),
    { stampCount: 2, newStampCountForUser: 1, AverageGroupStampings: 0.5 });
  assert.deepEqual(summarizeTourStamps(stamps, ['s1', 's2'], visits, 'alice', ['alice', 'bob']),
    { stampCount: 0, newStampCountForUser: 0, AverageGroupStampings: 0 });
});

cds.env.requires.auth = { kind: 'mocked', users: { alice: { password: 'pass', roles: ['authenticated-user'] } } };
const server = cds.test('serve', 'all', '--in-memory');
const headers = { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}`, 'content-type': 'application/json' };
async function request(endpoint, data) {
  const response = await fetch(`${server.url}/odata/v4/api/${endpoint}`, {
    headers, method: data ? 'POST' : 'GET', body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

test('mixed special/regular tour previews, saves, list reads and planning agree on regular-only counters', async () => {
  const db = await cds.connect.to('db');
  const { Stampboxes, ParkingSpots, Stampings, ExternalUsers, Tours, TravelTimes, Tour2TravelTime } = db.entities('hwb.db');
  const [parking, r1, r2, old1, s1, s2, tour] = Array.from({ length: 7 }, randomUUID);
  await INSERT.into(ExternalUsers).entries([{ ID: 'alice', name: 'Alice' }, { ID: 'bob', name: 'Bob' }]);
  await INSERT.into(ParkingSpots).entries({ ID: parking, name: 'Start', latitude: 51.8, longitude: 10.6 });
  await INSERT.into(Stampboxes).entries([
    { ID: r1, name: 'Regular 1', number: '1' }, { ID: r2, name: 'Regular 2', number: '2' },
    { ID: old1, name: 'Regular 1 old location', number: '001' },
    { ID: s1, name: 'Special', number: '9901', stampType: 'special' },
    { ID: s2, name: 'Special with numeric display label', number: '3', stampType: 'special' },
  ]);
  await INSERT.into(Stampings).entries([
    { ID: randomUUID(), stamp_ID: old1, createdBy: 'alice' },
    { ID: randomUUID(), stamp_ID: s1, createdBy: 'alice' },
    { ID: randomUUID(), stamp_ID: s2, createdBy: 'bob' },
  ]);
  const stops = [parking, s1, r1, s2, r2, old1, parking];
  const legs = stops.slice(1).map((toPoi, i) => ({
    ID: randomUUID(), fromPoi: stops[i], toPoi, travelMode: 'walk', distanceMeters: 100, durationSeconds: 60,
    positionString: '10.6;51.8;0;',
  }));
  await INSERT.into(TravelTimes).entries(legs);
  await INSERT.into(Tours).entries({ ID: tour, name: 'Mixed tour', createdBy: 'alice', stampCount: 99 });
  await INSERT.into(Tour2TravelTime).entries(legs.map((leg, rank) => ({ tour_ID: tour, travelTime_ID: leg.ID, rank })));

  // Correct the response for old persisted counters without silently rewriting the stored tour.
  const read = await request(`Tours(${tour})`);
  assert.equal(read.stampCount, 2);
  assert.equal(read.newStampCountForUser, 1);
  assert.equal((await SELECT.one.from(Tours).where({ ID: tour })).stampCount, 99);
  const grouped = await request(`Tours?$filter=groupFilterStampings ne 'alice,bob'`);
  assert.equal(grouped.value[0].stampCount, 2);
  assert.equal(grouped.value[0].AverageGroupStampings, 0.5);
  const ids = legs.map(leg => leg.ID).join(';');
  const preview = await request(`getTourByIdListTravelTimes(idListTravelTimes='${ids}')`);
  assert.equal(preview.stampCount, 2);
  assert.equal(preview.newStampCountForUser, 1);
  assert.equal(preview.path.length, 6);
  const saved = await request('updateTourByPOIList', { TourID: tour, POIList: stops.join(';') });
  assert.equal(saved.stampCount, 2);
  assert.equal(saved.newStampCountForUser, 1);
  assert.equal(saved.path.length, 6);
  assert.equal((await SELECT.one.from(Tours).where({ ID: tour })).stampCount, 2);

  const query = "maxDepth=6,maxDuration=1000,maxDistance=2000,minStampCount=1,allowDriveInRoute=false,latitudeStart='51.8',longitudeStart='10.6'";
  const planned = await request(`calculateHikingRoute(${query})`);
  assert.equal(planned.results.length, 1);
  assert.equal(planned.results[0].stampCount, 2);
  assert.equal(planned.results[0].newStampCountForUser, 1);
  assert.ok(planned.results[0].path.some(stop => stop.poi === s1));
  assert.equal((await request(`calculateHikingRoute(${query.replace('minStampCount=1', 'minStampCount=2')})`)).results.length, 0);
});
