#!/usr/bin/env bash
# Existing libpq service configuration only. No connection URI/password in argv.
# Example: PGSERVICE=hwb-runtime bash scripts/inspect-cap-database.sh
set -euo pipefail
: "${PGSERVICE:?Set PGSERVICE to a privately configured libpq service}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
{
  printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' "SET LOCAL statement_timeout = '15s';" "SET LOCAL lock_timeout = '2s';"
  cat "$root/backend/hwb/util/inspectCapDatabase.sql"
  printf '%s\n' 'ROLLBACK;'
} | psql -X -v ON_ERROR_STOP=1
