const START = '<!-- prepared-backmerge:start -->';
const END = '<!-- prepared-backmerge:end -->';

function updateBody(previous = '', generated) {
  const start = previous.indexOf(START), end = previous.indexOf(END);
  if (start >= 0 && end >= start) return previous.slice(0, start) + generated + previous.slice(end + END.length);
  return previous ? `${previous}\n\n${generated}` : generated;
}

async function prepareBackmerge({ github, context, core }) {
  const repo = context.repo;
  const tip = (await github.rest.git.getRef({ ...repo, ref: 'heads/main' })).data.object.sha;
  if (tip !== context.sha) {
    core.info('main advanced; its next release run will prepare the backmerge.');
    return;
  }
  const comparison = (await github.rest.repos.compareCommits({ ...repo, base: 'develop', head: tip })).data;
  if (comparison.ahead_by === 0) {
    core.info('main is already integrated into develop.');
    return;
  }
  const body = [
    START, '## Backmerge nach develop', '',
    `Übernimmt main bis ${tip} zurück nach develop (${comparison.ahead_by} zusätzliche Commits).`,
    'Damit sind der Freigabecommit und seine Release-Tags in der develop-Historie erreichbar.',
    '', '**Per Merge-Commit mergen, nicht squashen.** Kein Auto-Merge.',
    'CI und eventuelle Konflikte prüfen. Der Merge nach develop startet weder Googles main-Deployment noch ein automatisches OTA.',
    'Danach kann die nächste Version mit Prepare Release auf develop vorbereitet werden.', END,
  ].join('\n');
  const existing = await github.paginate(github.rest.pulls.list, {
    ...repo, base: 'develop', head: `${repo.owner}:main`, state: 'open', per_page: 100,
  });
  let pr = existing[0];
  if (pr) {
    await github.rest.pulls.update({
      ...repo, pull_number: pr.number,
      title: 'chore: sync main into develop', body: updateBody(pr.body, body),
    });
  } else {
    pr = (await github.rest.pulls.create({
      ...repo, base: 'develop', head: 'main',
      title: 'chore: sync main into develop', body, draft: false,
    })).data;
  }
  core.info(`Backmerge PR: ${pr.html_url}`);
  await core.summary.addLink('Backmerge-PR main → develop', pr.html_url).write();
}

module.exports = { prepareBackmerge, updateBody };
