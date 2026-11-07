#!/usr/bin/env node
// Isolated staging, synthetic records only. No database mutations, RPC invocation,
// or response bodies logged. A 2xx with zero rows is a FAIL for server-only data.
const assert = require('node:assert/strict');
async function main(env = process.env, request = fetch) {
  assert.equal(env.HWB_ISOLATED_SYNTHETIC_STAGING, 'yes');
  const origin = new URL(env.HWB_STAGING_SUPABASE_URL);
  assert.equal(origin.protocol, 'https:');
  assert(!origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === '/');
  assert.notEqual(origin.hostname.split('.')[0], 'vdqdopjinjyginervesk');
  assert(env.HWB_STAGING_PUBLISHABLE_KEY);
  assert(env.HWB_STAGING_USER_JWT); // real ordinary test user, never service_role
  const relations = JSON.parse(env.HWB_STAGING_RELATIONS_JSON);
  assert(Array.isArray(relations) && relations.length > 0);
  let failed = false;
  for (const role of ['anon', 'authenticated']) {
    for (const relation of relations) {
      assert(/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(relation.schema));
      assert(/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(relation.name));
      const headers = { apikey: env.HWB_STAGING_PUBLISHABLE_KEY, 'Accept-Profile': relation.schema };
      if (role === 'authenticated') headers.Authorization = `Bearer ${env.HWB_STAGING_USER_JWT}`;
      const url = new URL(`/rest/v1/${relation.name}`, origin);
      url.search = 'select=*&limit=0';
      const response = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      // Distinguish permissions errors from gateway errors, stale cache and bad JWTs.
      const body = await response.json().catch(() => ({}));
      const denied = (response.status === 403 || (role === 'anon' && response.status === 401)) && body.code === '42501';
      console.log(JSON.stringify({ role, ...relation, status: response.status, result: denied ? 'DENIED' : 'REVIEW_REQUIRED' }));
      if (!denied) failed = true;
    }
  }
  if (failed) throw new Error('Unproven API isolation');
}
module.exports = { main };
if (require.main === module) main().catch(() => { console.error('Staging API check incomplete or failed; release remains blocked.'); process.exitCode = 1; });
