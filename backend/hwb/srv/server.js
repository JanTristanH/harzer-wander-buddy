const cds = require("@sap/cds");
const { auth, requiresAuth } = require("express-openid-connect");
const jsonwebtoken = require("jsonwebtoken");
const express = require('express');
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
    
    try {
      const db = await cds.connect.to('db');
      const { ExternalUsers } = db.entities;
      
      const existingUser = await db.read(ExternalUsers).where({ principal: userFromToken.sub });
      
      if (!existingUser || existingUser.length === 0) {
        // Create new user
        await db.create(ExternalUsers).entries({
          principal: userFromToken.sub,
          email: userFromToken.email,
          email_verified: userFromToken.email_verified,
          family_name: userFromToken.family_name,
          given_name: userFromToken.given_name,
          name: userFromToken.name,
          nickname: userFromToken.nickname,
          picture: userFromToken.picture,
          sid: userFromToken.sid,
          sub: userFromToken.sub,
          updated_at_iso_string: userFromToken.updated_at
        });
      }
    } catch (error) {
      console.error('Error managing user in database:', error);
    }

    return userInfo;
  },
};

cds.on("bootstrap", (app) => {
  // ✅ Serve manifest.json publicly before authentication middleware
  app.use("/app/pbc", express.static(__dirname + "/../app/pbc"));


  app.use(auth(config));

  app.use('/app/frontendhwb', requiresAuth(), express.static(__dirname + '/../app/frontendhwb'));

  // rewrite ui5 dist path
  app.use((req, res, next) => {
    const pattern = /~\/.*?\/~/g;
    if (pattern.test(req.url)) {
      req.url.replace(pattern, "/");
    }
    next();
  });
});

module.exports = cds.server;