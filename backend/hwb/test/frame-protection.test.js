const assert = require('node:assert/strict');
const { test } = require('node:test');
const cds = require('@sap/cds/lib');

cds.env.requires.auth = { kind: 'mocked' };
const server = cds.test('serve', 'all', '--in-memory');

test('framing protection covers static files, SPA fallback, CAP and errors', async () => {
  const requests = [
    // Public static files are served before authentication.
    ['/app/pbc/manifest.json', 'GET'],
    ['/app/frontendhwb/webapp/index.html', 'GET'],
    // Exercise both direct static paths and the extensionless SPA fallback.
    ['/app/rnweb/index.html', 'GET'],
    ['/app/rnweb/stamps/frame-protection-test', 'GET'],
    ['/app/rnweb/stamps/frame-protection-test', 'HEAD'],
    ['/odata/v4/public/$metadata', 'GET'],
    ['/does-not-exist.html', 'GET'],
  ];

  for (const [path, method] of requests) {
    const response = await fetch(`${server.url}${path}`, {
      method,
      headers: { accept: 'text/html' },
    });

    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', path);
    if (response.status < 400) {
      assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'self'", path);
    }
    // Release web assets are optional in a source-only checkout; error responses
    // must retain X-Frame-Options too (Express owns the CSP on error pages).
    if (!path.startsWith('/app/rnweb/') && path !== '/does-not-exist.html') {
      assert.equal(response.status, 200, path);
    }
    await response.arrayBuffer();
  }
});
