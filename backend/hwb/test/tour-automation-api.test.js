const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const cds = require('@sap/cds/lib');

cds.env.requires.auth = {
  kind: 'mocked',
  users: {
    alice: { password: 'pass', roles: ['authenticated-user'] },
    bob: { password: 'pass', roles: ['authenticated-user'] },
  },
};
const server = cds.test('serve', 'all', '--in-memory');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const p = uuid(1),
  a = uuid(2),
  b = uuid(3),
  c = uuid(4);
let db;

async function request(
  overrides = {},
  { user = 'alice', version = 'v4' } = {}
) {
  const values = {
    maxDepth: 8,
    maxDuration: 3600,
    maxDistance: 10000,
    minStampCount: 1,
    allowDriveInRoute: false,
    latitudeStart: '51.8',
    longitudeStart: '10.6',
    groupMode: 'missing_any',
    groupFilterStampings: ' bob, bob, alice ',
    ...overrides,
  };
  const parameters = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key}=${typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : value}`
    )
    .join(',');
  return fetch(
    `${server.url}/odata/${version}/api/calculateHikingRoute(${encodeURI(parameters)})`,
    {
      headers: {
        authorization: `Basic ${Buffer.from(`${user}:pass`).toString('base64')}`,
        accept: 'application/json',
      },
    }
  );
}

before(async () => {
  await server;
  db = await cds.connect.to('db');
  await INSERT.into('hwb.db.ExternalUsers').entries([
    { ID: 'alice', name: 'Alice' },
    { ID: 'bob', name: 'Bob' },
    { ID: 'stranger', name: 'Stranger' },
  ]);
  await INSERT.into('hwb.db.Friendships').entries({
    ID: uuid(99),
    fromUser_ID: 'alice',
    toUser_ID: 'bob',
    createdBy: 'alice',
    status: 'accepted',
  });
  await INSERT.into('hwb.db.ParkingSpots').entries({
    ID: p,
    name: 'Start',
    latitude: '51.8',
    longitude: '10.6',
  });
  await INSERT.into('hwb.db.Stampboxes').entries([
    { ID: a, number: '1', name: 'A' },
    { ID: b, number: '2', name: 'B' },
    { ID: c, number: '3', name: 'C' },
  ]);
  await INSERT.into('hwb.db.TravelTimes').entries(
    [
      [p, a],
      [a, b],
      [b, p],
      [p, c],
      [c, p],
    ].map(([fromPoi, toPoi], n) => ({
      ID: uuid(10 + n),
      fromPoi,
      toPoi,
      durationSeconds: 600,
      distanceMeters: 500,
      travelMode: 'walk',
      positionString: '10.6;51.8;0;10.61;51.81;0;',
      elevationGain: 20,
      elevationLoss: 10,
    }))
  );
  await INSERT.into('hwb.db.Stampings').entries([
    { ID: uuid(20), stamp_ID: a, createdBy: 'alice' },
    { ID: uuid(21), stamp_ID: a, createdBy: 'alice' },
    { ID: uuid(22), stamp_ID: b, createdBy: 'bob' },
  ]);
});

test('HTTP response preserves nested Tour links, geometry, group counts and global ranking', async () => {
  const response = await request();
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  const route = body.results[0];
  assert.equal(route.stampCount, 2);
  assert.equal(route.matchingStampCount, 2);
  assert.equal(route.newStampCountForUser, 1);
  assert.equal(route.groupSize, 2);
  assert.equal(route.AverageGroupStampings, 1);
  assert.equal(route.totalElevationGain, 60);
  assert.equal(route.id, route.idListTravelTimes);
  assert.ok(route.previewSvg.startsWith('<svg'));
  assert.equal(route.path[0].travelTime_ID, uuid(10));
  assert.equal(route.path[0].rank, 512);
  assert.equal(route.path[0].travelTime.fromPoi, p);
  assert.equal(Number(route.path[0].travelTime.durationSeconds), 600);
  assert.equal(
    route.path[0].travelTime.positionString,
    '10.6;51.8;0;10.61;51.81;0;'
  );
  assert.equal(body.searchLimited, false);
  assert.equal((await SELECT.from('hwb.db.RouteCalculationRequest')).length, 0);
});

test('missing_all selects a different tour and counts no duplicate visits', async () => {
  const response = await request({ groupMode: 'missing_all' });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].matchingStampCount, 1);
  assert.equal(body.results[0].path[0].travelTime.toPoi, c);
});

test('budget and minimum count include return leg; no matches return an empty collection', async () => {
  const response = await request({ maxDuration: 1199 });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).results, []);
  const exact = await request({ maxDuration: 1200 });
  assert.equal((await exact.json()).results.length, 1);
  const minimum = await request({ minStampCount: 3 });
  assert.deepEqual((await minimum.json()).results, []);
});

test('rejects invalid coordinates and budgets before loading or writing request data', async () => {
  for (const invalid of [
    { latitudeStart: '91' },
    { maxDuration: 0 },
    { groupMode: 'unknown' },
    { maxDepth: 100 },
  ]) {
    const response = await request(invalid);
    assert.equal(response.status, 400, JSON.stringify(await response.json()));
  }
  assert.equal((await SELECT.from('hwb.db.RouteCalculationRequest')).length, 0);
});

test('includes current user automatically and rejects non-friends', async () => {
  const response = await request({ groupFilterStampings: 'bob' });
  assert.equal((await response.json()).results[0].groupSize, 2);
  const forbidden = await request({ groupFilterStampings: 'stranger' });
  assert.equal(forbidden.status, 403);
});

test('requests without group parameters retain solo planning defaults', async () => {
  const response = await request({
    groupMode: undefined,
    groupFilterStampings: undefined,
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.results[0].groupSize, 1);
  assert.equal(
    body.results[0].matchingStampCount,
    body.results[0].newStampCountForUser
  );
});

test('a proposal can be saved through the existing Tours API with its ranked path intact', async () => {
  const response = await request();
  const {
    results: [proposal],
  } = await response.json();
  const headers = {
    authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}`,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const saved = await fetch(`${server.url}/odata/v4/api/Tours`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Automatic test tour',
      idListTravelTimes: proposal.idListTravelTimes,
      stampCount: proposal.stampCount,
      duration: Number(proposal.duration),
      distance: Number(proposal.distance),
      totalElevationGain: proposal.totalElevationGain,
      totalElevationLoss: proposal.totalElevationLoss,
    }),
  });
  const tour = await saved.json();
  assert.equal(saved.status, 201, JSON.stringify(tour));
  assert.ok(tour.previewSvg.startsWith('<svg'));
  assert.equal(Number(tour.duration), Number(proposal.duration));
  assert.equal(Number(tour.distance), Number(proposal.distance));
  const links = await SELECT.from('hwb.db.Tour2TravelTime')
    .where({ tour_ID: tour.ID })
    .orderBy('rank');
  assert.deepEqual(
    links.map((link) => link.travelTime_ID),
    proposal.path.map((link) => link.travelTime_ID)
  );
  assert.deepEqual(
    links.map((link) => link.rank),
    proposal.path.map((link) => link.rank)
  );
  assert.equal(
    (await SELECT.from('hwb.db.Tours').where({ ID: tour.ID }))[0].createdBy,
    'alice'
  );
});

test('old tours receive a cached route preview, and editing the POI list regenerates it', async () => {
  const ID = uuid(80);
  await INSERT.into('hwb.db.Tours').entries({
    ID,
    name: 'Old tour',
    idListTravelTimes: [uuid(10), uuid(11), uuid(12)].join(';'),
    createdBy: 'alice',
  });
  const headers = {
    authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}`,
    'content-type': 'application/json',
  };
  const response = await fetch(`${server.url}/odata/v4/api/Tours(${ID})`, {
    headers,
  });
  const tour = await response.json();
  assert.equal(response.status, 200, JSON.stringify(tour));
  assert.ok(tour.previewSvg.startsWith('<svg'));
  assert.equal(
    (await SELECT.one.from('hwb.db.Tours').where({ ID })).previewSvg,
    tour.previewSvg
  );
  const edit = await fetch(`${server.url}/odata/v4/api/updateTourByPOIList`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ TourID: ID, POIList: [p, c, p].join(';') }),
  });
  const editBody = await edit.json();
  assert.equal(edit.status, 200, JSON.stringify(editBody));
  const updated = await SELECT.one.from('hwb.db.Tours').where({ ID });
  assert.ok(updated.previewSvg.startsWith('<svg'));
  assert.equal(updated.idListTravelTimes, [uuid(13), uuid(14)].join(';'));
});

test('a subsequent graph change is visible without restarting the server', async () => {
  await UPDATE('hwb.db.TravelTimes')
    .set({ durationSeconds: 5000 })
    .where({ ID: uuid(13) });
  const response = await request({ groupMode: 'missing_all' });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).results, []);
});
