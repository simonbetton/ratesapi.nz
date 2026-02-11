# Development

## Technologies

- Bun
- Hono
- Convex
- Vercel
- Zod
- OpenAPI/Swagger
- Cheerio

## Code structure

- `src/`: API, models, shared libs
- `api/[[...route]].ts`: Vercel function entrypoint
- `convex/`: Convex schema + server functions
- `bin/`: scrapers, migration and operational scripts
- `.github/workflows/`: deploy, scrape, uptime automation

## Runtime model

- Vercel serves Hono API endpoints.
- API reads from Convex via `ConvexHttpClient`.
- Scrapers ingest snapshots into Convex.
- Convex stores both raw snapshots and aggregates for time-series use cases.

## Local workflow

```zsh
bun install
bun run dev
```

`bun run dev` starts Convex and then runs the API server via `convex dev --run-sh`.
If you need to pin this project to a local Convex dev deployment, run:

```zsh
bun run convex:configure-local
```

If you only want the API process, use:

```zsh
bun run dev:api
```

In `dev:api` mode, `CONVEX_URL` must already be set.

## Data model summary

Convex tables:

1. `rateSnapshots`
   - Daily snapshot by `dataType` + `snapshotDate`
2. `latestRateData`
   - Latest snapshot per `dataType`
3. `dailyRateAggregates`
   - Daily aggregate metrics per `dataType` + date
4. `ingestionRuns`
   - Ingestion audit trail
