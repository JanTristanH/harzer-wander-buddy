const { execFileSync } = require('node:child_process');
const { loadPlan } = require('./publish-prepared-releases.cjs');
const START = '<!-- prepared-promotion:start -->';
const END = '<!-- prepared-promotion:end -->';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function promotionDetails({ releases, mainManifest, pending, changedAfterPreparation }) {
  const changed = releases.filter(item => mainManifest[item.path] !== item.version);
  const blockers = [];
  if (pending.length) blockers.push('Zuerst alle offenen Versions-PRs nach develop mergen.');
  if (!changed.length) blockers.push('Es ist noch keine neue Version mit Changelog auf develop vorbereitet.');
  if (changedAfterPreparation) blockers.push('Nach dem Versionsbump wurden App-/CAP-Dateien geändert. Release-Stand erneut prüfen und vorbereiten.');
  const versions = changed.map(item => `${item.path === 'app' ? 'App' : 'CAP'} ${item.version}`).join(', ');
  const title = `chore(release): promote develop to main${versions ? ` (${versions})` : ''}`;
  const body = [
    START, '## Freigabe nach main', '',
    changed.length ? changed.map(item => `- ${item.path === 'app' ? 'App' : 'CAP'}: **${item.version}**\n\n${item.notes}`).join('\n\n') : 'Versionen werden ergänzt, sobald die Versions-PRs gemergt sind.',
    '', '## Status', '',
    ...blockers.map(text => `- ${text}`),
    ...pending.map(pr => `- Versions-PR: #${pr.number} — ${pr.title}`),
    ...(blockers.length ? [] : ['Vorbereitete Versionen vorhanden; CI-Prüfungen und Änderungen vor der Freigabe prüfen.']),
    '', '**Per Merge-Commit mergen, nicht squashen.** Kein Auto-Merge.',
    'Der Merge startet Googles bestehenden Docker-Build. Tags/Releases und native App-Builds folgen ohne weiteren Versionscommit. OTA von main veröffentlicht auf preview.',
    'Danach main per Merge-PR zurück nach develop führen.', END,
  ].join('\n');
  return { title, body, draft: blockers.length > 0 };
}

function updateBody(previous = '', generated) {
  const start = previous.indexOf(START), end = previous.indexOf(END);
  if (start >= 0 && end >= start) return previous.slice(0, start) + generated + previous.slice(end + END.length);
  return previous ? `${previous}\n\n${generated}` : generated;
}

async function preparePromotion({ github, context, core, runGit = git, readPlan = loadPlan }) {
  // Do not use a newer moving develop tip than the commit tested by this run.
  const latest = await github.rest.git.getRef({ ...context.repo, ref: 'heads/develop' });
  if (latest.data.object.sha !== context.sha) {
    core.info('develop advanced during this run; its next workflow run will update the promotion PR.');
    return;
  }
  if (runGit('rev-list', '--count', 'origin/main..HEAD') === '0') {
    core.info('develop has no commits to promote.');
    return;
  }
  const existing = await github.paginate(github.rest.pulls.list, { ...context.repo, base: 'main', head: `${context.repo.owner}:develop`, state: 'open', per_page: 100 });
  if (!existing.length && context.eventName !== 'workflow_dispatch') {
    core.info('No promotion PR yet; start Prepare Release manually to create one.');
    return;
  }
  const open = await github.paginate(github.rest.pulls.list, { ...context.repo, base: 'develop', state: 'open', per_page: 100 });
  const pending = open.filter(pr => pr.labels.some(label => label.name === 'autorelease: pending'));
  const mainManifest = JSON.parse(runGit('show', 'origin/main:.release-please-manifest.json'));
  const releases = readPlan();
  const preparation = runGit('log', '-1', '--format=%H', '--', '.release-please-manifest.json');
  const changedAfterPreparation = Boolean(runGit('diff', '--name-only', preparation, 'HEAD', '--', 'app', 'backend/hwb'));
  const details = promotionDetails({ releases, mainManifest, pending, changedAfterPreparation });
  let pr = existing[0];
  if (pr) {
    await github.rest.pulls.update({ ...context.repo, pull_number: pr.number, title: details.title, body: updateBody(pr.body, details.body) });
    if (pr.draft !== details.draft) {
      const mutation = details.draft ? 'convertPullRequestToDraft' : 'markPullRequestReadyForReview';
      await github.graphql(`mutation($id: ID!) { ${mutation}(input: {pullRequestId: $id}) { pullRequest { id } } }`, { id: pr.node_id });
    }
  } else {
    pr = (await github.rest.pulls.create({ ...context.repo, base: 'main', head: 'develop', title: details.title, body: details.body, draft: details.draft })).data;
  }
  core.info(`Promotion PR: ${pr.html_url} (${details.draft ? 'draft' : 'ready for review'})`);
  await core.summary.addLink('Freigabe-PR develop → main', pr.html_url).write();
}

module.exports = { promotionDetails, updateBody, preparePromotion };
