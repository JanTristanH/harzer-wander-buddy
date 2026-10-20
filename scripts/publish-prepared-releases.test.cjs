const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadPlan, publish, releaseNotes, validateVersion } = require('./publish-prepared-releases.cjs');

const config = { 'bootstrap-sha': 'baseline', packages: { app: { component: 'app' } } };
function fixture(t, version = '1.6.0', changelog = '## [1.6.0](https://example.org) (2026-10-14)\n\n### Features\n\n* Filters\n\n## [1.5.0]\n\nOld notes\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hwb-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(`${root}/app`);
  const write = (file, data) => fs.writeFileSync(`${root}/${file}`, typeof data === 'string' ? data : JSON.stringify(data));
  write('release-please-config.json', config);
  write('.release-please-manifest.json', { app: version });
  write('app/package.json', { version });
  write('app/package-lock.json', { version, packages: { '': { version } } });
  if (changelog) write('app/CHANGELOG.md', changelog);
  return { root, write };
}
const missing = () => { throw Object.assign(new Error('missing ref'), { status: 128 }); };
function localGit(...args) {
  if (args[0] === 'show') return JSON.stringify({ version: '1.5.3' });
  if (args[0] === 'rev-parse') return missing();
  if (args[0] === 'merge-base') return '';
  throw Error(`Unexpected git: ${args}`);
}
function mock({ existing = false, prs = [], sha = 'main-sha' } = {}) {
  const calls = [], outputs = {};
  const github = {
    rest: {
      git: { createRef: async data => calls.push(['tag', data]) },
      repos: {
        getReleaseByTag: async () => {
          if (!existing) throw Object.assign(Error('not found'), { status: 404 });
          return { data: typeof existing === 'object' ? existing : { draft: false, prerelease: false } };
        },
        createRelease: async data => calls.push(['release', data]),
      },
      pulls: { list: () => {} },
      issues: {
        addLabels: async data => calls.push(['add-label', data]),
        removeLabel: async data => calls.push(['remove-label', data]),
      },
    },
    paginate: async () => prs,
  };
  return { calls, outputs, github, context: { repo: { owner: 'owner', repo: 'repo' }, sha }, core: { info() {}, setOutput(k, v) { outputs[k] = v; } }, runGit: localGit };
}
const candidate = () => ({ path: 'app', version: '1.6.0', tag: 'app-v1.6.0', notes: 'New filters' });

test('extracts only the requested release notes with linked or plain headings', () => {
  assert.equal(releaseNotes('## [1.6.0](url)\n\nNew\n## [1.5.0]\nOld', '1.6.0'), 'New');
  assert.equal(releaseNotes('## 1.6.0 (date)\nNew', '1.6.0'), 'New');
  assert.equal(releaseNotes('## [1.6.01]\nWrong', '1.6.0'), undefined);
  assert.equal(releaseNotes('## [1.6.0]', '1.6.0'), undefined);
});
test('loads prepared version and excludes old changelog entries', t => {
  const { root } = fixture(t);
  const plan = loadPlan(root, localGit);
  assert.equal(plan[0].tag, 'app-v1.6.0');
  assert.match(plan[0].notes, /Filters/);
  assert.doesNotMatch(plan[0].notes, /Old notes/);
});
test('does not publish unprepared baseline versions during migration', t => {
  const { root } = fixture(t, '1.5.3', '');
  assert.deepEqual(loadPlan(root, localGit), []);
});
test('rejects bumped versions without matching release notes', t => {
  const { root } = fixture(t, '1.6.0', '## [1.5.3]\nOld');
  assert.throws(() => loadPlan(root, localGit), /Missing release notes/);
});
test('rejects mismatched package and lock versions or unstable versions', () => {
  assert.throws(() => validateVersion('app', '1.6.0', { version: '1.6.0' }, { version: '1.5.3' }), /disagree/);
  assert.throws(() => validateVersion('app', '1.6.0-rc.1', {}, {}), /Invalid stable/);
});
test('rejects existing tags not reachable from main', t => {
  const { root } = fixture(t);
  assert.throws(() => loadPlan(root, (...args) => {
    if (args[0] === 'rev-parse') return 'other-branch';
    if (args[0] === 'merge-base') throw Object.assign(Error('not an ancestor'), { status: 1 });
    return localGit(...args);
  }), /not an ancestor/);
});
test('tags the exact main commit and publishes notes', async () => {
  const deps = mock();
  await publish([candidate()], deps);
  assert.deepEqual(deps.calls.map(([name]) => name), ['tag', 'release']);
  assert.equal(deps.calls[0][1].sha, 'main-sha');
  assert.equal(deps.calls[1][1].body, 'New filters');
  assert.deepEqual(deps.outputs, {});
});
test('later main commits do not republish existing releases', async () => {
  const deps = mock({ existing: true });
  await publish([{ ...candidate(), tagSha: 'previous-main' }], deps);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.outputs, {});
});
test('reruns on the publishing commit are idempotent', async () => {
  const deps = mock({ existing: true });
  await publish([{ ...candidate(), tagSha: 'main-sha' }], deps);
  assert.deepEqual(deps.calls, []);
  assert.deepEqual(deps.outputs, {});
});
test('repairs an interrupted publish after tag creation without moving the tag', async () => {
  const deps = mock();
  await publish([{ ...candidate(), tagSha: 'previous-main' }], deps);
  assert.deepEqual(deps.calls.map(([name]) => name), ['release']);
  assert.equal(deps.calls[0][1].target_commitish, 'previous-main');
});
test('publishes CAP-only releases', async () => {
  const deps = mock();
  await publish([{ ...candidate(), path: 'backend/hwb', tag: 'cap-v2.7.0', version: '2.7.0' }], deps);
  assert.deepEqual(deps.outputs, {});
});
const pending = { number: 42, merged_at: 'date', merge_commit_sha: 'prepared', labels: [{ name: 'autorelease: pending' }] };
test('acknowledges published preparation PRs so the next release can be prepared', async () => {
  const deps = mock({ prs: [pending] });
  deps.runGit = (...args) => {
    if (args[0] === 'show') return JSON.stringify({ app: args[1].includes('^:') ? '1.5.3' : '1.6.0' });
    return '';
  };
  await publish([candidate()], deps);
  assert.deepEqual(deps.calls.map(([name]) => name), ['tag', 'release', 'add-label', 'remove-label']);
});
test('does not acknowledge preparation PRs that have not reached main', async () => {
  const deps = mock({ prs: [pending] });
  deps.runGit = () => { throw Object.assign(Error('not an ancestor'), { status: 1 }); };
  await publish([candidate()], deps);
  assert.deepEqual(deps.calls.map(([name]) => name), ['tag', 'release']);
});
test('leaves preparation PR pending if its prepared version is not published', async () => {
  const deps = mock({ prs: [pending] });
  deps.runGit = (...args) => args[0] === 'show' ? JSON.stringify({ app: args[1].includes('^:') ? '1.5.3' : '1.7.0' }) : '';
  await publish([candidate()], deps);
  assert.deepEqual(deps.calls.map(([name]) => name), ['tag', 'release']);
});
test('propagates API errors without acknowledging the preparation', async () => {
  const deps = mock({ prs: [pending] });
  deps.github.rest.repos.createRelease = async () => { throw Error('API unavailable'); };
  await assert.rejects(() => publish([candidate()], deps), /API unavailable/);
  assert.deepEqual(deps.calls.map(([name]) => name), ['tag']);
});
