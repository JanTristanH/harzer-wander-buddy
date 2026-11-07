#!/bin/sh
set -eu
# The writable container filesystem is discarded on cold starts/replacements.
export CDS_REQUIRES_DB_CREDENTIALS_URL=/tmp/hwb-preview.sqlite
cp ./preview-seed.sqlite "$CDS_REQUIRES_DB_CREDENTIALS_URL"
exec ./node_modules/.bin/cds serve --profile dev-basic
