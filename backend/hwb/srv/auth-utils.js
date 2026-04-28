const cds = require("@sap/cds");
const fetch = require("node-fetch");

const DEBUG = cds.debug("cds-auth0");
const EXTERNAL_USER_CACHE_TTL_MS = Number(process.env.EXTERNAL_USER_CACHE_TTL_MS || 5 * 60 * 1000);
const EXTERNAL_USER_SYNC_TTL_MS = Number(process.env.EXTERNAL_USER_SYNC_TTL_MS || 24 * 60 * 60 * 1000);
const externalUserClaimsCache = new Map();
const externalUserSyncCache = new Map();

class Auth0User extends cds.User {
  is(role) {
    DEBUG && DEBUG(`Requested role: ${role}`);
    return role === "any" || this._roles.includes(role);
  }
}

function getRoleClaimKey() {
  return process.env.AUTH0_ROLES_CLAIM || `${process.env.AUDIENCE}roles`;
}

function getRolesFromClaims(claims = {}) {
  const roleClaim = claims[getRoleClaimKey()];
  return Array.isArray(roleClaim) ? roleClaim : [];
}

function buildCapUserFromClaims(claims = {}) {
  if (!claims.sub) {
    return null;
  }

  const capUser = {
    id: claims.sub,
    _roles: ["authenticated-user", ...getRolesFromClaims(claims)],
  };

  const user = new Auth0User(capUser);
  user.roles = capUser._roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});

  return user;
}

function hasProfileClaims(claims = {}) {
  return Boolean(
    claims.email ||
      claims.family_name ||
      claims.given_name ||
      claims.name ||
      claims.nickname ||
      claims.picture
  );
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

function getCachedExternalUserClaims(userId) {
  const cached = externalUserClaimsCache.get(userId);
  if (!cached || cached.expiresAt <= Date.now()) {
    externalUserClaimsCache.delete(userId);
    return null;
  }

  return cached.claims;
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

async function enrichClaimsFromExternalUser(claims = {}) {
  if (!claims.sub) {
    return claims;
  }

  const cachedClaims = getCachedExternalUserClaims(claims.sub);
  if (cachedClaims) {
    return {
      ...cachedClaims,
      ...claims,
    };
  }

  try {
    const db = await cds.connect.to("db");
    const { ExternalUsers } = db.entities;
    const [externalUser] = await db.read(ExternalUsers).where({ ID: claims.sub });
    if (!externalUser) {
      return claims;
    }

    const dbClaims = pickProfileClaimsFromExternalUser(externalUser);
    setCachedExternalUserClaims(claims.sub, dbClaims);
    return {
      ...dbClaims,
      ...claims,
    };
  } catch (error) {
    DEBUG && DEBUG(`ExternalUsers lookup failed: ${error.message}`);
    return claims;
  }
}

async function enrichClaimsWithUserInfo(accessToken, claims = {}) {
  if (!accessToken || !claims.sub) {
    return claims;
  }

  if (hasProfileClaims(claims)) {
    return claims;
  }

  let enrichedClaims = await enrichClaimsFromExternalUser(claims);
  if (hasProfileClaims(enrichedClaims)) {
    return enrichedClaims;
  }

  const issuerBaseUrl = process.env.ISSUER_BASE_URL?.replace(/\/$/, "");
  if (!issuerBaseUrl) {
    return enrichedClaims;
  }

  try {
    const response = await fetch(`${issuerBaseUrl}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      DEBUG && DEBUG(`userinfo lookup failed with status ${response.status}`);
      return enrichedClaims;
    }

    const userInfo = await response.json();
    const userInfoClaims = {
      ...enrichedClaims,
      email: enrichedClaims.email ?? userInfo.email,
      email_verified: enrichedClaims.email_verified ?? userInfo.email_verified,
      family_name: enrichedClaims.family_name ?? userInfo.family_name,
      given_name: enrichedClaims.given_name ?? userInfo.given_name,
      name: enrichedClaims.name ?? userInfo.name,
      nickname: enrichedClaims.nickname ?? userInfo.nickname,
      picture: enrichedClaims.picture ?? userInfo.picture,
      sid: enrichedClaims.sid ?? userInfo.sid,
      sub: enrichedClaims.sub ?? userInfo.sub,
      updated_at: enrichedClaims.updated_at ?? userInfo.updated_at,
    };
    setCachedExternalUserClaims(claims.sub, userInfoClaims);
    return userInfoClaims;
  } catch (error) {
    DEBUG && DEBUG(`userinfo lookup failed: ${error.message}`);
    return enrichedClaims;
  }
}

async function upsertExternalUser(claims = {}) {
  if (!claims.sub) {
    return false;
  }

  try {
    const db = await cds.connect.to("db");
    const { ExternalUsers } = db.entities;
    const [existingUser] = await db.read(ExternalUsers).where({ ID: claims.sub });

    const entry = {
      ID: claims.sub,
      email: claims.email ?? existingUser?.email ?? null,
      email_verified: claims.email_verified ?? existingUser?.email_verified ?? null,
      family_name: claims.family_name ?? existingUser?.family_name ?? null,
      given_name: claims.given_name ?? existingUser?.given_name ?? null,
      name: existingUser?.name ?? claims.name ?? claims.nickname ?? existingUser?.nickname ?? claims.sub,
      nickname: claims.nickname ?? existingUser?.nickname ?? null,
      picture: existingUser?.picture ?? claims.picture ?? null,
      sid: claims.sid ?? existingUser?.sid ?? null,
      sub: claims.sub,
      updated_at_iso_string: claims.updated_at ?? existingUser?.updated_at_iso_string ?? null,
    };

    if (existingUser) {
      await db.update(ExternalUsers).set(entry).where({ ID: claims.sub });
      setCachedExternalUserClaims(claims.sub, pickProfileClaimsFromExternalUser(entry));
      return true;
    }

    await db.create(ExternalUsers).entries(entry);
    setCachedExternalUserClaims(claims.sub, pickProfileClaimsFromExternalUser(entry));
    return true;
  } catch (error) {
    console.error("Error managing user in database:", error);
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

module.exports = {
  Auth0User,
  buildCapUserFromClaims,
  enrichClaimsWithUserInfo,
  getRoleClaimKey,
  getRolesFromClaims,
  syncExternalUserIfNeeded,
  upsertExternalUser,
};
