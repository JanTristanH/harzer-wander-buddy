const { test } = require('node:test');
const assert = require('node:assert/strict');
const { previewServiceName, previewServicesToDelete } = require('./pr-preview-policy.cjs');
const { manageServices } = require('./manage-pr-preview-services.cjs');
const service = (name, pr = '110') => ({ metadata: { name, labels: { 'managed-by': 'hwb-pr-preview', pr } } });
const env = { PROJECT_ID: 'preview-project', REGION: 'europe-west3', PREVIEW_PR: '110' };

test('service identity depends only on PR number and validates the input', () => {
  assert.equal(previewServiceName('110'), 'hwb-pr-110');
  assert.throws(() => previewServiceName('110;bad'));
  assert.throws(() => previewServiceName('0'));
});

test('migration deletes legacy commit services but keeps the stable service, other PRs and unmanaged services', () => {
  const rows = [service('hwb-pr-110'), service('hwb-pr-110-c9652dcbbf37'), service('hwb-pr-111-aabbccddeeff', '111'), { metadata: { name: 'production', labels: {} } }];
  assert.deepEqual(previewServicesToDelete(rows, '110', true), ['hwb-pr-110-c9652dcbbf37']);
  assert.deepEqual(previewServicesToDelete(rows, '110', false), ['hwb-pr-110', 'hwb-pr-110-c9652dcbbf37']);
  assert.throws(() => previewServicesToDelete([service('production')], '110', true));
  assert.throws(() => previewServicesToDelete([{ metadata: { name: 'hwb-pr-110', labels: {} } }], '110', true));
  assert.throws(() => previewServicesToDelete({}, '110', true));
});

test('migration is idempotent and checks the remaining service; closing removes stable and legacy services', () => {
  let rows = [service('hwb-pr-110'), service('hwb-pr-110-c9652dcbbf37'), service('hwb-pr-111', '111')];
  const deletions = [];
  const execute = (command, args) => {
    assert.equal(command, 'gcloud');
    assert.ok(args.includes('preview-project'));
    assert.ok(args.includes('europe-west3'));
    if (args[2] === 'list') return JSON.stringify(rows);
    assert.equal(args[2], 'delete');
    deletions.push(args[3]);
    rows = rows.filter(row => row.metadata.name !== args[3]);
  };
  assert.deepEqual(manageServices('migrate', env, execute), ['hwb-pr-110']);
  assert.deepEqual(manageServices('migrate', env, execute), ['hwb-pr-110']);
  assert.deepEqual(manageServices('verify', env, execute), ['hwb-pr-110']);
  assert.deepEqual(manageServices('remove', env, execute), []);
  assert.deepEqual(deletions, ['hwb-pr-110-c9652dcbbf37', 'hwb-pr-110']);
  assert.deepEqual(rows.map(row => row.metadata.name), ['hwb-pr-111']);
});

test('invalid data and incomplete cleanup fail before a new deployment can proceed', () => {
  let calls = 0;
  assert.throws(() => manageServices('migrate', env, () => { calls++; return JSON.stringify([service('production')]); }));
  assert.equal(calls, 1);
  assert.throws(() => manageServices('migrate', env, (_command, args) => args[2] === 'list' ? JSON.stringify([service('hwb-pr-110-aabbccddeeff')]) : undefined), /remain/);
  assert.throws(() => manageServices('verify', env, () => '[]'), /exactly one/);
});

test('first migration removes every legacy instance before the fixed name is created', () => {
  let rows = [service('hwb-pr-110-c9652dcbbf37'), service('hwb-pr-110-943bf9f4aab5')];
  const execute = (_command, args) => {
    if (args[2] === 'list') return JSON.stringify(rows);
    rows = rows.filter(row => row.metadata.name !== args[3]);
  };
  assert.deepEqual(manageServices('migrate', env, execute), []);
  rows.push(service('hwb-pr-110'));
  assert.deepEqual(manageServices('verify', env, execute), ['hwb-pr-110']);
});
