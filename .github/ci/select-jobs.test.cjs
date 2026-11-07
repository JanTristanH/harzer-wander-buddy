const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { selectJobs, changedPaths, previewChangesRelevant } = require('./select-jobs.cjs');
const enabled = paths => Object.entries(selectJobs(paths)).filter(([, v]) => v).map(([k]) => k);
const cases = [
  [['app/xTODO.md', 'docs/todos/a.md', 'founder/pricing-strategy.md'], []],
  [['README.md', 'backend/hwb/README.md'], []],
  [['app/app/(tabs)/map.tsx'], ['docker', 'app', 'static', 'preview']],
  [['app/package-lock.json'], ['docker', 'app', 'static', 'preview']],
  [['app/scripts/fingerprint.test.cjs'], ['docker', 'app', 'static', 'preview']],
  [['app/assets/help.md'], ['docker', 'app', 'static', 'preview']],
  [['backend/hwb/srv/service.cds'], ['docker', 'backend', 'preview']],
  [['backend/hwb/app/frontendhwb/webapp/Component.js'], ['docker', 'backend', 'preview']],
  [['scripts/prepare-promotion-pr.cjs'], ['release', 'preview']],
  [['scripts/build-static-website.mjs'], ['static']],
  [['.agents/skills/hwb-sites-preview/scripts/prepare-preview.mjs'], ['static']],
  [['deploy/preview/Dockerfile'], ['docker', 'preview']],
];
for (const [paths, expected] of cases) test(paths.join(', '), () => assert.deepEqual(enabled(paths), expected));
for (const paths of [[], ['Dockerfile'], ['.dockerignore'], ['new-package/input.json'], ['.github/workflows/tests.yml'], ['.github/ci/select-jobs.cjs'], ['release-please-config.json']]) {
  test(`conservative fallback: ${paths}`, () => assert.equal(enabled(paths).length, 6));
}
test('mixed docs and backend still test backend', () => assert.deepEqual(enabled(['app/xTODO.md', 'backend/hwb/package-lock.json']), ['docker', 'backend', 'preview']));
test('manual and reusable release override docs', () => assert.ok(Object.values(selectJobs(['docs/a.md'], true)).every(Boolean)));
test('PR uses merge base, push uses before/after and NUL paths', () => {
  const base = 'a'.repeat(40), head = 'b'.repeat(40);
  const git = args => { assert.ok(args.includes('--no-renames')); assert.ok(args.includes('-z')); assert.equal(args.at(-1), '--'); return 'app/space name.ts\0app/new\nline.ts\0'; };
  assert.equal(changedPaths('pull_request', { pull_request: { base: { sha: base }, head: { sha: head } } }, args => { assert.ok(args.includes(`${base}...${head}`)); return git(args); }).length, 2);
  changedPaths('push', { before: base, after: head }, args => { assert.ok(args.includes(`${base}..${head}`)); return git(args); });
  assert.throws(() => changedPaths('push', { before: '0'.repeat(40), after: head }));
});
test('real git diff includes both sides of a rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hwb-ci-'));
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git(['init', '-q']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
    writeFileSync(join(dir, 'code.js'), 'code'); git(['add', '.']); git(['commit', '-qm', 'base']); const before = git(['rev-parse', 'HEAD']).trim();
    git(['mv', 'code.js', 'README.md']); git(['commit', '-qm', 'rename']); const after = git(['rev-parse', 'HEAD']).trim();
    const paths = changedPaths('push', { before, after }, git);
    assert.deepEqual(paths.sort(), ['README.md', 'code.js']); assert.equal(enabled(paths).length, 6);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
function previewMock(files, changed = files.length, sha = 'head') {
  return { context: { repo: { owner: 'a', repo: 'b' } }, pr: { number: 1, changed_files: changed, head: { sha: 'head' } }, github: {
    paginate: async () => files, rest: { pulls: { listFiles: () => {}, get: async () => ({ data: { head: { sha } } }) } },
  } };
}
test('preview docs skip, code/mixed/renamed paths deploy', async () => {
  assert.equal(await previewChangesRelevant(previewMock([{ filename: 'app/xTODO.md' }])), false);
  assert.equal(await previewChangesRelevant(previewMock([{ filename: 'README.md', previous_filename: 'app/main.ts' }])), true);
  assert.equal(await previewChangesRelevant(previewMock([{ filename: 'app/main.ts' }, { filename: 'README.md' }])), true);
});
test('incomplete, capped, racing and failed API responses deploy', async () => {
  assert.equal(await previewChangesRelevant(previewMock([{ filename: 'README.md' }], 3001)), true);
  assert.equal(await previewChangesRelevant(previewMock(Array.from({ length: 3000 }, () => ({ filename: 'README.md' })))), true);
  assert.equal(await previewChangesRelevant(previewMock([{ filename: 'README.md' }], 1, 'new-head')), true);
  const mock = previewMock([]); mock.github.paginate = async () => { throw new Error('API unavailable'); };
  assert.equal(await previewChangesRelevant(mock), true);
});
test('CLI falls back to all jobs when history/event is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hwb-ci-cli-'));
  try {
    const output = join(dir, 'outputs');
    execFileSync(process.execPath, ['.github/ci/select-jobs.cjs'], { env: { ...process.env, GITHUB_EVENT_PATH: join(dir, 'missing'), GITHUB_OUTPUT: output }, stdio: 'pipe' });
    assert.equal(readFileSync(output, 'utf8').split('=true\n').length - 1, 6);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
