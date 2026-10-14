const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.CDS_ENV = 'dev-basic';
const cds = require('@sap/cds/lib');
const server = cds.test('serve', 'all', '--in-memory');
const authorization = (password) => `Basic ${Buffer.from(`user1@hwb.de:${password}`).toString('base64')}`;

test('local Basic profile rejects missing/wrong credentials and provisions a normal user', async () => {
  const url = `${server.url}/odata/v4/api/getCurrentUser()`;
  for (const headers of [{}, { Authorization: authorization('wrong') }, { Authorization: `Basic ${Buffer.from('alice:any').toString('base64')}` }]) {
    const response = await fetch(url, { headers });
    assert.equal(response.status, 401);
  }
  const response = await fetch(url, { headers: { Authorization: authorization('user1@hwb.deA') } });
  assert.equal(response.status, 200);
  const profile = await response.json();
  assert.equal(profile.ID, 'user1@hwb.de');
  assert.ok(JSON.stringify(profile.roles).includes('authenticated-user'));
  assert.ok(!JSON.stringify(profile.roles).includes('admin'));
  const adminResponse = await fetch(`${server.url}/odata/v4/api/getMissingTravelTimesCount(n=1)`, {
    headers: { Authorization: authorization('user1@hwb.deA') },
  });
  assert.equal(adminResponse.status, 403);
  const patchResponse = await fetch(`${server.url}/odata/v4/api/Users('user1@hwb.de')`, {
    method: 'PATCH', headers: { Authorization: authorization('user1@hwb.deA'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboardingCompleted: true }),
  });
  assert.equal(patchResponse.status, 200);
  const cors = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
  } });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  const publicResponse = await fetch(`${server.url}/odata/v4/public/Stampboxes?$top=1`);
  assert.equal(publicResponse.status, 200);
});
