const fs = require('node:fs');
const path = require('node:path');

/** Match Expo's flat route HTML before express.static redirects matching folders. */
function resolveRouteHtml(root, requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..' || segment === '.' || segment.includes('\0') || segment.includes('\\'))) return null;
  let directory = root;
  if (!segments.length) return fs.existsSync(path.join(root, 'index.html')) ? path.join(root, 'index.html') : null;

  for (let i = 0; i < segments.length; i++) {
    if (!fs.existsSync(directory)) return null;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const last = i === segments.length - 1;
    if (last) {
      const exact = entries.find((entry) => entry.isFile() && entry.name === `${segments[i]}.html`);
      if (exact) return path.join(directory, exact.name);
      const dynamic = entries.find((entry) => entry.isFile() && /^\[[^\]]+\]\.html$/.test(entry.name));
      if (dynamic) return path.join(directory, dynamic.name);
      return null;
    }
    const next = entries.find((entry) => entry.isDirectory() && entry.name === segments[i])
      || entries.find((entry) => entry.isDirectory() && /^\[[^\]]+\]$/.test(entry.name));
    if (!next) return null;
    directory = path.join(directory, next.name);
  }
  return null;
}

function routeHtml(root) {
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !(req.headers.accept || '').includes('text/html')) return next();
    const file = resolveRouteHtml(root, req.path);
    if (!file) return next();
    return res.sendFile(file);
  };
}

module.exports = { resolveRouteHtml, routeHtml };
