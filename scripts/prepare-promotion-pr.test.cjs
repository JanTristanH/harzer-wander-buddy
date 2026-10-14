const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promotionDetails, updateBody, preparePromotion } = require('./prepare-promotion-pr.cjs');
const release = { path: 'app', version: '1.6.0', notes: 'New filters' };
const inputs = { releases: [release], mainManifest: { app: '1.5.3' }, pending: [], changedAfterPreparation: false };

test('ready promotion has conventional title, versions, notes and merge instructions', () => {
  const result = promotionDetails(inputs);
  assert.equal(result.draft, false);
  assert.equal(result.title, 'chore(release): promote develop to main (App 1.6.0)');
  assert.match(result.body, /New filters/);
  assert.match(result.body, /Merge-Commit/);
});
test('open version PRs keep the promotion draft and linked', () => {
  const result = promotionDetails({ ...inputs, pending: [{ number: 42, title: 'chore: release app' }] });
  assert.equal(result.draft, true);
  assert.match(result.body, /#42/);
});
test('baseline versions without a new prepared release remain draft', () => {
  assert.equal(promotionDetails({ ...inputs, mainManifest: { app: '1.6.0' } }).draft, true);
});
test('source changes after the version bump require another review', () => {
  assert.equal(promotionDetails({ ...inputs, changedAfterPreparation: true }).draft, true);
});
test('updates generated content while preserving user notes', () => {
  const first = promotionDetails(inputs).body;
  const next = promotionDetails({ ...inputs, pending: [{ number: 7, title: 'release' }] }).body;
  assert.equal(updateBody(`User introduction\n${first}\nUser conclusion`, next), `User introduction\n${next}\nUser conclusion`);
  assert.equal(updateBody('Existing notes', next), `Existing notes\n\n${next}`);
});
function mocks({ existing = [], pending = [], eventName = 'workflow_dispatch', tip = 'tested', changed = '' } = {}) {
  const calls = [];
  const deps = {
    context: { repo: { owner: 'owner', repo: 'repo' }, sha: 'tested', eventName },
    core: { info() {}, summary: { addLink() { return this; }, async write() {} } },
    readPlan: () => [release],
    runGit: (...args) => ({ 'rev-list': '3', show: '{"app":"1.5.3"}', log: 'bump', diff: changed })[args[0]],
    github: {
      rest: {
        git: { getRef: async () => ({ data: { object: { sha: tip } } }) },
        pulls: {
          list() {},
          create: async data => { calls.push(['create', data]); return { data: { html_url: 'https://example.org/1' } }; },
          update: async data => calls.push(['update', data]),
        },
      },
      paginate: async (_, query) => query.base === 'main' ? existing : pending,
      graphql: async (query, variables) => calls.push(['graphql', query, variables]),
    },
  };
  return { deps, calls };
}
test('manual preparation creates a draft while versions are still open', async () => {
  const { deps, calls } = mocks({ pending: [{ number: 2, title: 'release', labels: [{ name: 'autorelease: pending' }] }] });
  await preparePromotion(deps);
  assert.equal(calls[0][0], 'create');
  assert.equal(calls[0][1].draft, true);
  assert.equal(calls[0][1].head, 'develop');
  assert.equal(calls[0][1].base, 'main');
});
test('push refreshes the existing PR and marks it ready after preparation merges', async () => {
  const { deps, calls } = mocks({ eventName: 'push', existing: [{ number: 9, node_id: 'node', draft: true, body: 'User notes', html_url: 'url' }] });
  await preparePromotion(deps);
  assert.equal(calls[0][0], 'update');
  assert.match(calls[0][1].body, /User notes/);
  assert.match(calls[1][1], /markPullRequestReadyForReview/);
});
test('new changes return an existing ready PR to draft', async () => {
  const { deps, calls } = mocks({ changed: 'app/new-feature.ts', existing: [{ number: 9, node_id: 'node', draft: false, html_url: 'url' }] });
  await preparePromotion(deps);
  assert.match(calls[1][1], /convertPullRequestToDraft/);
});
test('pushes do not create promotion PRs before manual preparation', async () => {
  const { deps, calls } = mocks({ eventName: 'push' });
  await preparePromotion(deps);
  assert.deepEqual(calls, []);
});
test('stale tested runs never update a newer promotion', async () => {
  const { deps, calls } = mocks({ tip: 'newer' });
  await preparePromotion(deps);
  assert.deepEqual(calls, []);
});
