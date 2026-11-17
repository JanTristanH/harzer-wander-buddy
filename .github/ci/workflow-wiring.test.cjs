const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { selectJobs } = require('./select-jobs.cjs');
const read = name => readFileSync(`.github/workflows/${name}.yml`, 'utf8');

test('actual PR #121 has no expensive selected jobs', () => {
  const paths = require('./pr-121-files.json');
  assert.equal(paths.length, 8);
  assert.ok(Object.values(selectJobs(paths)).every(value => value === false));
});
test('stable status check names and unfiltered PR triggers are retained', () => {
  const tests = read('tests');
  for (const name of ['Docker build', 'Backend CAP tests', 'App Jest tests', 'Release automation tests', 'CI result']) assert.ok(tests.includes(`name: ${name}\n`));
  for (const workflow of ['tests', 'static-website']) {
    assert.ok(read(workflow).includes('  pull_request:\n'));
    assert.ok(!/paths(?:-ignore)?:/.test(read(workflow)));
  }
  assert.ok(read('static-website').includes("if: needs.changes.outputs.static == 'true'"));
});
test('release callers and security guards remain wired', () => {
  assert.ok(read('tests').includes('default: true'));
  assert.ok(read('releases').includes('needs: tests'));
  assert.ok(read('prepare-release').includes("force-full: ${{ github.event_name == 'workflow_dispatch' }}"));
  assert.ok(read('tests').includes('node --test scripts/fingerprint.test.cjs'));
  for (const step of ['Run app tests', 'Validate EAS environment', 'Publish OTA update']) assert.ok(read('expo-update').includes(`name: ${step}`));
  assert.ok(read('pr-title').includes('pull_request_target:'));
  assert.ok(!read('pr-title').includes('uses: actions/checkout'));
  const preview = read('pr-preview');
  for (const guard of ['Fork previews are disabled', "if: needs.source.outputs.action == 'remove'", "['opened', 'synchronize']", 'github.workflow_sha']) assert.ok(preview.includes(guard));
});
test('CI result executes and rejects missing, failed, cancelled or unexpectedly skipped jobs', () => {
  const tests = read('tests');
  const gate = tests.slice(tests.indexOf('  ci-result:'));
  assert.ok(gate.includes('if: always()'));
  const script = gate.split("node - <<'NODE'\n")[1].split('          NODE')[0].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  function result(selection, override = {}) {
    const needs = { changes: { result: 'success', outputs: selection } };
    for (const [job, key] of Object.entries({ 'docker-build': 'docker', 'backend-tests': 'backend', 'app-tests': 'app', 'release-tests': 'release' })) needs[job] = { result: selection[key] === 'true' ? 'success' : 'skipped' };
    Object.assign(needs, override);
    return spawnSync(process.execPath, ['-e', script], { env: { ...process.env, RESULTS: JSON.stringify(needs) } }).status;
  }
  const none = Object.fromEntries(['docker', 'backend', 'app', 'release'].map(k => [k, 'false']));
  assert.equal(result(none), 0);
  const full = Object.fromEntries(Object.keys(none).map(k => [k, 'true']));
  assert.equal(result(full), 0);
  for (const state of ['failure', 'cancelled', 'skipped']) assert.equal(result(full, { 'app-tests': { result: state } }), 1);
  assert.equal(result(none, { changes: { result: 'failure', outputs: {} } }), 1);
  assert.equal(result(none, { changes: { result: 'success', outputs: {} } }), 1);
});

// Run the actual source-job script without GitHub writes or deployments.
test('preview reopen restores opted-in docs previews and retains lifecycle guards', async () => {
  const script = read('pr-preview').split('          script: |\n')[1].split('\n  deploy:')[0].split('\n').map(line => line.replace(/^            /, '')).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('github', 'context', 'core', 'require', 'process', script);
  async function action({ event = 'reopened', enabled = true, state = 'open', eventName = 'pull_request', label, fork = false } = {}) {
    const pr = { number: 122, state, changed_files: 1, labels: enabled ? [{ name: 'preview' }] : [], head: { sha: 'head', repo: { full_name: fork ? 'fork/repo' : 'owner/repo' } } };
    const outputs = {};
    let fileRequests = 0;
    const github = { rest: { pulls: { get: async () => ({ data: pr }), listFiles: () => {} } }, paginate: async () => { fileRequests++; return [{ filename: 'docs/test.md' }]; } };
    const context = { eventName, repo: { owner: 'owner', repo: 'repo' }, payload: { action: event, label: { name: label }, repository: { full_name: 'owner/repo' } } };
    const modules = { './scripts/pr-preview-policy.cjs': require('../../scripts/pr-preview-policy.cjs'), './.github/ci/select-jobs.cjs': require('./select-jobs.cjs') };
    await run(github, context, { setOutput: (name, value) => { outputs[name] = value; }, notice: () => {} }, name => { assert.ok(modules[name], name); return modules[name]; }, { env: { REQUESTED_PR: '122', REQUESTED_ACTION: 'deploy' } });
    return { action: outputs.action, fileRequests };
  }
  assert.deepEqual(await action(), { action: 'deploy', fileRequests: 0 });
  assert.deepEqual(await action({ enabled: false }), { action: 'skip', fileRequests: 0 });
  for (const event of ['opened', 'synchronize']) assert.deepEqual(await action({ event }), { action: 'skip', fileRequests: 1 });
  assert.deepEqual(await action({ event: 'closed', state: 'closed' }), { action: 'remove', fileRequests: 0 });
  assert.deepEqual(await action({ event: 'unlabeled', label: 'preview', enabled: false }), { action: 'remove', fileRequests: 0 });
  assert.deepEqual(await action({ event: 'labeled', label: 'preview' }), { action: 'deploy', fileRequests: 0 });
  assert.deepEqual(await action({ eventName: 'workflow_dispatch', enabled: false }), { action: 'deploy', fileRequests: 0 });
  await assert.rejects(action({ fork: true }), /Fork previews are disabled/);
});
