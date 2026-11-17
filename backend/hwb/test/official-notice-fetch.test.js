const assert = require('node:assert/strict');
const { test } = require('node:test');
const { officialNoticeAgent } = require('../srv/official-notice-fetch');

test('official imports honor HTTPS proxies and NO_PROXY exclusions', () => {
  const keys = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy',
    'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy',
    'npm_config_https_proxy', 'npm_config_proxy', 'npm_config_no_proxy'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(officialNoticeAgent(), undefined);
    process.env.HTTPS_PROXY = 'http://127.0.0.1:12345';
    const agent = officialNoticeAgent();
    assert.equal(agent.proxy.hostname, '127.0.0.1');
    assert.equal(agent.proxy.port, '12345');
    process.env.NO_PROXY = '.harzer-wandernadel.de';
    assert.equal(officialNoticeAgent(), undefined);
    process.env.NO_PROXY = 'example.org';
    assert.ok(officialNoticeAgent());
    process.env.https_proxy = 'http://127.0.0.1:23456';
    assert.equal(officialNoticeAgent().proxy.port, '23456');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
