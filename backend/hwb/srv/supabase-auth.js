const cds = require('@sap/cds');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let client, keys;
function projectUrl() {
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_URL must be an HTTPS project origin');
  }
  return url.origin;
}
function adminClient() {
  return client ||= createClient(projectUrl(), process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function verifyAccessToken(token, keySet) {
  const { jwtVerify, createRemoteJWKSet } = await import('jose');
  const issuer = `${projectUrl()}/auth/v1`;
  keys ||= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, keySet || keys, {
    issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'],
    requiredClaims: ['sub', 'exp', 'iat', 'session_id'], maxTokenAge: '1h',
  });
  if (!UUID.test(payload.sub) || !UUID.test(payload.session_id) || payload.role !== 'authenticated' || payload.is_anonymous) {
    throw new Error('Unsupported user session');
  }
  return payload;
}
async function resolveIdentity(tx, subject) {
  const link = await tx.run(cds.ql.SELECT.one.from('hwb.db.AuthIdentities').where({ subject }));
  if (link?.revokedAt) throw new Error('Revoked account');
  // New accounts have a provider-qualified stable ID; legacy IDs only enter via reviewed mapping.
  return link?.internalId || `supabase|${subject}`;
}
async function authenticate(token, dependencies = {}) {
  const payload = await (dependencies.verify || verifyAccessToken)(token);
  const { data, error } = await (dependencies.client || adminClient()).auth.getUser(token);
  if (error || !data.user || data.user.id !== payload.sub) throw new Error('Invalid user');
  const db = dependencies.db || await cds.connect.to('db');
  // Revoked refresh sessions must stop existing access tokens too, across instances.
  const sessions = await db.run('SELECT id FROM auth.sessions WHERE id = $1 AND user_id = $2 AND (not_after IS NULL OR not_after > now())',
    [payload.session_id, payload.sub]);
  if (!sessions.length) throw new Error('Revoked session');
  const id = await resolveIdentity(db, payload.sub);
  if (await (dependencies.isDeleted || require('./account-privacy').isAccountDeleted)(id)) throw new Error('Deleted account');
  const user = data.user;
  return { ...user.user_metadata, sub: id, providerSubject: user.id,
    email: user.email, email_verified: !!user.email_confirmed_at,
    app_metadata: user.app_metadata, session_id: payload.session_id };
}
async function bearerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const claims = await authenticate(header.slice(7));
    req.supabaseClaims = claims;
    req.user = require('./auth-utils').buildCapUserFromClaims(claims);
    await require('./auth-utils').syncExternalUserIfNeeded(claims);
    return next();
  } catch {
    return res.status(401).json({ error: { code: '401', message: 'Unauthorized' } });
  }
}
module.exports = { UUID, projectUrl, adminClient, verifyAccessToken, resolveIdentity, authenticate, bearerAuth };
