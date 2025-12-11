// srv/auth.js
const cds = require("@sap/cds");

// To debug this module set export DEBUG=cds-auth-better
const DEBUG = cds.debug("cds-auth-better");

// We’ll lazy-load the ESM Better Auth modules so this file can stay CommonJS
let _betterAuthLoaded;

async function loadBetterAuth() {
  if (!_betterAuthLoaded) {
    // ESM imports from CommonJS
    const betterAuthNode = await import("better-auth/node");
    const authModule = await import("./auth.mjs"); // <-- your Better Auth config from earlier

    _betterAuthLoaded = {
      fromNodeHeaders: betterAuthNode.fromNodeHeaders,
      auth: authModule.auth,
    };
  }
  return _betterAuthLoaded;
}

// CAP user
const BetterAuthUser = class extends cds.User {
  is(role) {
    DEBUG && DEBUG("Requested role: " + role);
    return role === "any" || this._roles.includes(role);
  }
};

/**
 * Authentication + CAP user mapping middleware for CAP.
 *
 * - Reads Better Auth session from the request
 * - Ensures user is logged in
 * - Maps session.user → cds.User with roles
 */
async function capBetterAuthImpl(req, res, next) {
  const { auth, fromNodeHeaders } = await loadBetterAuth();

  // Read session from Better Auth (cookie / headers)
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session || !session.user) {
    DEBUG && DEBUG("No Better Auth session / user");
    // behave like requiresAuth(): stop here
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = session.user;

  // Base roles
  const roles = ["authenticated-user"];

  // If you store roles/permissions in Better Auth's user,
  // adapt this to match your schema:
  if (Array.isArray(user.roles)) {
    roles.push(...user.roles);
  } else if (Array.isArray(user.permissions)) {
    roles.push(...user.permissions);
  }

  // Map to CAP user
  const capUserData = {
    id: user.id,      // or user.email, depending on your model
    _roles: roles,
  };

  const capUser = new BetterAuthUser(capUserData);

  // Needed so the default CAP user logic sees roles:
  capUser.roles = capUser._roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});

  req.user = capUser;

  DEBUG && DEBUG("CAP user created from Better Auth session");
  DEBUG && DEBUG(capUserData);

  next();
}

/**
 * Wrapper so Express can use this as normal middleware and
 * we can export an array like before.
 */
function capBetterAuth(req, res, next) {
  capBetterAuthImpl(req, res, next).catch((err) => {
    console.error("Error in Better Auth CAP middleware:", err);
    res.status(500).json({ error: "Internal auth error" });
  });
}

// Keep the same shape as before (array of middlewares)
module.exports = [capBetterAuth];
