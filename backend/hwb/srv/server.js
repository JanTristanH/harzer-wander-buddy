// srv/server.js
const cds = require("@sap/cds");
const express = require("express");
const cors = require("cors");

let _betterAuthLoaded;
async function loadBetterAuth() {
  if (!_betterAuthLoaded) {
    const betterAuthNode = await import("better-auth/node");
    const authModule = await import("./auth.mjs");
    _betterAuthLoaded = {
      toNodeHandler: betterAuthNode.toNodeHandler,
      fromNodeHeaders: betterAuthNode.fromNodeHeaders,
      auth: authModule.auth,
    };
  }
  return _betterAuthLoaded;
}

cds.on("bootstrap", async (app) => {
  const { toNodeHandler, fromNodeHeaders, auth } = await loadBetterAuth();

  // --- GLOBAL CORS FOR DEV ---------------------------------------------
  const corsConfig = {
    origin: "http://localhost:8081", // Expo web origin
    credentials: true,              // allow cookies
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,X-Requested-With,Accept",
  };

  // Preflight + all methods
  app.options("*", cors(corsConfig));
  app.use(cors(corsConfig));

  // Static (unchanged)
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));

  // --- Better Auth routes ----------------------------------------------
  app.all("/api/auth/*", toNodeHandler(auth));

  // Body parser for other routes
  app.use(express.json());

  // --- Auth guard for protected static content -------------------------
  const ensureAuth = async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session) {
        const target = encodeURIComponent(req.originalUrl);
        return res.redirect(`/app/pbc/login.html?redirect=${target}`);
      }

      req.user = session.user;
      next();
    } catch (err) {
      console.error("Error reading session from Better Auth:", err);
      return res.status(500).json({ error: "Auth check failed" });
    }
  };

  app.use(
    "/app/frontendhwb",
    ensureAuth,
    express.static(__dirname + "/../app/frontendhwb")
  );

  app.use(
    "/app/dependencies",
    ensureAuth,
    express.static(__dirname + "/../app/dependencies")
  );

  // UI5 path rewrite (unchanged)
  app.use((req, res, next) => {
    const pattern = /~\/.*?\/~/g;
    if (pattern.test(req.url)) {
      req.url = req.url.replace(pattern, "/");
    }
    next();
  });
});

module.exports = cds.server;
