const cds = require("@sap/cds");
const { auth, requiresAuth } = require("express-openid-connect");
const jsonwebtoken = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
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
let joseModulePromise;
let jwks;
const exportableEntities = [
  "AdjacentStamps",
  "Attachments_local",
  "ExternalUsers",
  "Friendships",
  "ParkingSpots",
  "PendingFriendshipRequests",
  "RouteCalculationRequest",
  "Stampboxes",
  "Stampings",
  "Tour2TravelTime",
  "Tours",
  "TravelTimes",
];

console.log("[auth] issuer:", issuer || "<missing>");
console.log("[auth] audience:", audience || "<missing>");
console.log("[auth] jwks url:", jwksUrl?.toString() || "<missing>");

function getJoseModule() {
  if (!joseModulePromise) {
    joseModulePromise = import("jose");
  }
  return joseModulePromise;
}

async function getJwks() {
  if (!jwksUrl) {
    return null;
  }

  if (!jwks) {
    const { createRemoteJWKSet } = await getJoseModule();
    jwks = createRemoteJWKSet(jwksUrl);
  }

  return jwks;
}

async function bearerAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const jwks = await getJwks();
  if (!jwks || !issuer || !audience) {
    res.status(500).json({ error: "Bearer auth is not configured correctly" });
    return;
  }

  try {
    const { jwtVerify } = await getJoseModule();
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

function toCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const serialized = value instanceof Date ? value.toISOString() : String(value);
  return `"${serialized.replace(/"/g, '""')}"`;
}

function toCsv(rows, predefinedColumns = []) {
  const columns = [...predefinedColumns];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }

  if (columns.length === 0) {
    return "";
  }

  const header = columns.map((key) => toCsvValue(key)).join(",");
  const lines = rows.map((row) => columns.map((key) => toCsvValue(row[key])).join(","));
  return [header, ...lines].join("\n");
}

function sanitizeEntityName(rawName) {
  return (rawName || "").replace(/[^A-Za-z0-9_]/g, "");
}

async function requireExportAuth(req, res, next) {
  await bearerAuth(req, res, async () => {
    if (req.user || req.oidc?.isAuthenticated()) {
      next();
      return;
    }

    res.status(401).json({ error: "Unauthorized" });
  });
}

function registerCsvExportRoutes(app) {
  app.get("/export/csv", requireExportAuth, (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const entities = exportableEntities.map((entity) => ({
      entity,
      fileName: `hwb.db.${entity}.csv`,
      url: `${baseUrl}/export/csv/${entity}`,
    }));

    res.json({
      usage: "/export/csv/:entity",
      entities,
    });
  });

  app.get("/export/csv/:entity", requireExportAuth, async (req, res) => {
    try {
      const sanitizedEntityName = sanitizeEntityName(req.params.entity);
      const entityName = exportableEntities.find((entity) => entity === sanitizedEntityName);

      if (!entityName) {
        res.status(404).json({
          error: "Entity not supported for CSV export",
          supportedEntities: exportableEntities,
        });
        return;
      }

      const db = await cds.connect.to("db");
      const fullyQualifiedEntityName = `hwb.db.${entityName}`;
      const rows = await db.run(SELECT.from(fullyQualifiedEntityName));
      const modelColumns = Object.keys(cds.model?.definitions?.[fullyQualifiedEntityName]?.elements || {});
      const csv = toCsv(rows, modelColumns);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="hwb.db.${entityName}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("[export] csv export failed:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });
}

cds.on("bootstrap", (app) => {
  // ✅ Serve manifest.json publicly before authentication middleware
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));

  app.use(auth(config));
  app.use("/odata/v4/api", mobileCors, bearerAuth);
  app.use("/odata/v2/api", mobileCors, bearerAuth);
  app.use("/odata/v4/api", mobileCors, bearerAuth);
  app.use("/odata/v2/api", mobileCors, bearerAuth);

  app.use("/app/frontendhwb", requiresAuth(), express.static(__dirname + "/../app/frontendhwb"));
  app.use("/app/dependencies", requiresAuth(), express.static(__dirname + "/../app/dependencies"));
  registerCsvExportRoutes(app);

  // rewrite ui5 dist path
  app.use((req, res, next) => {
    const pattern = /~\/.*?\/~/g;
    if (pattern.test(req.url)) {
      req.url = req.url.replace(pattern, "/");
      req.url = req.url.replace(pattern, "/");
    }
    next();
  });
});

module.exports = cds.server;
