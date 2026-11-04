const assert = require('node:assert/strict');
const { test } = require('node:test');
const cds = require('@sap/cds/lib');
const { calculateHikingRoutes, addPositionStrings } = require('../srv/routingManager');

function edge(fromPoi, toPoi, options = {}) {
  return {
    ID: `${fromPoi}-${toPoi}`,
    fromPoi,
    toPoi,
    toPoiType: toPoi.startsWith('s') ? 'stamp' : 'parking',
    travelMode: 'walk',
    distanceMeters: '100',
    durationSeconds: '60',
    name: toPoi,
    ...options,
  };
}

function params(overrides = {}) {
  return {
    startId: 'p0', maxDepth: 8, maxDuration: 1000,
    maxDistance: 1000, minStampCount: 1, allowDriveInRoute: false,
    ...overrides,
  };
}

function mockPositions(t, edges) {
  return t.mock.method(cds, 'run', async () => edges.map(e => ({
    ID: e.ID, positionString: `geometry:${e.ID}`,
  })));
}

test('returns a closed directed walk with totals, ordered geometry and route ID', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 'p0')];
  const query = mockPositions(t, edges);
  const routes = await calculateHikingRoutes(params(), edges, []);
  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(routes, [{
    stampCount: 1, distance: 200, duration: 120, id: 'p0-s1;s1-p0',
    path: edges.map((e, order) => ({
      poi: e.toPoi, id: e.ID, name: e.name, toPoiType: e.toPoiType,
      travelMode: e.travelMode, duration: e.durationSeconds, distance: e.distanceMeters,
      positionString: `geometry:${e.ID}`, order,
    })),
  }]);
});

test('does not invent reverse edges or revisit stamps in cycles', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 's2'), edge('s2', 's1')];
  const query = mockPositions(t, edges);
  assert.deepEqual(await calculateHikingRoutes(params(), edges, []), []);
  assert.equal(query.mock.callCount(), 0);
});

for (const [limit, exact, tooSmall] of [
  ['maxDistance', 200, 199], ['maxDuration', 120, 119], ['maxDepth', 2, 1],
]) {
  test(`enforces ${limit}, allowing its exact boundary`, async t => {
    const edges = [edge('p0', 's1'), edge('s1', 'p0')];
    mockPositions(t, edges);
    assert.equal((await calculateHikingRoutes(params({ [limit]: exact }), edges, [])).length, 1);
    assert.deepEqual(await calculateHikingRoutes(params({ [limit]: tooSmall }), edges, []), []);
  });
}

test('counts only uncollected stamps and enforces the minimum', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 's2'), edge('s2', 'p0')];
  mockPositions(t, edges);
  const routes = await calculateHikingRoutes(params(), edges, ['s1']);
  assert.equal(routes[0].stampCount, 1);
  assert.deepEqual(await calculateHikingRoutes(params({ minStampCount: 2 }), edges, ['s1']), []);
});

test('sorts by new stamps then walking distance, deduplicates stamp sets and limits to five', async t => {
  const edges = [];
  for (let i = 7; i >= 1; i--) {
    edges.push(edge('p0', `s${i}`, { distanceMeters: String(i * 100) }), edge(`s${i}`, 'p0'));
  }
  // Same stamp set as the direct s1 walk, but with a longer parking detour.
  edges.push(edge('p0', 'p1'), edge('p1', 's1'));
  // More new stamps must rank first, even with a longer walk.
  edges.push(edge('s6', 's7'));
  mockPositions(t, edges);
  const routes = await calculateHikingRoutes(params({ maxDistance: 2000 }), edges, []);
  assert.equal(routes.length, 5);
  assert.deepEqual(routes.map(r => r.stampCount), [2, 1, 1, 1, 1]);
  assert.deepEqual(routes.slice(1).map(r => r.distance), [200, 300, 400, 500]);
  assert.equal(routes[1].id, 'p0-s1;s1-p0');
});

test('excludes all driving edges when driving is disabled', async t => {
  const edges = [edge('p0', 'p1', { travelMode: 'drive' }), edge('p1', 's1'), edge('s1', 'p1')];
  mockPositions(t, edges);
  assert.deepEqual(await calculateHikingRoutes(params(), edges, []), []);
});

test('sorts by distance even when every stamp has already been collected', async t => {
  const edges = [edge('p0', 's1', { distanceMeters: '500' }), edge('s1', 'p0'),
    edge('p0', 's2'), edge('s2', 'p0')];
  mockPositions(t, edges);
  const routes = await calculateHikingRoutes(params({ minStampCount: 0 }), edges, ['s1', 's2']);
  assert.deepEqual(routes.map(r => r.distance), [200, 600]);
  assert.deepEqual(routes.map(r => r.stampCount), [0, 0]);
});

test('evaluates each possible first drive independently of edge order', async t => {
  const edges = [
    edge('p0', 'p1', { travelMode: 'drive' }),
    edge('p0', 'p2', { travelMode: 'drive' }),
    edge('p1', 's1'), edge('s1', 'p1'),
    edge('p2', 's2'), edge('s2', 'p2'),
  ];
  mockPositions(t, edges);
  for (const graph of [edges, [...edges].reverse()]) {
    const routes = await calculateHikingRoutes(params({ allowDriveInRoute: true }), graph, []);
    assert.deepEqual(routes.map(r => r.path[0].poi).sort(), ['p1', 'p2']);
    assert.ok(routes.every(r => r.distance === 200 && r.duration === 180));
  }
});

test('cannot drive away from a parking spot where the car is not parked', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 'p1'),
    edge('p1', 'p2', { travelMode: 'drive' }), edge('p2', 's2'), edge('s2', 'p2')];
  mockPositions(t, edges);
  assert.deepEqual(await calculateHikingRoutes(params({ allowDriveInRoute: true }), edges, []), []);
});

test('does not mutate calculation parameters or input edges', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 'p0')];
  mockPositions(t, edges);
  const options = params();
  const original = structuredClone({ options, edges });
  await calculateHikingRoutes(options, edges, []);
  assert.deepEqual({ options, edges }, original);
});

test('empty graphs return no routes without querying geometry', async t => {
  const query = mockPositions(t, []);
  assert.deepEqual(await calculateHikingRoutes(params(), [], []), []);
  assert.equal(query.mock.callCount(), 0);
});

test('can drive again after returning to the car and includes drive time in limits', async t => {
  const edges = [edge('p0', 's1'), edge('s1', 'p0'),
    edge('p0', 'p1', { travelMode: 'drive', distanceMeters: '9000' }),
    edge('p1', 's2'), edge('s2', 'p1')];
  mockPositions(t, edges);
  const options = params({ allowDriveInRoute: true, minStampCount: 2, maxDistance: 400 });
  const routes = await calculateHikingRoutes(options, edges, []);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].distance, 400);
  assert.equal(routes[0].duration, 300);
  assert.deepEqual(await calculateHikingRoutes({ ...options, maxDuration: 299 }, edges, []), []);
});

test('geometry lookup uses unique bound IDs and accepts both database field casings', async t => {
  const ids = ["edge'1", 'edge2'];
  const query = t.mock.method(cds, 'run', async () => [
    { ID: ids[0], positionString: 'first' },
    { id: ids[1], positionstring: 'second' },
  ]);
  const routes = await addPositionStrings([
    { path: [{ id: ids[0] }, { id: ids[1] }, { id: ids[0] }] },
  ]);
  assert.deepEqual(routes[0].path.map(p => p.positionString), ['first', 'second', 'first']);
  assert.deepEqual(routes[0].path.map(p => p.order), [0, 1, 2]);
  const where = query.mock.calls[0].arguments[0].SELECT.where;
  assert.deepEqual(where, [
    { ref: ['ID'] }, 'in', { list: ids.map(val => ({ val })) },
  ]);
});

test('geometry lookup without path IDs does not query the database', async t => {
  const query = mockPositions(t, []);
  assert.deepEqual(await addPositionStrings([]), []);
  assert.deepEqual(await addPositionStrings([{ path: [] }]), []);
  assert.equal(query.mock.callCount(), 0);
});

test('database errors reject both geometry lookup and route calculation', async t => {
  const failure = new Error('Geometry database unavailable');
  t.mock.method(cds, 'run', async () => { throw failure; });
  await assert.rejects(addPositionStrings([{ path: [{ id: 'edge1' }] }]), error => error === failure);
  await assert.rejects(
    calculateHikingRoutes(params(), [edge('p0', 's1'), edge('s1', 'p0')], []),
    error => error === failure,
  );
});
