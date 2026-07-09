const assert = require('node:assert/strict');
const { test } = require('node:test');

const cds = require('@sap/cds/lib');

cds.env.requires.auth = {
  kind: 'mocked',
  users: {
    alice: {
      password: 'pass',
      roles: ['authenticated-user'],
    },
  },
};

const server = cds.test('serve', 'all', '--in-memory');

test('Users search returns isFriend without crashing', async () => {
  const db = await cds.connect.to('db');
  const { ExternalUsers, Friendships } = db.entities('hwb.db');
  const authorization = `Basic ${Buffer.from('alice:pass').toString('base64')}`;

  await INSERT.into(ExternalUsers).entries([
    {
      ID: 'alice',
      name: 'Alice',
    },
    {
      ID: 'matilda',
      name: 'Matilda Test',
      picture: 'https://example.test/matilda.png',
    },
  ]);

  await INSERT.into(Friendships).entries({
    ID: 'friendship-alice-matilda',
    fromUser_ID: 'alice',
    toUser_ID: 'matilda',
    status: 'accepted',
    createdBy: 'alice',
  });

  const filter = "contains(name,'Matilda') or startswith(name,'Matilda')";
  const query = [
    '$select=ID,name,picture,isFriend',
    `$filter=${encodeURIComponent(filter)}`,
    '$top=12',
  ].join('&');

  const response = await fetch(`${server.url}/odata/v4/api/Users?${query}`, {
    headers: {
      accept: 'application/json',
      authorization,
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.value.length, 1);
  assert.deepEqual(body.value[0], {
    ID: 'matilda',
    name: 'Matilda Test',
    picture: 'https://example.test/matilda.png',
    isFriend: true,
  });

  const currentUserResponse = await fetch(
    `${server.url}/odata/v4/api/getCurrentUser()?$select=ID,onboardingCompleted`,
    {
      headers: {
        accept: 'application/json',
        authorization,
      },
    }
  );
  const currentUserBody = await currentUserResponse.json();

  assert.equal(currentUserResponse.status, 200, JSON.stringify(currentUserBody));
  assert.equal(currentUserBody.ID, 'alice');
  assert.equal(currentUserBody.onboardingCompleted, false);

  const patchResponse = await fetch(`${server.url}/odata/v4/api/Users('alice')`, {
    method: 'PATCH',
    headers: {
      accept: 'application/json',
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      onboardingCompleted: true,
    }),
  });
  const patchBody = patchResponse.status === 204 ? null : await patchResponse.json();

  assert.equal(patchResponse.status < 300, true, JSON.stringify(patchBody));

  const updatedCurrentUserResponse = await fetch(
    `${server.url}/odata/v4/api/getCurrentUser()?$select=ID,onboardingCompleted`,
    {
      headers: {
        accept: 'application/json',
        authorization,
      },
    }
  );
  const updatedCurrentUserBody = await updatedCurrentUserResponse.json();

  assert.equal(updatedCurrentUserResponse.status, 200, JSON.stringify(updatedCurrentUserBody));
  assert.equal(updatedCurrentUserBody.ID, 'alice');
  assert.equal(updatedCurrentUserBody.onboardingCompleted, true);
});
