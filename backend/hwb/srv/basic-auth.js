const cds = require('@sap/cds');
const { timingSafeEqual } = require('node:crypto');
const { syncExternalUserIfNeeded } = require('./auth-utils');

// Explicit development profile only; production continues to use Auth0.
module.exports = function createBasicAuth(options) {
  if (cds.env.profiles.includes('production')) {
    throw new Error('Local Basic authentication cannot be used in production');
  }
  return async function basicAuth(req, res, next) {
    const header = req.headers.authorization || '';
    if (!/^Basic /i.test(header)) return next();
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const id = decoded.slice(0, separator);
    const password = Buffer.from(decoded.slice(separator + 1));
    const account = separator > 0 && Object.hasOwn(options.users || {}, id) && options.users[id];
    const expected = Buffer.from(account?.password || '');
    if (!account || !expected.length || password.length !== expected.length || !timingSafeEqual(password, expected)) {
      // JSON response avoids a browser-native Basic challenge over the app form.
      return res.status(401).json({ error: { code: '401', message: 'Unauthorized' } });
    }
    if (await require('./account-privacy').isAccountDeleted(id)) {
      return res.status(401).json({ error: { code: '401', message: 'Dieses Konto wurde gelöscht.' } });
    }
    const roles = ['authenticated-user', ...(account.roles || [])];
    req.user = new cds.User({ id, roles, _roles: roles });
    if (cds.context) cds.context.user = req.user;
    await syncExternalUserIfNeeded({ sub: id, email: id, name: id });
    next();
  };
};
