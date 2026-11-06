const cds = require("@sap/cds");
const { bearerAuth } = require("./supabase-auth");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();


const isLocalBasic = cds.env.profiles.includes('dev-basic');
if (isLocalBasic && cds.env.profiles.includes('production')) {
  throw new Error('dev-basic cannot be combined with production');
}

const mobileCorsOrigins = (process.env.MOBILE_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedLocalDevOrigin(origin) {
  if (typeof origin !== "string") {
    return false;
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin);
}

const mobileCors = cors({
  origin(origin, callback) {
    if (
      !origin ||
      (mobileCorsOrigins.length === 0 && !cds.env.profiles.includes('production')) ||
      mobileCorsOrigins.includes(origin) ||
      (!cds.env.profiles.includes('production') && isAllowedLocalDevOrigin(origin))
    ) {
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

function sendODataError(res, statusCode, message) {
  res.status(statusCode).json({ error: { code: String(statusCode), message } });
}

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
    const user = req.user;
    if (user?.is('admin')) {
      next();
      return;
    }

    sendODataError(res, req.user ? 403 : 401, "Administrator access required");
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

const RN_WEB_MOUNT_PATH = "/app/rnweb";
const RN_WEB_DIST_PATH = path.join(__dirname, "..", "app", "rnweb");
const RN_WEB_INDEX_PATH = path.join(RN_WEB_DIST_PATH, "index.html");

function isHtmlNavigationRequest(req) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const accept = req.headers.accept || "";
  return accept.includes("text/html");
}

function skipBearerAuth(req, res, next) {
  next();
}

cds.on("bootstrap", (app) => {
  // Apply before static files, authentication redirects and CAP routes.
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  require('./legal-content').registerLegalRoutes(app, mobileCors);
  // ✅ Serve manifest.json publicly before authentication middleware
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));

  app.get(['/login', '/logout', '/callback'], (_req, res) => res.redirect(302, '/app/rnweb/login'));
  // UI5's cookie/OIDC path is retired. The maintained RN web client uses bearer auth.
  const requireStaticAuth = (req, res) => res.redirect(302, '/app/rnweb/login');
  const apiAuth = isLocalBasic ? skipBearerAuth : bearerAuth;
  if (isLocalBasic) {
    app.use('/export/csv', require('./basic-auth')(cds.env.requires.auth));
  }
  app.use("/odata/v4/api", mobileCors, apiAuth);
  app.use("/odata/v2/api", mobileCors, apiAuth);
  app.use("/odata/v4/public", mobileCors);

  app.use("/app/frontendhwb", requireStaticAuth, express.static(__dirname + "/../app/frontendhwb"));
  // RN web owns its Supabase flow and calls CAP APIs with bearer tokens.
  app.use(RN_WEB_MOUNT_PATH, express.static(RN_WEB_DIST_PATH, { extensions: ["html"] }));
  app.get(/^\/app\/rnweb(?:\/.*)?$/, (req, res, next) => {
    if (req.path.includes(".") || !isHtmlNavigationRequest(req)) {
      next();
      return;
    }

    res.sendFile(RN_WEB_INDEX_PATH);
  });
  app.use("/app/dependencies", requireStaticAuth, express.static(__dirname + "/../app/dependencies"));
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

cds.on('served', () => require('./account-privacy').startAccountDeletionWorker());
module.exports = cds.server;
