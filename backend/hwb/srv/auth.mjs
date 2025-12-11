// srv/auth.mjs
import "dotenv/config";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { createAuthMiddleware } from "better-auth/api";
import cds from "@sap/cds";

/**
 * Better Auth instance.
 * Configure your providers + DB adapter here as needed.
 * See https://www.better-auth.com/docs/installation
 */
export const auth = betterAuth({
  baseURL: process.env.BASE_URL, // e.g. https://your-host.example.com
  // If you want email/password:
  emailAndPassword: {
    enabled: false,
  },
  plugins: [expo()],
  // Example social provider (adapt to your needs: google, github, etc.)
  socialProviders: {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  trustedOrigins: [
    "http://localhost:8081",
    "hwb://",
    "exp://*/*",
  ],

  /**
   * Run custom logic after successful auth calls.
   * This is similar in spirit to your Auth0 `afterCallback`.
   *
   * We'll:
   *  - get the newly created/updated session
   *  - take user data from the session
   *  - upsert into CAP's ExternalUsers entity
   */
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;

      const user = newSession.user;
      if (!user) return;

      // Connect to CAP db
      const db = await cds.connect.to("db");
      const { ExternalUsers } = db.entities;

      // Look up existing user
      const existing = await db
        .read(ExternalUsers)
        .where({ ID: user.id });

      if (!existing || existing.length === 0) {
        // Insert new external user
        await db.create(ExternalUsers).entries({
          ID: user.id,
          email: user.email,
          email_verified: user.emailVerified ?? null,
          family_name: user.lastName ?? null,
          given_name: user.firstName ?? null,
          name: user.name ?? null,
          nickname: user.username ?? null,
          picture: user.image ?? null,
          sub: user.id,
          updated_at_iso_string: new Date().toISOString(),
          // add whatever extra fields you like
        });
      } else {
        // Optional: update existing user on every login
        await db.update(ExternalUsers)
          .set({
            email: user.email,
            name: user.name ?? existing[0].name,
            picture: user.image ?? existing[0].picture,
            updated_at_iso_string: new Date().toISOString(),
          })
          .where({ ID: user.id });
      }
    }),
  },

  // Configure DB adapter etc. here if you use Better Auth’s DB:
  // database: drizzleAdapter(...),
});
