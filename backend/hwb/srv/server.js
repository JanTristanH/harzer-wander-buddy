const cds = require("@sap/cds");
const { auth, requiresAuth } = require("express-openid-connect");
const jsonwebtoken = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { buildCapUserFromClaims, enrichClaimsWithUserInfo, upsertExternalUser } = require("./auth-utils");
require("dotenv").config();


const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  authorizationParams: {
    response_type: "code",
    scope: "openid profile email permissions",
    audience: process.env.AUDIENCE,
  },
  afterCallback: async (req, tokenSet, userInfo) => {
    // save / update user in our database after login
    let userFromToken = jsonwebtoken.decode(userInfo.id_token);
    await upsertExternalUser(userFromToken);
    return userInfo;
  },
};

const mobileCorsOrigins = (process.env.MOBILE_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const mobileCors = cors({
  origin(origin, callback) {
    if (!origin || mobileCorsOrigins.length === 0 || mobileCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "Accept",
    "If-Match",
    "If-None-Match",
    "Prefer",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

function normalizeIssuer(rawIssuer) {
  if (!rawIssuer) {
    return "";
  }

  return rawIssuer.endsWith("/") ? rawIssuer : `${rawIssuer}/`;
}

const issuer = normalizeIssuer(process.env.ISSUER_BASE_URL);
const audience = process.env.AUDIENCE;
const jwksUrl = issuer ? new URL(".well-known/jwks.json", issuer) : null;
const jwks = jwksUrl ? createRemoteJWKSet(jwksUrl) : null;

console.log("[auth] issuer:", issuer || "<missing>");
console.log("[auth] audience:", audience || "<missing>");
console.log("[auth] jwks url:", jwksUrl?.toString() || "<missing>");

async function bearerAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  if (!jwks || !issuer || !audience) {
    res.status(500).json({ error: "Bearer auth is not configured correctly" });
    return;
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const decodedToken = jsonwebtoken.decode(token) || {};
    console.log("[auth] bearer request:", req.method, req.originalUrl);
    console.log("[auth] token iss:", decodedToken.iss || "<missing>");
    console.log("[auth] token aud:", decodedToken.aud || "<missing>");

    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
    });

    const enrichedPayload = await enrichClaimsWithUserInfo(token, payload);

    req.auth0TokenPayload = enrichedPayload;
    req.user = buildCapUserFromClaims(enrichedPayload);
    await upsertExternalUser(enrichedPayload);
    console.log("[auth] bearer verification succeeded for:", enrichedPayload.sub);
    next();
  } catch (error) {
    console.error("[auth] bearer verification failed:", error.message);
    console.error("[auth] request url:", req.originalUrl);
    if (error.code) {
      console.error("[auth] error code:", error.code);
    }
    res.status(401).json({ error: "Unauthorized" });
  }
}

cds.on("bootstrap", (app) => {
  // ✅ Serve manifest.json publicly before authentication middleware
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));

  app.use(auth(config));
  app.use("/odata/v4/api", mobileCors, bearerAuth);
  app.use("/odata/v2/api", mobileCors, bearerAuth);

  app.use("/app/frontendhwb", requiresAuth(), express.static(__dirname + "/../app/frontendhwb"));
  app.use("/app/dependencies", requiresAuth(), express.static(__dirname + "/../app/dependencies"));

  // rewrite ui5 dist path
  app.use((req, res, next) => {
    const pattern = /~\/.*?\/~/g;
    if (pattern.test(req.url)) {
      req.url = req.url.replace(pattern, "/");
    }
    next();
  });
});

module.exports = cds.server;
