const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const cds = require('@sap/cds/lib');
cds.env.requires.auth = { kind: 'mocked' };
const server = cds.test('serve', 'all', '--in-memory');
const ID = 'a1230000-0000-4000-8000-000000000001';
const metadata = {
  stampType: 'special', catalogKey: 'special-public-contract',
  sourceUrl: 'https://www.harzer-wandernadel.de/sonderstempel/',
  sourceCheckedAt: '2026-11-07', locationStatus: 'verified',
  availability: 'active', identityStatus: 'confirmed',
};
const select = ['ID', 'number', 'stampType', 'catalogKey', 'themeKeys', 'sourceUrl',
  'sourceCheckedAt', 'locationStatus', 'availability', 'identityStatus'].join(',');
before(async () => {
  await server;
  const db = await cds.connect.to('db');
  await db.run(cds.ql.INSERT.into('hwb.db.Stampboxes').entries({
    ID, number: '9900', name: 'Public contract fixture', latitude: 51.8, longitude: 10.6,
    ...metadata,
  }));
});
for (const [name, resource] of [['list', 'Stampboxes'], ['detail', `Stampboxes(${ID})`]]) {
  test(`anonymous ${name} serves all catalog metadata requested by the app`, async () => {
    const response = await fetch(`${server.url}/odata/v4/public/${resource}?$select=${select}`);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const stamp = name === 'list' ? body.value.find(row => row.ID === ID) : body;
    assert.ok(stamp, 'The public query must return the fixture');
    assert.equal(stamp.ID, ID);
    for (const [key, value] of Object.entries(metadata)) assert.equal(stamp[key], value, key);
  });
}
