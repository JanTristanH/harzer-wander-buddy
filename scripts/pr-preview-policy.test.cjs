const { test } = require('node:test');
const assert = require('node:assert/strict');
const { previewAction, updateBody, previewSection, publish } = require('./pr-preview-policy.cjs');
const pr = { state: 'open', labels: [], head: { sha: 'current' } };

test('ordinary PR pushes do not deploy; preview label opts in', () => {
  assert.equal(previewAction({ pr, eventName: 'pull_request', action: 'synchronize' }), 'skip');
  assert.equal(previewAction({ pr: { ...pr, labels: [{ name: 'preview' }] }, eventName: 'pull_request', action: 'synchronize' }), 'deploy');
});
test('removing preview label and closing an unlabeled PR clean up', () => {
  assert.equal(previewAction({ pr, action: 'unlabeled', label: 'preview' }), 'remove');
  assert.equal(previewAction({ pr: { ...pr, state: 'closed' } }), 'remove');
  assert.equal(previewAction({ pr, action: 'unlabeled', label: 'other' }), 'skip');
  // A queued removal cannot delete a preview that has since been re-enabled.
  assert.equal(previewAction({ pr: { ...pr, labels: [{ name: 'preview' }] }, action: 'unlabeled', label: 'preview' }), 'deploy');
});
test('manual deploy and remove work without labels; invalid actions fail', () => {
  assert.equal(previewAction({ pr, eventName: 'workflow_dispatch' }), 'deploy');
  assert.equal(previewAction({ pr, eventName: 'workflow_dispatch', requestedAction: 'remove' }), 'remove');
  assert.throws(() => previewAction({ pr, eventName: 'workflow_dispatch', requestedAction: 'bad' }));
});
test('PR description replaces only its marked section and preserves surrounding notes', () => {
  const body = updateBody('Existing description', 'first');
  assert.equal(updateBody(`${body}\nUser footer`, 'second'), `${updateBody('Existing description', 'second')}\nUser footer`);
  assert.throws(() => updateBody('Notes\n<!-- hwb-pr-preview:start -->', 'replacement'));
});
test('description includes real web and APK links, and does not claim a failed activation is live', () => {
  const input = { sha: 'current', url: 'https://preview.example', apkUrl: 'https://github.com/artifact', runUrl: 'https://github.com/run', active: true };
  assert.match(previewSection(input), /\[Live-Web-App\]\(https:\/\/preview.example\/app\/rnweb\)/);
  assert.match(previewSection(input), /\[Android-APK.*\]\(https:\/\/github.com\/artifact\)/);
  assert.doesNotMatch(previewSection({ ...input, active: false }), /\[Live-Web-App\]/);
  assert.doesNotMatch(previewSection({ removed: true }), /https:/);
});
test('web link stays live while Android builds and after an APK failure', () => {
  const input = { sha: 'current', url: 'https://preview.example', runUrl: 'https://github.com/run', active: true };
  const pending = previewSection({ ...input, androidPending: true });
  assert.match(pending, /\[Live-Web-App\]\(https:\/\/preview.example\/app\/rnweb\)/);
  assert.match(pending, /Android-APK: Build läuft/);
  assert.doesNotMatch(pending, /nicht erfolgreich/);
  const failed = previewSection(input);
  assert.match(failed, /\[Live-Web-App\]/);
  assert.match(failed, /Android-APK: Build nicht erfolgreich/);
  assert.doesNotMatch(failed, /Build läuft/);
  const complete = previewSection({ ...input, apkUrl: 'https://github.com/artifact' });
  assert.doesNotMatch(complete, /Build läuft|Build nicht erfolgreich/);
  // The last report replaces the pending section, even if Android finished first.
  const body = updateBody(updateBody('Notes', pending), complete);
  assert.doesNotMatch(body, /Build läuft/);
  assert.match(body, /https:\/\/github.com\/artifact/);
});
test('stale, closed or opted-out PRs cannot receive deployment links; manual runs can', async () => {
  let current = pr;
  const updates = [];
  const github = { rest: { pulls: { get: async () => ({ data: current }), update: async value => updates.push(value) } } };
  const input = { github, owner: 'owner', repo: 'repo', number: 1, sha: 'current', section: 'preview' };
  assert.equal(await publish(input), false);
  assert.equal(await publish({ ...input, manual: true }), true);
  current = { ...pr, labels: [{ name: 'preview' }] };
  assert.equal(await publish({ ...input, sha: 'old' }), false);
  assert.equal(await publish({ ...input, removed: true }), false);
  assert.equal(await publish({ ...input, removed: true, manual: true }), true);
  current = { ...pr, state: 'closed' };
  assert.equal(await publish({ ...input, manual: true }), false);
  assert.equal(await publish({ ...input, removed: true }), true);
  assert.equal(updates.length, 3);
});
