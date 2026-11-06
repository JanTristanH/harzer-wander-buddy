const cds = require('@sap/cds');

// Use the installed runtime API; no global CLI or development dependencies needed.
cds.deploy('*').to('db')
  .finally(() => cds.db?.disconnect())
  .catch(error => {
    console.error('Database deployment failed:', error.message);
    process.exitCode = 1;
  });
