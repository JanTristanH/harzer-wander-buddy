const { buildCapUserFromClaims } = require("./auth-utils");

function sendODataError(res, statusCode, message) {
  res.status(statusCode).json({
    error: {
      code: String(statusCode),
      message,
    },
  });
}

function capAuth0(req, res, next) {
  if (req.user?.id) {
    return next();
  }

  const claims = req.auth0TokenPayload || req.oidc?.user;
  const user = buildCapUserFromClaims(claims);
  if (!user) {
    sendODataError(res, 401, "Unauthorized");
    return;
  }

  req.user = user;
  next();
}

module.exports = capAuth0;
