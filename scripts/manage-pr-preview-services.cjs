const { execFileSync } = require('node:child_process');
const { previewServiceName, ownedPreviewServices, previewServicesToDelete } = require('./pr-preview-policy.cjs');

function manageServices(mode, env = process.env, execute = execFileSync) {
  if (!['migrate', 'remove', 'verify'].includes(mode)) throw new Error('Use migrate, remove or verify');
  const { PREVIEW_PR: pr, PROJECT_ID: project, REGION: region } = env;
  const stable = previewServiceName(pr);
  if (!project || !region) throw new Error('Set PROJECT_ID and REGION');
  const scope = ['--project', project, '--region', region];
  // List the region so a collision with an unmanaged stable name is detected too.
  const list = () => JSON.parse(execute('gcloud', ['run', 'services', 'list', ...scope, '--format=json'], { encoding: 'utf8' }));
  const services = list();
  if (mode !== 'verify') {
    // Validate the complete selection before deleting any service.
    const deletions = previewServicesToDelete(services, pr, mode === 'migrate');
    for (const name of deletions) {
      console.log(`Removing obsolete PR #${pr} service: ${name}`);
      execute('gcloud', ['run', 'services', 'delete', name, ...scope, '--quiet'], { stdio: 'inherit' });
    }
  }
  const remaining = ownedPreviewServices(mode === 'verify' ? services : list(), pr);
  if (mode === 'remove' && remaining.length) throw new Error('PR services remain after cleanup');
  if (mode === 'migrate' && remaining.some(name => name !== stable)) throw new Error('Legacy PR services remain');
  if (mode === 'verify' && (remaining.length !== 1 || remaining[0] !== stable)) throw new Error('Expected exactly one stable service for this PR');
  console.log(`Managed services for PR #${pr}: ${remaining.length}${remaining.length ? ` (${remaining.join(', ')})` : ''}`);
  return remaining;
}

if (require.main === module) {
  try { manageServices(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { manageServices };
