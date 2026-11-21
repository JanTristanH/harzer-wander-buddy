// Cloud Run Job entrypoint: no HTTP listener and no dependence on service traffic.
require('dotenv').config();
const cds = require('@sap/cds');
const { deletionConfigured, processAccountDeletions } = require('../srv/account-privacy');

async function run() {
  if (!deletionConfigured()) throw new Error('Account deletion provider configuration missing');
  cds.model = cds.linked(await cds.load('*'));
  const db = await cds.connect.to('db');
  try {
    const result = await processAccountDeletions();
    // Counts only; never log identifiers, query content or provider credentials.
    console.info('[account-deletion-job]', JSON.stringify(result));
    if (result.skipped || result.failed || result.remaining) process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
}
run().catch(() => {
  console.error('[account-deletion-job] Execution failed; check configuration and queue monitoring.');
  process.exitCode = 1;
});
