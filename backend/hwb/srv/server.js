"use strict";

const cds = require("@sap/cds");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");

cds.on("bootstrap", app => app.use(proxy()));

cds.on ('calculateNNearestNeighbors', async req => {
    const {n} = req.data
    
    // let b = await SELECT `stock` .from (Stampboxes)

    // await UPDATE (Books,book) .with ({ stock: stock -= quantity })

    return { n }
  })

module.exports = cds.server;