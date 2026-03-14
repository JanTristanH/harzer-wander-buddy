const cds = require("@sap/cds");
const { auth, requiresAuth } = require("express-openid-connect");
const jsonwebtoken = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { buildCapUserFromClaims, upsertExternalUser } = require("./auth-utils");
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

const issuer = process.env.ISSUER_BASE_URL;
const audience = process.env.AUDIENCE;
const jwks = issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : null;

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
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
    });

    req.auth0TokenPayload = payload;
    req.user = buildCapUserFromClaims(payload);
    await upsertExternalUser(payload);
    next();
  } catch (error) {
    console.error("Bearer auth failed:", error.message);
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
