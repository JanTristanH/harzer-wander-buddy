const assert = require('node:assert/strict');
const { test } = require('node:test');
const startProduction = require('../util/startProduction');

test('does not listen before schema deployment finishes, and reuses the runtime', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const events = [];
  const runtime = { plugins: Promise.resolve(), deploy: model => {
    assert.equal(model, '*');
    return { to: async database => {
      assert.equal(database, 'db');
      events.push('deploy');
      await gate;
      events.push('deployed');
    } };
  } };
  const starting = startProduction({ runtime, serve: () => events.push('listen'), deployOnStart: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['deploy']);
  release();
  await starting;
  assert.deepEqual(events, ['deploy', 'deployed', 'listen']);
});

test('a deployment failure rejects startup without listening', async () => {
  let listened = false;
  await assert.rejects(startProduction({
    runtime: { plugins: Promise.resolve(), deploy: () => ({ to: async () => { throw new Error('database unavailable'); } }) },
    serve: () => { listened = true; }, deployOnStart: true,
  }), /database unavailable/);
  assert.equal(listened, false);
});

test('a pre-migrated startup does not deploy the schema', async () => {
  const result = await startProduction({
    runtime: { plugins: Promise.resolve(), deploy: () => { throw new Error('unexpected deployment'); } },
    serve: () => 'listening', deployOnStart: false,
  });
  assert.equal(result, 'listening');
});
