#!/usr/bin/env bash
set -euo pipefail

if [ ! -f ".env.local" ]; then
  echo "Missing .env.local in project root." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

: "${CONVEX_URL:?Missing CONVEX_URL in .env.local}"
: "${CONVEX_INGEST_SECRET:?Missing CONVEX_INGEST_SECRET in .env.local}"

d1_database="${CLOUDFLARE_D1_DATABASE:-${D1_DATABASE_NAME:-${CLOUDFLARE_D1_DATABASE_ID:-}}}"

if [ -z "$d1_database" ]; then
  echo "Missing D1 database in .env.local." >&2
  echo "Set one of: CLOUDFLARE_D1_DATABASE, D1_DATABASE_NAME, CLOUDFLARE_D1_DATABASE_ID" >&2
  exit 1
fi

echo "Using D1 database: $d1_database"
if [ -n "${D1_MIGRATION_PAGE_SIZE:-}" ]; then
  echo "Using D1 migration page size: $D1_MIGRATION_PAGE_SIZE"
fi

echo "Syncing ingest secret to Convex..."
bash ./bin/convex-sync-env-local.sh

echo "Running D1 -> Convex migration..."
bun run migrate:d1 -- --d1 "$d1_database" --remote
