const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyAccessToken, authenticate } = require('../srv/supabase-auth');
const { getRolesFromClaims } = require('../srv/auth-utils');
process.env.SUPABASE_URL = 'https://project.supabase.co';
const sub = 'b0eef491-e107-43c8-91a4-0ee12ee28ca5';
const session_id = 'daf20f93-d8e2-47a8-b548-9d22241a2c61';
test('JWT verifier rejects expiration, foreign issuer/audience, invalid signature, algorithm and anonymous identities', async () => {
  const { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } = await import('jose');
  const pair = await generateKeyPair('ES256');
  const other = await generateKeyPair('ES256');
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test', alg: 'ES256' }] });
  const claims = { sub, session_id, role: 'authenticated', iss: 'https://project.supabase.co/auth/v1', aud: 'authenticated' };
  const sign = (overrides = {}, privateKey = pair.privateKey) => new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg: 'ES256', kid: 'test' }).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  assert.equal((await verifyAccessToken(await sign(), keys)).sub, sub);
  for (const override of [{ iss: 'https://foreign.supabase.co/auth/v1' }, { aud: 'auth0-audience' }, { sub: 'auth0|x' },
    { session_id: undefined }, { role: 'service_role' }, { is_anonymous: true }]) {
    await assert.rejects(verifyAccessToken(await sign(override), keys));
  }
  await assert.rejects(verifyAccessToken(await sign({}, other.privateKey), keys));
  const expired = await new SignJWT(claims).setProtectedHeader({ alg: 'ES256', kid: 'test' }).setIssuedAt(1).setExpirationTime(2).sign(pair.privateKey);
  await assert.rejects(verifyAccessToken(expired, keys));
  const hs = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new Uint8Array(32));
  await assert.rejects(verifyAccessToken(hs, keys));
});
test('roles only use current server-owned app metadata', () => {
  assert.deepEqual(getRolesFromClaims({ roles: ['admin'], user_metadata: { roles: ['admin'] } }), []);
  assert.deepEqual(getRolesFromClaims({ app_metadata: { roles: ['admin', 'service_role', 'moderator'] } }), ['admin', 'moderator']);
});
test('session revocation, deletion and role removal take effect even with a valid old JWT', async () => {
  let sessions = [{}], deleted = false;
  const deps = { verify: async () => ({ sub, session_id, app_metadata: { roles: ['admin'] } }),
    client: { auth: { getUser: async () => ({ data: { user: { id: sub, user_metadata: { roles: ['admin'] }, app_metadata: { roles: [] } } } }) } },
    db: { run: async query => typeof query === 'string' ? sessions : { internalId: 'auth0|legacy' } },
    isDeleted: async () => deleted };
  const principal = await authenticate('opaque', deps);
  assert.equal(principal.sub, 'auth0|legacy');
  assert.deepEqual(getRolesFromClaims(principal), []);
  sessions = []; await assert.rejects(authenticate('opaque', deps), /Revoked session/);
  sessions = [{}]; deleted = true; await assert.rejects(authenticate('opaque', deps), /Deleted account/);
});
test('Supabase Admin deletion preserves provider errors and never routes a legacy job to Supabase', async () => {
  const supabase = require('../srv/supabase-auth');
  const privacy = require('../srv/account-privacy');
  const previous = supabase.adminClient;
  process.env.SUPABASE_ACCOUNT_DELETION_MODE = 'dedicated-project';
  process.env.SUPABASE_SECRET_KEY = 'test-only-not-a-real-key';
  let calls = 0;
  let error = { status: 503 };
  supabase.adminClient = () => ({ auth: { admin: { deleteUser: async (id, soft) => {
    calls++; assert.equal(id, sub); assert.equal(soft, false); return { error };
  } } } });
  try {
    await assert.rejects(privacy.deleteSupabaseIdentity(sub), /pending/);
    error = { status: 404 }; await privacy.deleteSupabaseIdentity(sub);
    error = null; await privacy.deleteSupabaseIdentity(sub);
    assert.equal(calls, 3);
    await assert.rejects(privacy.deleteProviderIdentity('auth0|old', null), /Auth0/);
    await assert.rejects(privacy.deleteProviderIdentity(sub, 'unknown'), /Unknown/);
    assert.equal(calls, 3);
  } finally { supabase.adminClient = previous; delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_ACCOUNT_DELETION_MODE; }
});
