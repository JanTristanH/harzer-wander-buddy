const cds = require("@sap/cds");
const fetch = require("node-fetch");

const DEBUG = cds.debug("cds-auth0");

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

async function enrichClaimsFromExternalUser(claims = {}) {
  if (!claims.sub) {
    return claims;
  }

  try {
    const db = await cds.connect.to("db");
    const { ExternalUsers } = db.entities;
    const [externalUser] = await db.read(ExternalUsers).where({ ID: claims.sub });
    if (!externalUser) {
      return claims;
    }

    const dbClaims = pickProfileClaimsFromExternalUser(externalUser);
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
    return {
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
  } catch (error) {
    DEBUG && DEBUG(`userinfo lookup failed: ${error.message}`);
    return enrichedClaims;
  }
}

async function upsertExternalUser(claims = {}) {
  if (!claims.sub) {
    return;
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
      return;
    }

    await db.create(ExternalUsers).entries(entry);
  } catch (error) {
    console.error("Error managing user in database:", error);
  }
}

module.exports = {
  Auth0User,
  buildCapUserFromClaims,
  enrichClaimsWithUserInfo,
  getRoleClaimKey,
  getRolesFromClaims,
  upsertExternalUser,
};
