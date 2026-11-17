// Isolated synthetic benchmark; never connects to a configured production database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
if (process.env.HWB_BENCH_SERVICE) {
  const Module = require('node:module');
  const original = Module._extensions['.js'];
  Module._extensions['.js'] = (module, filename) => {
    if (filename.endsWith('/srv/hwb-service.js')) {
      module._compile(require('node:fs').readFileSync(process.env.HWB_BENCH_SERVICE, 'utf8'), filename);
    } else original(module, filename);
  };
}
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked', users: { alice: { password: 'pass', roles: ['authenticated-user'] } } };
const server = cds.test('serve', 'all', '--in-memory');

test('endpoint benchmark', async () => {
  const db = await cds.connect.to('db');
  const stamps = Array.from({ length: 500 }, (_, i) => ({ ID: randomUUID(), name: `Stamp ${i}`, validFrom: "2020-01-01T00:00:00Z", validTo: "2099-01-01T00:00:00Z" }));
  const tours = Array.from({ length: 100 }, (_, i) => ({ ID: randomUUID(), name: `Tour ${i}`, createdBy: 'alice' }));
  const edges = Array.from({ length: 1000 }, (_, i) => ({ ID: randomUUID(), fromPoi: stamps[i % 500].ID, toPoi: stamps[(i + 1) % 500].ID, positionString: '10;51;0;'.repeat(4096) }));
  await db.run(INSERT.into('hwb.db.ExternalUsers').entries({ ID: 'alice', name: 'Alice' }));
  await db.run(INSERT.into('hwb.db.Stampboxes').entries(stamps));
  await db.run(INSERT.into('hwb.db.Tours').entries(tours));
  await db.run(INSERT.into('hwb.db.TravelTimes').entries(edges));
  await db.run(INSERT.into('hwb.db.Tour2TravelTime').entries(edges.map((edge, i) => ({ tour_ID: tours[Math.floor(i / 10)].ID, travelTime_ID: edge.ID, rank: i % 10 }))));
  await db.run(INSERT.into('hwb.db.Stampings').entries(Array.from({ length: 10000 }, (_, i) => ({ ID: randomUUID(), stamp_ID: stamps[i % 250].ID, createdBy: 'alice' }))));
  let queries = 0;
  db.before('READ', () => { queries++; });
  const report = {};
  for (const endpoint of ['Tours?$top=100', 'Stampboxes?$top=500']) {
    const times = [], heaps = [], counts = [];
    for (let i = 0; i < 13; i++) {
      global.gc?.();
      const heap = process.memoryUsage().heapUsed;
      queries = 0;
      const start = performance.now();
      const response = await fetch(`${server.url}/odata/v4/api/${endpoint}`, { headers: { authorization: `Basic ${Buffer.from('alice:pass').toString('base64')}` } });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.equal(body.value.length, endpoint.startsWith('Tours') ? 100 : 500);
      if (i >= 3) {
        times.push(performance.now() - start);
        heaps.push((process.memoryUsage().heapUsed - heap) / 1024 / 1024);
        counts.push(queries);
      }
    }
    times.sort((a, b) => a - b); heaps.sort((a, b) => a - b);
    report[endpoint] = { medianMs: +times[5].toFixed(2), p95Ms: +times[9].toFixed(2), medianHeapGrowthMiB: +heaps[5].toFixed(2), readQueries: counts[0] };
  }
  console.log('BENCHMARK ' + JSON.stringify(report));
});
