const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { getProxyForUrl } = require('proxy-from-env');
const { SOURCE_URL } = require('./official-notices');

function officialNoticeAgent() {
  const proxy = getProxyForUrl(SOURCE_URL);
  return proxy ? new HttpsProxyAgent(proxy) : undefined;
}

function fetchOfficialNoticePage() {
  return fetch(SOURCE_URL, {
    agent: officialNoticeAgent(),
    timeout: 15000,
    size: 2 * 1024 * 1024,
    redirect: 'error',
  });
}

module.exports = { officialNoticeAgent, fetchOfficialNoticePage };
