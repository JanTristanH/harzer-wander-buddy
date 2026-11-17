const cds = require("@sap/cds");

const DEBUG = cds.debug("cds-supabase");
const EXTERNAL_USER_CACHE_TTL_MS = Number(process.env.EXTERNAL_USER_CACHE_TTL_MS || 5 * 60 * 1000);
const EXTERNAL_USER_SYNC_TTL_MS = Number(process.env.EXTERNAL_USER_SYNC_TTL_MS || 24 * 60 * 60 * 1000);
const externalUserClaimsCache = new Map();
const externalUserSyncCache = new Map();

class SupabaseUser extends cds.User {
  is(role) {
    DEBUG && DEBUG(`Requested role: ${role}`);
    return role === "any" || this._roles.includes(role);
  }
}

function getRoleClaimKey() { return 'app_metadata'; }
function getRolesFromClaims(claims = {}) {
  const roles = claims.app_metadata?.roles;
  return Array.isArray(roles) ? roles.filter(role => ['admin', 'moderator'].includes(role)) : [];
}

function buildCapUserFromClaims(claims = {}) {
  if (!claims.sub) {
    return null;
  }

  const capUser = {
    id: claims.sub,
    _roles: ["authenticated-user", ...getRolesFromClaims(claims)],
  };

  const user = new SupabaseUser(capUser);
  user.roles = capUser._roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});

  return user;
}

function pickProfileClaimsFromExternalUser(externalUser = {}) {
  if (!externalUser || !externalUser.ID) {
    return {};
  }

  return {
    email: externalUser.email,
    email_verified: externalUser.email_verified,
    family_name: externalUser.family_name,
    given_name: externalUser.given_name,
    name: externalUser.name,
    nickname: externalUser.nickname,
    picture: externalUser.picture,
    sid: externalUser.sid,
    sub: externalUser.sub || externalUser.ID,
    updated_at: externalUser.updated_at_iso_string,
  };
}

function setCachedExternalUserClaims(userId, claims = {}) {
  if (!userId) {
    return;
  }

  externalUserClaimsCache.set(userId, {
    claims,
    expiresAt: Date.now() + EXTERNAL_USER_CACHE_TTL_MS,
  });
}

async function upsertExternalUser(claims = {}) {
  if (!claims.sub) return false;
  try {
    const db = await cds.connect.to("db");
    const entry = await db.tx(async tx => {
      const { ExternalUsers } = db.entities;
      // Serialize profile synchronisation with deletion of an existing account.
      const existingUser = await tx.run(cds.ql.SELECT.one.from(ExternalUsers)
        .where({ ID: claims.sub }).forUpdate());
      const deleted = await tx.run(cds.ql.SELECT.one.from('hwb.db.AccountDeletions')
        .where({ subjectHash: require('./account-privacy').subjectHash(claims.sub) }));
      if (deleted) return null;
      const entry = {
        ID: claims.sub,
        email: claims.email ?? existingUser?.email ?? null,
        email_verified: claims.email_verified ?? existingUser?.email_verified ?? null,
        family_name: claims.family_name ?? existingUser?.family_name ?? null,
        given_name: claims.given_name ?? existingUser?.given_name ?? null,
        name: existingUser?.name ?? claims.name ?? claims.nickname ?? claims.sub,
        nickname: claims.nickname ?? existingUser?.nickname ?? null,
        picture: existingUser?.contentRestricted ? null : existingUser?.picture ?? claims.picture ?? null,
        sid: claims.sid ?? existingUser?.sid ?? null,
        sub: claims.sub,
        onboardingCompleted: existingUser?.onboardingCompleted ?? false,
        updated_at_iso_string: claims.updated_at ?? existingUser?.updated_at_iso_string ?? null,
      };
      if (existingUser) await tx.update(ExternalUsers).set(entry).where({ ID: claims.sub });
      else await tx.create(ExternalUsers).entries(entry);
      return entry;
    });
    if (!entry) return false;
    setCachedExternalUserClaims(claims.sub, pickProfileClaimsFromExternalUser(entry));
    return true;
  } catch {
    console.error("External user synchronisation failed");
    return false;
  }
}

async function syncExternalUserIfNeeded(claims = {}) {
  if (!claims.sub) {
    return;
  }

  const lastSyncAt = externalUserSyncCache.get(claims.sub) || 0;
  if (Date.now() - lastSyncAt < EXTERNAL_USER_SYNC_TTL_MS) {
    return;
  }

  const synced = await upsertExternalUser(claims);
  if (synced) {
    externalUserSyncCache.set(claims.sub, Date.now());
  }
}

function clearExternalUserCaches(id) {
  externalUserClaimsCache.delete(id);
  externalUserSyncCache.delete(id);
}

module.exports = {
  clearExternalUserCaches,
  SupabaseUser,
  buildCapUserFromClaims,
  getRoleClaimKey,
  getRolesFromClaims,
  syncExternalUserIfNeeded,
  upsertExternalUser,
};
