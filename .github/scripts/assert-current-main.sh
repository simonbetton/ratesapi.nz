#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

if [[ "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  echo "::error::Production changes must run from main."
  exit 1
fi

current_main=$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)
if [[ "$current_main" != "$GITHUB_SHA" ]]; then
  echo "::error::This run is no longer the current main commit. Refusing stale production changes."
  exit 1
fi
