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

async function capSupabase(req, res, next) {
  const requestPath = `${req.originalUrl || ''} ${req.baseUrl || ''} ${req.path || ''} ${req.url || ''}`;
  if (requestPath.includes('/odata/v4/public')) {
    req.user = cds.User.anonymous;
    return next();
  }

  const accountId = req.user?.id || req.supabaseClaims?.sub;
  if (accountId && await require('./account-privacy').isAccountDeleted(accountId)) {
    return sendODataError(res, 401, "Dieses Konto wurde gelöscht.");
  }
  if (req.user?.id) {
    return next();
  }

  const claims = req.supabaseClaims;
  const user = buildCapUserFromClaims(claims);
  if (!user) {
    sendODataError(res, 401, "Unauthorized");
    return;
  }

  req.user = user;
  next();
}

module.exports = capSupabase;
