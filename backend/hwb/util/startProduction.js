const cds = require('@sap/cds');

async function startProduction({
  runtime = cds,
  serve = () => require('@sap/cds/bin/serve')(),
  deployOnStart = process.env.DEPLOY_ON_START !== 'false',
} = {}) {
  await runtime.plugins;
  if (deployOnStart) {
    console.log('Deploying to database...');
    // The server reuses this process and database pool after successful deployment.
    await runtime.deploy('*').to('db');
  }
  return serve();
}

if (require.main === module) {
  startProduction().catch(async error => {
    console.error('Server startup failed:', error.message);
    try { await cds.db?.disconnect(); } finally { process.exitCode = 1; }
  });
}
module.exports = startProduction;
