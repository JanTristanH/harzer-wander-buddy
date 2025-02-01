const cds = require("@sap/cds");
const { auth, requiresAuth } = require("express-openid-connect");
const express = require('express');
require("dotenv").config();


const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
};
// const config = {
//   authRequired: false, // deactivate auth for all routes
//   auth0Logout: true, // logout from IdP
//   authorizationParams: { // required to retrieve JWT including permissions (our roles) 
//     response_type: "code",
//     scope: "openid",
//     audience: "<https://cap-auth0-demo-api.com>",
//   },
// };

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