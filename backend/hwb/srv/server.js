"use strict";

const cds = require("@sap/cds");

const cov2ap = require("@cap-js-community/odata-v2-adapter");
cds.on("bootstrap", (app) => app.use(cov2ap()));

cds.on ('calculateNNearestNeighbors', async req => {
    const {n} = req.data
    
    // let b = await SELECT `stock` .from (Stampboxes)

    // await UPDATE (Books,book) .with ({ stock: stock -= quantity })

    return { n }
  })

module.exports = cds.server;