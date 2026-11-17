const cds = require("@sap/cds");

// Keep the lock row outside db/data: deploySqlite.js temporarily uses that
// directory for the local stamp fixture exports.
module.exports = async (db) => {
  const { NoticeSyncState } = db.entities("hwb.db");
  const existing = await db.run(
    cds.ql.SELECT.one.from(NoticeSyncState).where({ ID: "official" }),
  );
  if (!existing)
    await db.run(
      cds.ql.INSERT.into(NoticeSyncState).entries({ ID: "official" }),
    );
};
