const assert = require('node:assert/strict');
const { test } = require('node:test');
process.env.CDS_ENV = 'dev-basic';
const cds = require('@sap/cds/lib');
const server = cds.test('serve', 'all', '--in-memory');
const headers = {
  Authorization: `Basic ${Buffer.from('user1@hwb.de:user1@hwb.deA').toString('base64')}`,
  'Content-Type': 'application/json',
};
async function request(path, method = 'GET', body) {
  return fetch(`${server.url}/odata/v4/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function read(userId = 'user1@hwb.de') {
  const response = await request(`getBadgeAlbum(userId='${userId}')`);
  assert.equal(response.status, 200);
  return JSON.parse((await response.json()).value);
}
test('authenticated album persists selection, rejects locked options and revokes after deletion', async () => {
  assert.equal((await request('getCurrentUser()')).status, 200);
  const { Stampboxes, Stampings, BadgeProfiles } = cds.entities('hwb.db');
  const stampRows = Array.from({ length: 50 }, (_, i) => ({
    ID: cds.utils.uuid(),
    number: String(i + 1),
    name: `Badge test ${i + 1}`,
  }));
  await INSERT.into(Stampboxes).entries(stampRows);
  const visitRows = stampRows.map((stamp) => ({
    ID: cds.utils.uuid(),
    stamp_ID: stamp.ID,
    createdBy: 'user1@hwb.de',
    visitedAt: '2026-01-01',
  }));
  await INSERT.into(Stampings).entries(visitRows);
  let album = await read();
  assert.equal(album.entries.find((e) => e.id === 'king').unlocked, true);
  assert.equal(
    (
      await request('saveBadgeProfile', 'POST', {
        featured: ['emperor'],
        title: '',
        frame: '',
      })
    ).status,
    400
  );
  assert.equal(
    (
      await request('saveBadgeProfile', 'POST', {
        featured: ['king', 'bronze', 'gold', 'silver'],
        title: '',
        frame: '',
      })
    ).status,
    400
  );
  const selection = {
    featured: ['gold', 'king', 'bronze'],
    title: 'king:1',
    frame: 'silver',
  };
  assert.equal(
    (await request('saveBadgeProfile', 'POST', selection)).status,
    200
  );
  assert.deepEqual((await read()).selection, selection);
  // A different profile shows that owner's choices, never the viewer's choices.
  await INSERT.into(BadgeProfiles).entries({
    userId: 'other-user',
    featured: '[]',
    title: 'wanderer',
    frame: '',
  });
  const other = await read('other-user');
  assert.deepEqual(other.selection, {
    featured: [],
    title: 'wanderer',
    frame: '',
  });
  assert.deepEqual(other.entries, []);
  const deletion = await request(`Stampings(${visitRows[49].ID})`, 'DELETE');
  assert.equal(deletion.status, 204);
  // Re-earn before reading: deleted selection must not silently come back.
  await INSERT.into(Stampings).entries(visitRows[49]);
  album = await read();
  assert.deepEqual(album.selection, {
    featured: ['gold', 'bronze'],
    title: '',
    frame: 'silver',
  });
  assert.equal(album.selectionChanged, true);
  assert.equal(
    (
      await request('saveBadgeProfile', 'POST', {
        featured: [],
        title: '',
        frame: '',
      })
    ).status,
    200
  );
  assert.equal((await read()).selectionChanged, false);
});
