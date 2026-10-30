const cds = require('@sap/cds');
const { createHash } = require('node:crypto');
const fetch = require('node-fetch');
const { buffer } = require('node:stream/consumers');
const subjectHash = id => createHash('sha256').update(id).digest('hex');

async function isAccountDeleted(id) {
  if (!id) return false;
  const db = await cds.connect.to('db');
  return Boolean(await db.run(cds.ql.SELECT.one.from('hwb.db.AccountDeletions')
    .where({ subjectHash: subjectHash(id) })));
}

async function collectMyData(tx, id) {
  const { SELECT } = cds.ql;
  const result = { exportedAt: new Date().toISOString(), profile: null };
  result.profile = await tx.run(SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }));
  for (const name of ['Stampings', 'StampNotes', 'Tours', 'Attachments_local', 'RouteCalculationRequest', 'PlaceSearchCache']) {
    result[name] = await tx.run(SELECT.from(`hwb.db.${name}`).where({ createdBy: id }));
  }
  result.Friendships = await tx.run(SELECT.from('hwb.db.Friendships')
    .where({ fromUser_ID: id }).or({ toUser_ID: id }));
  result.PendingFriendshipRequests = await tx.run(SELECT.from('hwb.db.PendingFriendshipRequests')
    .where({ fromUser_ID: id }).or({ toUser_ID: id }));
  result.UserBlocks = await tx.run(SELECT.from('hwb.db.UserBlocks').where({ fromUser: id }));
  result.ContentReports = await tx.run(SELECT.from('hwb.db.ContentReports').where({ createdBy: id }));
  const tours = result.Tours.map(tour => tour.ID);
  result.Tour2TravelTime = tours.length ? await tx.run(SELECT.from('hwb.db.Tour2TravelTime')
    .where({ tour_ID: { in: tours } })) : [];
  // Preserve uploaded image bytes in a portable JSON encoding.
  for (const attachment of result.Attachments_local) {
    // CAP excludes media fields from SELECT *. Read each blob explicitly and
    // consume driver streams before JSON serialization / transaction completion.
    const image = await tx.run(SELECT.one.from('hwb.db.Attachments_local')
      .columns('content').where({ ID: attachment.ID, createdBy: id }));
    if (image?.content != null) {
      const bytes = Buffer.isBuffer(image.content) ? image.content : await buffer(image.content);
      attachment.content = bytes.toString('base64');
    } else attachment.content = null;
  }
  return result;
}

async function eraseMyData(tx, id, externalIdentity = true) {
  const { SELECT, DELETE, INSERT, UPDATE } = cds.ql;
  await tx.run(SELECT.one.from('hwb.db.ExternalUsers').where({ ID: id }).forUpdate());
  const existing = await tx.run(SELECT.one.from('hwb.db.AccountDeletions')
    .where({ subjectHash: subjectHash(id) }));
  if (!existing) await tx.run(INSERT.into('hwb.db.AccountDeletions').entries({
    subjectHash: subjectHash(id), pendingSubject: externalIdentity ? id : null,
    requestedAt: new Date().toISOString(), completedAt: externalIdentity ? null : new Date().toISOString()
  }));
  const tours = await tx.run(SELECT.from('hwb.db.Tours').columns('ID').where({ createdBy: id }));
  if (tours.length) await tx.run(DELETE.from('hwb.db.Tour2TravelTime')
    .where({ tour_ID: { in: tours.map(tour => tour.ID) } }));
  await tx.run(DELETE.from('hwb.db.PendingFriendshipRequests').where({ fromUser_ID: id }).or({ toUser_ID: id }));
  await tx.run(DELETE.from('hwb.db.Friendships').where({ fromUser_ID: id }).or({ toUser_ID: id }).or({ createdBy: id }));
  for (const name of ['Stampings', 'StampNotes', 'Tours', 'Attachments_local', 'RouteCalculationRequest']) {
    await tx.run(DELETE.from(`hwb.db.${name}`).where({ createdBy: id }));
  }
  // Scrub audit fields in shared/admin records changed by the deleted user.
  for (const name of ['StampNotes', 'Tours', 'Attachments_local', 'PlaceSearchCache']) {
    await tx.run(UPDATE(`hwb.db.${name}`).set({ modifiedBy: null }).where({ modifiedBy: id }));
  }
  await tx.run(DELETE.from('hwb.db.UserBlocks').where({ fromUser: id }).or({ toUser: id }));
  await tx.run(DELETE.from('hwb.db.ContentReports').where({ createdBy: id }).or({ targetUser: id }));
  await tx.run(DELETE.from('hwb.db.PlaceSearchCache').where({ createdBy: id }));
  await tx.run(DELETE.from('hwb.db.ExternalUsers').where({ ID: id }));
}

function deletionConfigured() {
  return Boolean(process.env.AUTH0_ACCOUNT_DELETION_MODE === 'dedicated-tenant' &&
    process.env.ISSUER_BASE_URL?.startsWith('https://') &&
    process.env.AUTH0_MANAGEMENT_CLIENT_ID && process.env.AUTH0_MANAGEMENT_CLIENT_SECRET);
}

async function deleteAuth0Identity(id) {
  if (!deletionConfigured()) throw new Error('Auth0 account deletion is not configured');
  const issuer = new URL(process.env.ISSUER_BASE_URL).origin;
  const tokenResponse = await fetch(`${issuer}/oauth/token`, {
    method: 'POST', timeout: 15000, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials',
      client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
      client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
      audience: `${issuer}/api/v2/`, scope: 'delete:users' })
  });
  if (!tokenResponse.ok) throw new Error(`Auth0 management authentication failed (${tokenResponse.status})`);
  const { access_token } = await tokenResponse.json();
  if (!access_token) throw new Error('Auth0 management token missing');
  const response = await fetch(`${issuer}/api/v2/users/${encodeURIComponent(id)}`, {
    method: 'DELETE', timeout: 15000, headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!response.ok && response.status !== 404) throw new Error(`Auth0 deletion failed (${response.status})`);
}

let processing = false;
async function processAccountDeletions(deleteIdentity = deleteAuth0Identity) {
  if (processing) return { skipped: true, processed: 0, failed: 0, remaining: null };
  processing = true;
  try {
    const db = await cds.connect.to('db');
    const { SELECT, UPDATE, DELETE } = cds.ql;
    // Enforce physical cache expiry even without another search, an empty
    // deletion queue, or a failing identity provider. Undated entries are unusable.
    await db.run(DELETE.from('hwb.db.PlaceSearchCache')
      .where('expiresAt <=', new Date().toISOString()).or('expiresAt is null'));
    // Retry the least recently attempted entries first. Persistent failures must
    // not monopolize every batch. Existing rows need no timestamp backfill.
    const pending = await db.run(SELECT.from('hwb.db.AccountDeletions')
      .where('pendingSubject is not null')
      .orderBy`coalesce(lastAttemptAt, requestedAt) asc, subjectHash asc`.limit(20));
    let failed = 0;
    for (const entry of pending) {
      try {
        await db.run(UPDATE('hwb.db.AccountDeletions')
          .set({ lastAttemptAt: new Date().toISOString() }).where({ subjectHash: entry.subjectHash }));
        await deleteIdentity(entry.pendingSubject);
        await db.run(UPDATE('hwb.db.AccountDeletions').set({ pendingSubject: null,
          completedAt: new Date().toISOString() }).where({ subjectHash: entry.subjectHash }));
      } catch {
        failed += 1;
        // No subject, profile, token or provider response is written to logs.
        console.error('[account-deletion] Identity deletion pending; retry scheduled.');
      }
    }
    await db.run(DELETE.from('hwb.db.RouteCalculationRequest').where('createdAt <',
      new Date(Date.now() - 86400000).toISOString()));
    // Accepted access tokens and OIDC sessions are limited to 24 hours.
    // Keep replay protection 30 days AFTER completion; never expire pending jobs.
    await db.run(DELETE.from('hwb.db.AccountDeletions').where('completedAt <',
      new Date(Date.now() - 30 * 86400000).toISOString()));
    const remaining = await db.run(SELECT.one.from('hwb.db.AccountDeletions')
      .columns('count(*) as total').where('pendingSubject is not null'));
    return { processed: pending.length - failed, failed, remaining: Number(remaining?.total || 0) };
  } finally { processing = false; }
}

function registerAccountPrivacy(service) {
  service.before('*', async req => {
    if (req.user?.id && await isAccountDeleted(req.user.id)) req.reject(401, 'Dieses Konto wurde gelöscht.');
  });
  service.on('exportMyData', async req => JSON.stringify(await collectMyData(cds.tx(req), req.user.id)));
  service.on('deleteMyAccount', async req => {
    if (req.data.confirmation !== 'DELETE') return req.reject(400, 'Bitte bestätige die endgültige Kontolöschung.');
    const externalIdentity = !cds.env.profiles.includes('dev-basic') && cds.env.requires.auth?.kind !== 'mocked';
    if (externalIdentity && !deletionConfigured()) return req.reject(503,
      'Die Kontolöschung ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.');
    await eraseMyData(cds.tx(req), req.user.id, externalIdentity);
    require('./image-cache').invalidateImageCachesAfterCommit(req);
    const { clearExternalUserCaches } = require('./auth-utils');
    clearExternalUserCaches(req.user.id);
    req.on('succeeded', () => { void processAccountDeletions().catch(() => {
      console.error('[account-deletion] Queue processing failed; retry scheduled.');
    }); });
    return externalIdentity ? 'Deine App-Daten wurden gelöscht. Die Löschung des Anmeldekontos wird verarbeitet.' : 'Deine App-Daten wurden gelöscht.';
  });
}

function startAccountDeletionWorker() {
  const run = () => { void processAccountDeletions().catch(() => {
    console.error('[account-deletion] Queue processing failed; retry scheduled.');
  }); };
  run();
  const interval = setInterval(run, 60000);
  interval.unref();
}
module.exports = { subjectHash, isAccountDeleted, collectMyData, eraseMyData,
  deletionConfigured, deleteAuth0Identity, processAccountDeletions, registerAccountPrivacy, startAccountDeletionWorker };
