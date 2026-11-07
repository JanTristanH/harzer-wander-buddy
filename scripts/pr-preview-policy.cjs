const START = '<!-- hwb-pr-preview:start -->';
const END = '<!-- hwb-pr-preview:end -->';

function previewServiceName(pr) {
  if (!/^[1-9]\d*$/.test(String(pr))) throw new Error('Invalid PR number');
  return `hwb-pr-${pr}`;
}

function ownedPreviewServices(services, pr) {
  const expected = previewServiceName(pr);
  if (!Array.isArray(services)) throw new Error('Invalid Cloud Run service list');
  const owned = [];
  for (const service of services) {
    const name = service.metadata?.name || service.name?.split('/').pop();
    const labels = service.metadata?.labels || service.labels || {};
    const managed = labels['managed-by'] === 'hwb-pr-preview' && String(labels.pr) === String(pr);
    if (name === expected && !managed) throw new Error(`Refusing to replace unmanaged service ${name}`);
    if (!managed) continue;
    if (name !== expected && !new RegExp(`^${expected}-[a-f0-9]{7,40}$`).test(name || '')) {
      throw new Error('Unexpected service name carrying this PR label; inspect manually');
    }
    owned.push(name);
  }
  return [...new Set(owned)];
}

function previewServicesToDelete(services, pr, keepStable = false) {
  return ownedPreviewServices(services, pr).filter(name => !keepStable || name !== previewServiceName(pr));
}

function previewAction({ pr, eventName, action, label, requestedAction = 'deploy' }) {
  if (pr.state === 'closed') return 'remove';
  if (eventName === 'workflow_dispatch') {
    if (!['deploy', 'remove'].includes(requestedAction)) throw new Error('Invalid preview action');
    return requestedAction;
  }
  const enabled = pr.labels.some(item => item.name === 'preview');
  if (action === 'unlabeled' && label === 'preview' && !enabled) return 'remove';
  return enabled ? 'deploy' : 'skip';
}

function updateBody(body, section) {
  body ||= '';
  const start = body.indexOf(START);
  const end = body.indexOf(END, start);
  const block = `${START}\n${section}\n${END}`;
  if (start >= 0 && end >= start) return body.slice(0, start) + block + body.slice(end + END.length);
  // Never append another block when existing markers were edited accidentally.
  if (start >= 0 || body.includes(END)) throw new Error('Incomplete PR preview markers');
  return `${body.trimEnd()}${body.trim() ? '\n\n' : ''}${block}`;
}

function previewSection({ sha, url, apkUrl, runUrl, active, removed, androidPending = false }) {
  if (removed) return '### PR-Preview\n\nPreview deaktiviert; die zugehörigen Cloud-Run-Dienste wurden entfernt.\n\nMit dem Label `preview` erneut starten.';
  return [
    '### PR-Preview', '',
    `- Commit: \`${sha}\``,
    active ? `- [Live-Web-App](${url}/app/rnweb)` : '- Live-Web-App: nicht freigegeben (Aktivierung oder Prüfung nicht erfolgreich).',
    apkUrl ? `- [Android-APK + Backend-Manifest herunterladen](${apkUrl}) (GitHub-Anmeldung; ZIP entpacken; 14 Tage verfügbar)` : androidPending ? '- Android-APK: Build läuft; der Download-Link folgt nach Abschluss.' : '- Android-APK: Build nicht erfolgreich; siehe Workflow.',
    `- [Workflow und Logs](${runUrl})`, '',
    'Ein Dienst und eine feste URL pro PR; das Backend wird bei neuen Builds ersetzt. Automatische Updates nur mit Label `preview`. Label entfernen zum Aufräumen. Manuelle Starts sind ebenfalls möglich.',
  ].join('\n');
}

async function publish({ github, owner, repo, number, sha, section, removed = false, manual = false }) {
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  // Superseded builds must never replace the current PR's links.
  if (!removed && (pr.state !== 'open' || pr.head.sha !== sha)) return false;
  if (!removed && !manual && !pr.labels.some(item => item.name === 'preview')) return false;
  if (removed && !manual && pr.state === 'open' && pr.labels.some(item => item.name === 'preview')) return false;
  const body = updateBody(pr.body, section);
  if (body !== pr.body) await github.rest.pulls.update({ owner, repo, pull_number: number, body });
  return true;
}

module.exports = { previewAction, updateBody, previewSection, publish, previewServiceName, ownedPreviewServices, previewServicesToDelete };
