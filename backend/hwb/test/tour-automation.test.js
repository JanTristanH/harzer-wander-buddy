const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  findRoutes,
  selectRoutes,
  validateParameters,
  toTourResult,
} = require('../srv/tour-automation');

const params = {
  startId: 'p',
  maxDuration: 100,
  maxDistance: 1000,
  maxDepth: 8,
  minStampCount: 1,
  allowDriveInRoute: false,
  groupMode: 'missing_any',
  latitudeStart: '51.8',
  longitudeStart: '10.6',
};
const edge = (ID, fromPoi, toPoi, durationSeconds = 10, extra = {}) => ({
  ID,
  fromPoi,
  toPoi,
  durationSeconds,
  distanceMeters: 100,
  travelMode: 'walk',
  toPoiType: toPoi === 'p' || toPoi === 'q' ? 'parking' : 'stamp',
  ...extra,
});
const graph = [
  edge('1', 'p', 'a'),
  edge('2', 'a', 'b'),
  edge('3', 'b', 'p'),
  edge('4', 'p', 'c'),
  edge('5', 'c', 'p'),
];
const visits = [
  { stamp_ID: 'a', createdBy: 'alice' },
  { stamp_ID: 'a', createdBy: 'alice' }, // Repeat visits count once.
  { stamp_ID: 'b', createdBy: 'bob' },
];
const calculate = (overrides = {}, edges = graph, stampings = visits) =>
  findRoutes(
    { ...params, ...overrides },
    edges,
    stampings,
    ['alice', 'bob'],
    'alice'
  ).results;

test('group modes change the route ranking, not just displayed group statistics', () => {
  const any = calculate();
  assert.deepEqual(any[0].stampIds.sort(), ['a', 'b']);
  assert.equal(any[0].matchingStampCount, 2);
  assert.equal(any[0].newStampCountForUser, 1);
  assert.equal(any[0].stampCount, 2);
  assert.equal(any[0].AverageGroupStampings, 1);
  const all = calculate({ groupMode: 'missing_all' });
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].stampIds, ['c']);
  assert.equal(all[0].matchingStampCount, 1);
});

test('duration includes the return leg and accepts the exact budget', () => {
  assert.equal(calculate({ maxDuration: 19 }).length, 0);
  assert.equal(calculate({ maxDuration: 20 }).length, 1);
  assert.equal(calculate({ maxDuration: 20 })[0].duration, 20);
  assert.equal(calculate({ maxDistance: 199 }).length, 0);
  assert.equal(calculate({ maxDistance: 200 }).length, 1);
  assert.equal(calculate({ minStampCount: 2 }).length, 1);
  assert.equal(calculate({ minStampCount: 3 }).length, 0);
});

test('out-and-back paths can revisit a transit stamp without counting it twice', () => {
  const edges = [
    edge('1', 'p', 'a'),
    edge('2', 'a', 'b'),
    edge('3', 'b', 'a'),
    edge('4', 'a', 'p'),
  ];
  const routes = calculate({}, edges, []);
  assert.equal(routes[0].id, '1;2;3;4');
  assert.equal(routes[0].stampCount, 2);
  assert.equal(routes[0].duration, 40);
  assert.equal(calculate({ maxDepth: 3 }, edges, [])[0].stampCount, 1);
});

test('driving requires the car, respects time, and excludes driving distance', () => {
  const edges = [
    edge('1', 'p', 'a'),
    edge('2', 'a', 'p'),
    edge('3', 'p', 'q', 5, { travelMode: 'drive', distanceMeters: 5000 }),
    edge('4', 'q', 'b'),
    edge('5', 'b', 'q'),
    edge('6', 'a', 'q', 1, { travelMode: 'drive' }), // Car is still at p.
  ];
  assert.equal(calculate({}, edges, [])[0].stampCount, 1);
  const routes = calculate({ allowDriveInRoute: true }, edges, []);
  assert.equal(routes[0].stampCount, 2);
  assert.equal(routes[0].duration, 45);
  assert.equal(routes[0].distance, 400);
  assert.ok(
    routes.every((route) => !route.path.some((item) => item.ID === '6'))
  );
  assert.equal(
    calculate({ allowDriveInRoute: true, maxDuration: 44 }, edges, [])[0]
      .stampCount,
    1
  );
});

test('global selection deduplicates stamp sets across parking spots and caps at five', () => {
  const results = Array.from({ length: 8 }, (_, n) => ({
    id: String(n),
    stampIds: [String(n)],
    matchingStampCount: n,
    duration: 100 - n,
    distance: 100,
  }));
  const selected = selectRoutes([
    ...results,
    { ...results[7], id: 'faster', duration: 1 },
  ]);
  assert.equal(selected.length, 5);
  assert.equal(selected[0].id, 'faster');
  assert.equal(new Set(selected.map((item) => item.stampIds.join())).size, 5);
});

test('no missing stamps, disconnected graphs and invalid edges yield no routes', () => {
  assert.deepEqual(calculate({}, [], []), []);
  assert.deepEqual(calculate({}, [edge('1', 'p', 'a')], []), []);
  assert.deepEqual(
    calculate({}, [edge('1', 'p', 'a', -10), edge('2', 'a', 'p')], []),
    []
  );
  const done = ['a', 'b', 'c'].flatMap((stamp_ID) =>
    ['alice', 'bob'].map((createdBy) => ({ stamp_ID, createdBy }))
  );
  assert.deepEqual(calculate({}, graph, done), []);
});

test('result uses the same ranked travelTime links as Tours, including geometry', () => {
  const [route] = calculate();
  const result = toTourResult(
    route,
    new Map([['1', { positionString: '10;51;0;' }]])
  );
  assert.equal(result.idListTravelTimes, route.id);
  assert.equal(result.path[0].travelTime_ID, '1');
  assert.equal(result.path[0].rank, 512);
  assert.equal(result.path[0].travelTime.fromPoi, 'p');
  assert.equal(result.path[0].travelTime.durationSeconds, 10);
  assert.equal(result.path[0].travelTime.positionString, '10;51;0;');
  assert.ok(!('stampIds' in result));
});

test('validates budgets, coordinates, modes and safe defaults without mutating input', () => {
  const minimal = {
    maxDuration: 7200,
    latitudeStart: '0',
    longitudeStart: '0',
  };
  assert.equal(validateParameters(minimal).groupMode, 'missing_any');
  assert.equal(minimal.groupMode, undefined);
  for (const invalid of [
    { maxDuration: 0 },
    { maxDuration: 86401 },
    { maxDepth: 100 },
    { maxDistance: -1 },
    { minStampCount: 0 },
    { latitudeStart: '' },
    { latitudeStart: '91' },
    { longitudeStart: '181' },
    { longitudeStart: 'NaN' },
    { groupMode: 'unknown' },
    { maxDepth: 2.5 },
    { allowDriveInRoute: 'true' },
  ])
    assert.throws(() => validateParameters({ ...params, ...invalid }));
});

test('dense graphs have a bounded search and explicitly report partial optimization', () => {
  const nodes = ['p', ...Array.from({ length: 8 }, (_, n) => `stamp-${n}`)];
  const edges = nodes.flatMap((from) =>
    nodes
      .filter((to) => to !== from)
      .map((to) => edge(`${from}-${to}`, from, to, 1, { distanceMeters: 1 }))
  );
  const result = findRoutes(
    { ...params, maxDepth: 16 },
    edges,
    [],
    ['alice'],
    'alice'
  );
  assert.equal(result.searchLimited, true);
  assert.equal(result.results.length, 5);
  assert.ok(
    result.results.every((route) => route.duration <= params.maxDuration)
  );
});
