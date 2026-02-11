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

: "${CONVEX_INGEST_SECRET:?Missing CONVEX_INGEST_SECRET in .env.local}"

echo "Syncing CONVEX_INGEST_SECRET to Convex..."
bunx convex env set CONVEX_INGEST_SECRET "$CONVEX_INGEST_SECRET"
echo "Convex ingest secret synced."
