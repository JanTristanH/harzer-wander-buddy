const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAuthEnvironment } = require('./check-ota-environment.cjs');
const staging = { EXPO_PUBLIC_BACKEND_URL: 'https://staging.example.invalid',
  EXPO_PUBLIC_SUPABASE_URL: 'https://staging.supabase.co',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only', OTA_ENVIRONMENT: 'preview' };
test('build configuration rejects missing/secret keys and preview production backend', () => {
  assert.deepEqual(validateAuthEnvironment(staging), []);
  assert.ok(validateAuthEnvironment({}).length);
  assert.ok(validateAuthEnvironment({ ...staging, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test_only' }).length);
  assert.ok(validateAuthEnvironment({ ...staging, EXPO_PUBLIC_BACKEND_URL: 'https://app.harzer-wander-buddy.de' }).length);
});
