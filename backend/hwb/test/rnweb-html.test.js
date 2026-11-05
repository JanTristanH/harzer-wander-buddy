const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { routeHtml, resolveRouteHtml } = require('../srv/rnweb-html');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hwb-route-html-'));
for (const file of ['index.html', 'tours.html', 'profile.html', 'tours/[id].html', 'tours/[id]/edit.html', 'profile/[userId].html']) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), file);
}
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('serves the matching export even when a route also has a directory', async () => {
  const app = express();
  app.use('/app/rnweb', routeHtml(root));
  app.use('/app/rnweb', express.static(root, { extensions: ['html'] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/app/rnweb`;
    for (const [url, expected] of [['/tours', 'tours.html'], ['/tours/', 'tours.html'], ['/profile', 'profile.html'], ['/tours/123', 'tours/[id].html'], ['/tours/123/edit', 'tours/[id]/edit.html']]) {
      const response = await fetch(base + url, { headers: { Accept: 'text/html' }, redirect: 'manual' });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), expected);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('leaves assets, unknown paths and invalid paths to the next handler', () => {
  assert.equal(resolveRouteHtml(root, '/_expo/missing.js'), null);
  assert.equal(resolveRouteHtml(root, '/missing'), null);
  assert.equal(resolveRouteHtml(root, '/%2e%2e/profile'), null);
  assert.equal(resolveRouteHtml(root, '/%00'), null);
  assert.equal(resolveRouteHtml(root, '/%broken'), null);
});
