#!/bin/sh
set -eu

# Disable only when a release migration job has already deployed the schema.
if [ "${DEPLOY_ON_START:-true}" = "true" ]; then
  echo "Deploying to database..."
  node util/deployProduction.js
fi
exec node node_modules/@sap/cds/bin/serve.js --production
