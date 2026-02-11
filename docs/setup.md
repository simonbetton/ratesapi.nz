# Setup

## 1. Install dependencies

```zsh
bun install
```

## 2. Configure environment variables

Create your local env file:

```zsh
cp .env.local.example .env.local
```

Required variables:

- `CONVEX_INGEST_SECRET`
- `ENVIRONMENT` (`development` or `production`)

`CONVEX_URL` is injected automatically when using `bun run dev`.
If you run the API without Convex (`bun run dev:api`) or run scraper scripts directly, set `CONVEX_URL` explicitly.

## 3. Start local development

```zsh
bun run dev
```

This runs Convex and the API together.
On first run, Convex CLI may prompt you to configure/select a dev deployment.
To force a local Convex dev deployment, run once:

```zsh
bun run convex:configure-local
```

## 4. Deploy Convex schema/functions

```zsh
npx convex deploy
```

## 5. Run scrapers

For local or production deployment targets:

```zsh
bun run scrape:mortgage
bun run scrape:personal
bun run scrape:car
bun run scrape:credit
```

or run all:

```zsh
bun run scrape:all
```

## 6. Migrate legacy D1 data (one-time)

Easy path (uses `.env.local` and syncs the ingest secret first):

```zsh
bun run local:migrate:d1
```

If your historical dataset is large:

```zsh
bun run local:migrate:d1:small
```

Direct from Cloudflare D1 (manual env vars):

```zsh
CLOUDFLARE_D1_DATABASE="ratesapi-data" bun run migrate:d1
```

The script uses Wrangler to query `historical_data` and `latest_data`, then writes to Convex.
This default path uses remote D1 access and does not require `wrangler.toml`.

Optional explicit mode flags:

```zsh
bun run migrate:d1 -- --d1 ratesapi-data --remote
```

`--local` requires a Wrangler configuration with a matching D1 binding.
For very large datasets, tune page size:

```zsh
D1_MIGRATION_PAGE_SIZE=100 bun run migrate:d1 -- --d1 ratesapi-data --remote
```

From existing JSON exports:

```zsh
bun run migrate:d1 ./exports/historical_data.json ./exports/latest_data.json
```

This migrates historical snapshots and latest records into Convex.

## 7. Deploy to production

Deployments are automated via GitHub Actions:

- `.github/workflows/deploy.yml` deploys Convex + Vercel on `main`
- `.github/workflows/scrape.yml` runs hourly ingestion

Required repository secrets:

- `CONVEX_DEPLOY_KEY`
- `CONVEX_URL`
- `CONVEX_INGEST_SECRET`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
