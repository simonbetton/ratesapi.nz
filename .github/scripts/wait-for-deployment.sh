#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

if [[ "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  echo "::error::Production rate publication must run from main."
  exit 1
fi

# Deployment and scraping both start on push. Wait up to 15 minutes for the
# matching deployment; an older successful deploy cannot admit a new schema.
for ((attempt = 1; attempt <= 30; attempt++)); do
  deployment_status=$(gh run list \
    --repo "$GITHUB_REPOSITORY" \
    --workflow deploy.yml \
    --branch main \
    --commit "$GITHUB_SHA" \
    --limit 1 \
    --json status,conclusion \
    --jq '.[0] | if . == null then "missing" elif .status == "completed" then .conclusion else .status end')

  case "$deployment_status" in
    success)
      echo "Deployment succeeded for $GITHUB_SHA; publication may proceed."
      exit 0
      ;;
    missing|queued|in_progress|pending|waiting|requested)
      echo "Waiting for deployment of $GITHUB_SHA ($deployment_status, attempt $attempt/30)."
      sleep 30
      ;;
    *)
      echo "::error::Deployment of $GITHUB_SHA did not succeed ($deployment_status). No rates will be published."
      exit 1
      ;;
  esac
done

echo "::error::Timed out waiting for deployment of $GITHUB_SHA. No rates will be published."
exit 1
