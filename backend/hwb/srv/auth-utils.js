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

async function enrichClaimsWithUserInfo(accessToken, claims = {}) {
  if (!accessToken || !claims.sub || hasProfileClaims(claims)) {
    return claims;
  }

  const issuerBaseUrl = process.env.ISSUER_BASE_URL?.replace(/\/$/, "");
  if (!issuerBaseUrl) {
    return claims;
  }

  try {
    const response = await fetch(`${issuerBaseUrl}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      DEBUG && DEBUG(`userinfo lookup failed with status ${response.status}`);
      return claims;
    }

    const userInfo = await response.json();
    return {
      ...claims,
      email: claims.email ?? userInfo.email,
      email_verified: claims.email_verified ?? userInfo.email_verified,
      family_name: claims.family_name ?? userInfo.family_name,
      given_name: claims.given_name ?? userInfo.given_name,
      name: claims.name ?? userInfo.name,
      nickname: claims.nickname ?? userInfo.nickname,
      picture: claims.picture ?? userInfo.picture,
      sid: claims.sid ?? userInfo.sid,
      sub: claims.sub ?? userInfo.sub,
      updated_at: claims.updated_at ?? userInfo.updated_at,
    };
  } catch (error) {
    DEBUG && DEBUG(`userinfo lookup failed: ${error.message}`);
    return claims;
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
      name: claims.name ?? existingUser?.name ?? claims.nickname ?? existingUser?.nickname ?? claims.sub,
      nickname: claims.nickname ?? existingUser?.nickname ?? null,
      picture: claims.picture ?? existingUser?.picture ?? null,
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
