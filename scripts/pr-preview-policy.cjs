const START = '<!-- hwb-pr-preview:start -->';
const END = '<!-- hwb-pr-preview:end -->';

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

function previewSection({ sha, url, apkUrl, runUrl, active, removed }) {
  if (removed) return '### PR-Preview\n\nPreview deaktiviert; die zugehörigen Cloud-Run-Dienste wurden entfernt.\n\nMit dem Label `preview` erneut starten.';
  return [
    '### PR-Preview', '',
    `- Commit: \`${sha}\``,
    active ? `- [Live-Web-App](${url}/app/rnweb)` : '- Live-Web-App: nicht freigegeben (Aktivierung, Prüfung oder APK-Build nicht erfolgreich).',
    apkUrl ? `- [Android-APK + Backend-Manifest herunterladen](${apkUrl}) (GitHub-Anmeldung; ZIP entpacken; 14 Tage verfügbar)` : '- Android-APK: Build nicht erfolgreich; siehe Workflow.',
    `- [Workflow und Logs](${runUrl})`, '',
    'Automatische Updates nur mit Label `preview`. Label entfernen zum Aufräumen. Manuelle Starts sind ebenfalls möglich.',
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

module.exports = { previewAction, updateBody, previewSection, publish };
