const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareBackmerge, updateBody } = require('./prepare-backmerge-pr.cjs');

function mocks({ tip = 'released-sha', ahead = 1, existing = [] } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      context: { repo: { owner: 'owner', repo: 'repo' }, sha: 'released-sha' },
      core: { info() {}, summary: { addLink() { return this; }, async write() {} } },
      github: {
        rest: {
          git: { getRef: async () => ({ data: { object: { sha: tip } } }) },
          repos: { compareCommits: async data => { calls.push(['compare', data]); return { data: { ahead_by: ahead } }; } },
          pulls: {
            list() {},
            create: async data => { calls.push(['create', data]); return { data: { html_url: 'url' } }; },
            update: async data => calls.push(['update', data]),
          },
        },
        paginate: async (_, query) => { calls.push(['list', query]); return existing; },
      },
    },
  };
}

test('creates main to develop PR even if main is only a merge commit ahead', async () => {
  const { deps, calls } = mocks();
  await prepareBackmerge(deps);
  assert.equal(calls[0][1].base, 'develop');
  assert.equal(calls[0][1].head, 'released-sha');
  const request = calls.find(([type]) => type === 'create')[1];
  assert.equal(request.base, 'develop');
  assert.equal(request.head, 'main');
  assert.equal(request.title, 'chore: sync main into develop');
  assert.match(request.body, /Merge-Commit/);
  assert.match(request.body, /Kein Auto-Merge/);
});
test('updates an existing backmerge instead of creating a duplicate and preserves user notes', async () => {
  const { deps, calls } = mocks({ existing: [{ number: 45, body: 'User notes', html_url: 'url' }] });
  await prepareBackmerge(deps);
  assert.equal(calls.some(([type]) => type === 'create'), false);
  const request = calls.find(([type]) => type === 'update')[1];
  assert.equal(request.pull_number, 45);
  assert.match(request.body, /^User notes/);
});
test('does not create a PR if main is already integrated into develop', async () => {
  const { deps, calls } = mocks({ ahead: 0 });
  await prepareBackmerge(deps);
  assert.deepEqual(calls.map(([type]) => type), ['compare']);
});
test('stale workflow does not prepare an untested newer main tip', async () => {
  const { deps, calls } = mocks({ tip: 'newer-main' });
  await prepareBackmerge(deps);
  assert.deepEqual(calls, []);
});
test('refresh replaces generated text and preserves surrounding manual text', () => {
  const previous = 'Intro\n<!-- prepared-backmerge:start -->old<!-- prepared-backmerge:end -->\nConclusion';
  const next = '<!-- prepared-backmerge:start -->new<!-- prepared-backmerge:end -->';
  assert.equal(updateBody(previous, next), `Intro\n${next}\nConclusion`);
});
test('API errors fail visibly rather than creating a second PR', async () => {
  const { deps, calls } = mocks();
  deps.github.paginate = async () => { throw Error('API unavailable'); };
  await assert.rejects(() => prepareBackmerge(deps), /API unavailable/);
  assert.equal(calls.some(([type]) => type === 'create'), false);
});
