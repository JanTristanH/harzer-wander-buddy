const cds = require("@sap/cds");

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
      email: claims.email,
      email_verified: claims.email_verified,
      family_name: claims.family_name,
      given_name: claims.given_name,
      name: claims.name,
      nickname: claims.nickname,
      picture: claims.picture,
      sid: claims.sid,
      sub: claims.sub,
      updated_at_iso_string: claims.updated_at,
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
  getRoleClaimKey,
  getRolesFromClaims,
  upsertExternalUser,
};
