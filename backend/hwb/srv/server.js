// srv/server.js (CommonJS, as before)
const cds = require("@sap/cds");
const express = require("express");

/**
 * Helper to lazily import Better Auth (ESM) from CommonJS.
 * We only import inside the bootstrap hook, and we keep a small cache.
 */
let _betterAuthLoaded;
async function loadBetterAuth() {
  if (!_betterAuthLoaded) {
    const betterAuthNode = await import("better-auth/node");
    const authModule = await import("./auth.mjs"); // path to your auth.mjs
    _betterAuthLoaded = {
      toNodeHandler: betterAuthNode.toNodeHandler,
      fromNodeHeaders: betterAuthNode.fromNodeHeaders,
      auth: authModule.auth,
    };
  }
  return _betterAuthLoaded;
}

cds.on("bootstrap", async (app) => {
  // Serve manifest.json / UI5 preload stuff publicly
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));

  // ---- Better Auth integration -------------------------------------------
  // IMPORTANT: Do NOT use express.json() before the Better Auth handler. :contentReference[oaicite:2]{index=2}
  const { toNodeHandler, fromNodeHeaders, auth } = await loadBetterAuth();

  // All Better Auth routes (sign-in, sign-up, etc.)
  app.all("/api/auth/*", toNodeHandler(auth));

  // Now it's safe to use express.json() for other routes
  app.use(express.json());

  // Simple auth guard using Better Auth session
  const ensureAuth = async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      }); // :contentReference[oaicite:3]{index=3}

      if (!session) {
        const target = encodeURIComponent(req.originalUrl);
        return res.redirect(`/app/pbc/login.html?redirect=${target}`);
      }


      // Optionally expose user on req for downstream handlers
      req.user = session.user;
      next();
    } catch (err) {
      console.error("Error reading session from Better Auth:", err);
      return res.status(500).json({ error: "Auth check failed" });
    }
  };

  // ---- Protected static resources ----------------------------------------

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

  // ---- UI5 dist path rewrite (unchanged) ---------------------------------
  app.use((req, res, next) => {
    const pattern = /~\/.*?\/~/g;
    if (pattern.test(req.url)) {
      req.url = req.url.replace(pattern, "/");
    }
    next();
  });
});

module.exports = cds.server;
