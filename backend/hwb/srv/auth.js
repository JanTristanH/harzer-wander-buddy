const cds = require("@sap/cds");
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
  const requestPath = `${req.originalUrl || ''} ${req.baseUrl || ''} ${req.path || ''} ${req.url || ''}`;
  if (requestPath.includes('/odata/v4/public')) {
    req.user = cds.User.anonymous;
    return next();
  }

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
