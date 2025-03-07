const cds = require("@sap/cds");
const { requiresAuth } = require("express-openid-connect");
const jsonwebtoken = require("jsonwebtoken");

// To debug this module set export DEBUG=cds-auth0
const DEBUG = cds.debug("cds-auth0");

// CAP user
const Auth0User = class extends cds.User {
  is(role) {
    DEBUG && DEBUG("Requested role: " + role);
    return role === "any" || this._roles.includes(role);
  }
};

// the authentication function for CAP
function capAuth0(req, res, next) {
  if (!req.oidc.user) {
    DEBUG && DEBUG("No user");
    return next(Error());
  }

  // map token attributes to CAP user
  let capUser = {
    id: req.oidc.user.sub,
    _roles: ["authenticated-user"],
  };


  // retrieve permissions
  let jwtDecoded = jsonwebtoken.decode(req.oidc.accessToken?.access_token);
  if (jwtDecoded) {
    let roles = jwtDecoded[process.env.AUDIENCE + "roles"] || [];
    capUser._roles.push(...roles);
  }

  req.user = new Auth0User(capUser);
  // needed to satisfy default user.js; Auth0User.is is not called for some reason
  req.user.roles = req.user._roles.reduce((acc, role) => {
    acc[role] = true;
    return acc;
  }, {});

  DEBUG && DEBUG("capUser");
  DEBUG && DEBUG(capUser);

  next();
}

module.exports = [requiresAuth(), capAuth0];