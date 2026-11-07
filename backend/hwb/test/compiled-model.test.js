const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, rm, access } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { test } = require('node:test');
const cds = require('@sap/cds');

test('the runtime model preserves PostgreSQL/SQLite DDL and custom service handlers', async t => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'hwb-model-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const filename = path.join(temporary, 'runtime.csn');
  await promisify(execFile)(process.execPath, ['util/compileRuntimeModel.js', filename], {
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const source = await cds.load('*');
  const compiled = await cds.load(filename);
  for (const dialect of ['postgres', 'sqlite']) {
    assert.deepEqual(cds.compile.to.sql(compiled, { dialect }), cds.compile.to.sql(source, { dialect }));
  }
  for (const name of ['api', 'public']) {
    assert.equal(compiled.definitions[name]['@source'], 'srv/hwb-service.cds');
    await access(compiled.definitions[name]['@source'].replace(/\.cds$/, '.js'));
  }
});
