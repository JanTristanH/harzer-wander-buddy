const { buildCapUserFromClaims } = require("./auth-utils");

function capAuth0(req, res, next) {
  if (req.user?.id) {
    return next();
  }

  const claims = req.auth0TokenPayload || req.oidc?.user;
  const user = buildCapUserFromClaims(claims);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
}

module.exports = capAuth0;
