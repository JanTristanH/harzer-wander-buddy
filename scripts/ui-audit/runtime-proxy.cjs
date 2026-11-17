// Local audit launcher only: keep Node's Auth0/JWK fetches on the session proxy.
// Uses the existing Expo toolchain's undici; preserves request headers and CA trust.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  const { createRequire } = require('node:module');
  const path = require('node:path');
  const requireApp = createRequire(path.join(__dirname, '../../app/package.json'));
  const { EnvHttpProxyAgent, setGlobalDispatcher } = requireApp('undici');
  setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy: 'localhost,127.0.0.1,10.0.2.2' }));
}
