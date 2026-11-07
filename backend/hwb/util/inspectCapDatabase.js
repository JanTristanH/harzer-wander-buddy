#!/usr/bin/env node
// Run from backend/hwb with the deployed image's exact profile and bindings.
// Does not start srv/server.js, start.sh, deploy, or HTTP authentication hooks.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const cds = require('@sap/cds');
  if (cds.env.requires.db?.kind !== 'postgres') throw new Error('PostgreSQL profile required');
  const db = await cds.connect.to('db');
  try {
    const statements = fs.readFileSync(path.join(__dirname, 'inspectCapDatabase.sql'), 'utf8')
      .replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
    await db.tx(async tx => {
      await tx.run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await tx.run("SET LOCAL statement_timeout = '15s'");
      await tx.run("SET LOCAL lock_timeout = '2s'");
      for (const sql of statements) console.log(JSON.stringify(await tx.run(sql)));
    });
  } finally { await db.disconnect(); }
}
main().catch(() => {
  // Driver errors may contain credentials/connection details. Fail closed.
  console.error('CAP database inspection failed; inspect privately. No release evidence produced.');
  process.exitCode = 1;
});
