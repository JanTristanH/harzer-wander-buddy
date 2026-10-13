const assert = require('node:assert/strict');
const { before, test } = require('node:test');

const cds = require('@sap/cds/lib');

cds.env.requires.auth = {
  kind: 'mocked',
  users: {
    alice: {
      password: 'pass',
      roles: ['authenticated-user'],
    },
    bob: {
      password: 'pass',
      roles: ['authenticated-user'],
    },
    charlie: {
      password: 'pass',
      roles: ['authenticated-user'],
    },
    mallory: {
      password: 'pass',
      roles: ['authenticated-user'],
    },
  },
};

const server = cds.test('serve', 'all', '--in-memory');

const REPEAT_STAMP_ID = '11111111-1111-4111-8111-111111111111';
const UNAUTHORIZED_STAMP_ID = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_STAMP_ID = '33333333-3333-4333-8333-333333333333';

const ExternalUsers = 'hwb.db.ExternalUsers';
const Friendships = 'hwb.db.Friendships';
const Stampboxes = 'hwb.db.Stampboxes';
const Stampings = 'hwb.db.Stampings';
let db;

function authorizationFor(userId) {
  return `Basic ${Buffer.from(`${userId}:pass`).toString('base64')}`;
}

async function postGroupStamp({
  stampId,
  groupUserIds,
  includeCurrentUser,
  userId = 'alice',
}) {
  return fetch(`${server.url}/odata/v4/api/stampForGroup`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: authorizationFor(userId),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sStampId: stampId,
      sGroupUserIds: groupUserIds,
      bStampForUser: includeCurrentUser,
    }),
  });
}

async function readStampings(stampId) {
  return db.run(
    SELECT
      .from(Stampings)
      .where({ stamp_ID: stampId })
      .orderBy('createdAt asc')
  );
}

before(async () => {
  await server;
  db = await cds.connect.to('db');

  await db.run(INSERT.into(ExternalUsers).entries([
    { ID: 'alice', name: 'Alice' },
    { ID: 'bob', name: 'Bob' },
    { ID: 'charlie', name: 'Charlie' },
    { ID: 'mallory', name: 'Mallory' },
  ]));
  await db.run(INSERT.into(Stampboxes).entries([
    { ID: REPEAT_STAMP_ID, number: '1', name: 'Repeat stamp' },
    { ID: UNAUTHORIZED_STAMP_ID, number: '2', name: 'Authorization stamp' },
  ]));
  await db.run(INSERT.into(Friendships).entries([
    {
      ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      fromUser_ID: 'bob',
      toUser_ID: 'alice',
      status: 'accepted',
      isAllowedToStampForFriend: true,
      createdBy: 'bob',
    },
    {
      ID: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fromUser_ID: 'charlie',
      toUser_ID: 'alice',
      status: 'accepted',
      isAllowedToStampForFriend: false,
      createdBy: 'charlie',
    },
    {
      ID: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      fromUser_ID: 'mallory',
      toUser_ID: 'alice',
      status: 'pending',
      isAllowedToStampForFriend: true,
      createdBy: 'mallory',
    },
  ]));
});

test('group stamping creates one visit per unique target and remains repeatable', async () => {
  const firstResponse = await postGroupStamp({
    stampId: REPEAT_STAMP_ID,
    groupUserIds: ' bob, bob, , ',
    includeCurrentUser: true,
  });
  const firstBody = await firstResponse.json();

  assert.equal(firstResponse.status, 200, JSON.stringify(firstBody));
  assert.equal(firstBody.value, 'ok');

  const firstStampings = await readStampings(REPEAT_STAMP_ID);
  assert.equal(firstStampings.length, 2);
  assert.deepEqual(
    firstStampings.map(stamping => stamping.createdBy).sort(),
    ['alice', 'bob']
  );

  const friendReadUrl = `${server.url}/odata/v4/api/Stampboxes`
    + '?$select=ID,hasVisited,totalGroupStampings,stampedUserIds'
    + `&$filter=${encodeURIComponent(`ID eq ${REPEAT_STAMP_ID}`)}`;
  const friendReadResponse = await fetch(friendReadUrl, {
    headers: {
      accept: 'application/json',
      authorization: authorizationFor('bob'),
    },
  });
  const friendReadBody = await friendReadResponse.json();

  assert.equal(friendReadResponse.status, 200, JSON.stringify(friendReadBody));
  assert.equal(friendReadBody.value.length, 1);
  assert.equal(friendReadBody.value[0].hasVisited, true);
  assert.equal(friendReadBody.value[0].totalGroupStampings, 1);

  const secondResponse = await postGroupStamp({
    stampId: REPEAT_STAMP_ID,
    groupUserIds: 'bob',
    includeCurrentUser: true,
  });
  const secondBody = await secondResponse.json();

  assert.equal(secondResponse.status, 200, JSON.stringify(secondBody));

  const repeatedStampings = await readStampings(REPEAT_STAMP_ID);
  assert.equal(repeatedStampings.length, 4);
  assert.equal(repeatedStampings.filter(stamping => stamping.createdBy === 'alice').length, 2);
  assert.equal(repeatedStampings.filter(stamping => stamping.createdBy === 'bob').length, 2);
  assert.equal(new Set(repeatedStampings.map(stamping => stamping.ID)).size, 4);

  const selfOnlyResponse = await postGroupStamp({
    stampId: REPEAT_STAMP_ID,
    groupUserIds: '',
    includeCurrentUser: true,
  });
  const selfOnlyBody = await selfOnlyResponse.json();

  assert.equal(selfOnlyResponse.status, 200, JSON.stringify(selfOnlyBody));

  const selfOnlyStampings = await readStampings(REPEAT_STAMP_ID);
  assert.equal(selfOnlyStampings.length, 5);
  assert.equal(selfOnlyStampings.filter(stamping => stamping.createdBy === 'alice').length, 3);
  assert.equal(selfOnlyStampings.filter(stamping => stamping.createdBy === 'bob').length, 2);
});

test('an unauthorized requested friend rejects the whole request without partial writes', async () => {
  const beforeStampings = await readStampings(UNAUTHORIZED_STAMP_ID);
  assert.equal(beforeStampings.length, 0);

  const response = await postGroupStamp({
    stampId: UNAUTHORIZED_STAMP_ID,
    groupUserIds: 'bob, charlie, mallory',
    includeCurrentUser: true,
  });
  const body = await response.json();

  assert.equal(response.status, 403, JSON.stringify(body));
  assert.match(body.error.message, /not allowed/i);

  const afterStampings = await readStampings(UNAUTHORIZED_STAMP_ID);
  assert.equal(afterStampings.length, 0);
});

test('an unknown stamp is rejected before any visits are written', async () => {
  const response = await postGroupStamp({
    stampId: UNKNOWN_STAMP_ID,
    groupUserIds: 'bob',
    includeCurrentUser: true,
  });
  const body = await response.json();

  assert.equal(response.status, 404, JSON.stringify(body));
  assert.match(body.error.message, /does not exist/i);

  const stampings = await readStampings(UNKNOWN_STAMP_ID);
  assert.equal(stampings.length, 0);
});
