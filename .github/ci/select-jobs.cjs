const { execFileSync } = require('node:child_process');
const { appendFileSync, readFileSync } = require('node:fs');
const jobs = ['docker', 'backend', 'app', 'release', 'static', 'preview'];
const all = () => Object.fromEntries(jobs.map(job => [job, true]));

// Deliberately narrow: Markdown under app/assets or a future unknown path may
// be runtime input. Unknown files run everything rather than silently losing CI.
function documentation(path) {
  return /^(docs|founder)\/.*\.md$/i.test(path) ||
    /^(?:.*\/)?(?:README|CHANGELOG|AGENTS)\.md$/i.test(path) || path === 'app/xTODO.md';
}
function selectJobs(paths, force = false) {
  if (force || !Array.isArray(paths) || paths.length === 0) return all();
  const selected = Object.fromEntries(jobs.map(job => [job, false]));
  for (const path of paths) {
    if (typeof path !== 'string' || !path || path.includes('..')) return all();
    if (documentation(path)) continue;
    let affected;
    if (path.startsWith('.github/')) return all();
    if (path.startsWith('app/')) affected = ['app', 'docker', 'static', 'preview'];
    else if (path.startsWith('backend/')) affected = ['backend', 'docker', 'preview'];
    else if (path.startsWith('.agents/skills/hwb-sites-preview/')) affected = ['static'];
    else if (path === 'scripts/build-static-website.mjs') affected = ['static'];
    else if (path.startsWith('scripts/')) affected = ['release', 'preview'];
    else if (path.startsWith('deploy/')) affected = ['docker', 'preview'];
    else return all();
    for (const job of affected) selected[job] = true;
  }
  return selected;
}
function changedPaths(eventName, event, git = args => execFileSync('git', args, { encoding: 'utf8' })) {
  let range;
  if (eventName === 'pull_request') {
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(head)) throw new Error('Missing PR SHAs');
    range = `${base}...${head}`;
  } else if (eventName === 'push') {
    if (![event.before, event.after].every(sha => /^[a-f0-9]{40}$/.test(sha) && !/^0+$/.test(sha))) throw new Error('No usable push range');
    range = `${event.before}..${event.after}`;
  } else throw new Error('No diff for this event');
  // Disable rename detection so both old and new paths are checked; NUL keeps
  // spaces, newlines and shell metacharacters in filenames intact. No API cap.
  return git(['diff', '--name-only', '--no-renames', '-z', range, '--']).split('\0').filter(Boolean);
}
async function previewChangesRelevant({ github, context, pr }) {
  try {
    const files = await github.paginate(github.rest.pulls.listFiles, {
      ...context.repo, pull_number: pr.number, per_page: 100,
    });
    // GitHub caps PR file listings at 3000. An incomplete or racing listing
    // must never suppress a deployment.
    if (files.length !== pr.changed_files || files.length >= 3000) return true;
    const { data: current } = await github.rest.pulls.get({ ...context.repo, pull_number: pr.number });
    if (current.head.sha !== pr.head.sha) return true;
    return selectJobs(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))).preview;
  } catch {
    return true;
  }
}
if (require.main === module) {
  let selected;
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    selected = process.env.FORCE_FULL === 'true' ? all() : selectJobs(changedPaths(process.env.GITHUB_EVENT_NAME, event));
  } catch (error) {
    console.warn(`Cannot safely determine changes; running all jobs: ${error.message}`);
    selected = all();
  }
  for (const [job, value] of Object.entries(selected)) appendFileSync(process.env.GITHUB_OUTPUT, `${job}=${value}\n`);
  console.log(selected);
}
module.exports = { selectJobs, changedPaths, documentation, previewChangesRelevant };
