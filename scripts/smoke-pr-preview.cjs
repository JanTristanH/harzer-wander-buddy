// Checks the deployed commit, static SPA route and a real authenticated DB read.
const assert = require('node:assert/strict');
const { users } = require('../backend/hwb/package.json').cds.requires.auth['[dev-basic]'];
async function main() {
  const url = process.env.PREVIEW_URL;
  assert.ok(url, 'PREVIEW_URL is required');
  const metadata = await fetch(`${url}/app/rnweb/preview.json`);
  assert.equal(metadata.status, 200);
  const version = await metadata.json();
  assert.equal(version.sha, process.env.PREVIEW_SHA);
  assert.equal(version.pr, process.env.PREVIEW_PR);
  const web = await fetch(`${url}/app/rnweb/login`, { headers: { Accept: 'text/html' } });
  assert.equal(web.status, 200);
  assert.match(await web.text(), /<!DOCTYPE html>/i);
  const endpoint = `${url}/odata/v4/api/getCurrentUser()`;
  assert.equal((await fetch(endpoint)).status, 401);
  for (const [id, isAdmin] of [['user1@hwb.de', false], ['admin@hwb.de', true]]) {
    const headers = { Authorization: `Basic ${Buffer.from(`${id}:${users[id].password}`).toString('base64')}` };
    const profile = await fetch(endpoint, { headers });
    assert.equal(profile.status, 200, id);
    const currentUser = await profile.json();
    assert.equal(currentUser.ID, id);
    assert.equal(JSON.stringify(currentUser.roles).includes('admin'), isAdmin, id);
    const adminResponse = await fetch(`${url}/odata/v4/api/getMissingTravelTimesCount(n=1)`, { headers });
    assert.equal(adminResponse.status, isAdmin ? 200 : 403, id);
  }
  const stamps = await fetch(`${url}/odata/v4/public/Stampboxes?$top=3`);
  assert.equal(stamps.status, 200);
  assert.equal((await stamps.json()).value.length, 3);
  console.log('Preview smoke check passed: matching commit, web route, user/admin authentication, authorization and seeded SQLite.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
