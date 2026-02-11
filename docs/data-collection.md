# Automated Data Collection

Data is scraped hourly and stored in Convex as:

- Daily snapshots (`rateSnapshots`)
- Latest materialized views (`latestRateData`)
- Daily aggregate rollups (`dailyRateAggregates`)

## Workflow

GitHub Actions workflow: `.github/workflows/scrape.yml`

Schedule:
- Every hour (`0 * * * *`)

Process:
1. Scrape each lending category from interest.co.nz
2. Validate extracted payloads with Zod schemas
3. Compare against latest snapshot in Convex
4. Apply quality guardrails (minimum coverage + sudden-drop detection)
5. Write snapshot + aggregate into Convex

## Required GitHub Secrets

- `CONVEX_URL`
- `CONVEX_INGEST_SECRET`

Optional:
- `UPTIME_BASE_URL` (used by uptime workflow)

## Reliability controls

- HTTP retries with backoff for upstream fetches
- Hourly workflow retries each scraper up to 3 attempts
- Guardrails block low-confidence dataset overwrites unless explicitly overridden
- Failed saves now fail the job (non-zero exit)

## Manual ingestion

Run individual scrapers manually:

```zsh
bun run scrape:mortgage
```

Run all:

```zsh
bun run scrape:all
```
