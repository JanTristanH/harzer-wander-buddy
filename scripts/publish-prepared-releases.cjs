const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function releaseNotes(changelog, version) {
  const sections = changelog.split(/^## /m).slice(1);
  const section = sections.find(value => {
    const heading = value.split('\n')[0];
    return heading.startsWith(`[${version}]`) || new RegExp(`^${version.replaceAll('.', '\\.')}($|\\s)`).test(heading);
  });
  if (!section || !section.includes('\n')) return undefined;
  return section.slice(section.indexOf('\n') + 1).trim();
}

function validateVersion(path, version, pkg, lock) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid stable release version for ${path}: ${version}`);
  if (pkg.version !== version || lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error(`Manifest/package/lock versions disagree for ${path}`);
  }
}

function loadPlan(root = '.', runGit = git) {
  const read = path => JSON.parse(fs.readFileSync(`${root}/${path}`, 'utf8'));
  const config = read('release-please-config.json');
  const manifest = read('.release-please-manifest.json');
  return Object.entries(config.packages).map(([path, settings]) => {
    const version = manifest[path];
    validateVersion(path, version, read(`${path}/package.json`), read(`${path}/package-lock.json`));
    const changelogPath = `${root}/${path}/CHANGELOG.md`;
    const notes = releaseNotes(fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '', version);
    if (!notes) {
      const baseline = JSON.parse(runGit('show', `${config['bootstrap-sha']}:${path}/package.json`)).version;
      if (version !== baseline) throw new Error(`Missing release notes for ${path} ${version}; merge its preparation PR first`);
      return null; // Existing, untagged versions at migration are not new releases.
    }
    const tag = `${settings.component}-v${version}`;
    let tagSha;
    try { tagSha = runGit('rev-parse', '--verify', `refs/tags/${tag}^{commit}`); }
    catch (error) { if (error.status !== 128) throw error; }
    if (tagSha) runGit('merge-base', '--is-ancestor', tagSha, 'HEAD');
    return { path, version, tag, tagSha, notes };
  }).filter(Boolean);
}

async function publish(plan, { github, context, core, runGit = git }) {
  const repo = context.repo;
  let appReleased = false;
  let appSha = '';
  // loadPlan validates all components before any remote mutation happens.
  for (const item of plan) {
    const sha = item.tagSha || context.sha;
    let existing;
    try { existing = (await github.rest.repos.getReleaseByTag({ ...repo, tag: item.tag })).data; }
    catch (error) { if (error.status !== 404) throw error; }
    if (existing && !item.tagSha) throw new Error(`Release ${item.tag} exists but its tag was not fetched`);
    if (!item.tagSha) {
      await github.rest.git.createRef({ ...repo, ref: `refs/tags/${item.tag}`, sha });
    }
    if (!existing) {
      await github.rest.repos.createRelease({
        ...repo, tag_name: item.tag, target_commitish: sha,
        name: item.tag, body: item.notes, draft: false, prerelease: false,
        make_latest: 'false',
      });
    } else if (existing.draft || existing.prerelease) {
      throw new Error(`${item.tag} is not a published stable release`);
    }
    core.info(`${item.tag}: ${existing ? 'already published' : 'published'} at ${sha}`);
    // A rerun of the publishing commit can retry the native build job. Later
    // documentation/main commits must not rebuild an already published app.
    if (item.path === 'app' && (!existing || sha === context.sha)) {
      appReleased = true;
      appSha = sha;
    }
    item.tagSha = sha;
  }

  // Release Please refuses to prepare another release while a merged PR is
  // still marked pending. Only acknowledge PRs whose commits reached main and
  // whose bumped components now have published releases.
  const prs = await github.paginate(github.rest.pulls.list, { ...repo, base: 'develop', state: 'closed', per_page: 100 });
  for (const pr of prs) {
    if (!pr.merged_at || !pr.labels.some(label => label.name === 'autorelease: pending')) continue;
    try { runGit('merge-base', '--is-ancestor', pr.merge_commit_sha, 'HEAD'); }
    catch (error) { if (error.status === 1 || error.status === 128) continue; throw error; }
    const prepared = JSON.parse(runGit('show', `${pr.merge_commit_sha}:.release-please-manifest.json`));
    const previous = JSON.parse(runGit('show', `${pr.merge_commit_sha}^:.release-please-manifest.json`));
    const changed = Object.keys(prepared).filter(path => prepared[path] !== previous[path]);
    if (!changed.length) continue;
    let complete = true;
    for (const path of changed) {
      const item = plan.find(value => value.path === path && value.version === prepared[path]);
      if (!item) { complete = false; break; }
      // Successful publish above is required before removing the pending label.
    }
    if (!complete) continue;
    await github.rest.issues.addLabels({ ...repo, issue_number: pr.number, labels: ['autorelease: tagged'] });
    await github.rest.issues.removeLabel({ ...repo, issue_number: pr.number, name: 'autorelease: pending' });
  }
  core.setOutput('app_released', String(appReleased));
  core.setOutput('app_sha', appSha);
}

module.exports = { loadPlan, publish, releaseNotes, validateVersion };
