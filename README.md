<br />
<h1 align="center">
  Rates API
</h1>
<p align="center">
  ✨ <a href="https://ratesapi.nz">https://ratesapi.nz</a> ✨
  <br />
  Free OpenAPI service for New Zealand lending rates, updated hourly.
</p>
<br />

<p align="center">
  <a href="docs/setup.md">Setup</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/api-endpoints.md">API Endpoints</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/data-collection.md">Data Collection</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="docs/development.md">Development</a>
</p>
<br />

## Stack

- [Bun](https://bun.sh/)
- [Hono](https://hono.dev/)
- [Convex](https://www.convex.dev/) for time-series storage + aggregates
- [Vercel](https://vercel.com/) for API hosting
- [Cheerio](https://cheerio.js.org/) for scraping
- [Zod](https://zod.dev/) for schema validation

## Quick Start

```zsh
# Install dependencies
bun install

# Start Convex + local API server (http://localhost:8787)
bun run dev
```

## Required Environment Variables

- `CONVEX_INGEST_SECRET`: Shared secret required for snapshot ingestion mutations
- `ENVIRONMENT`: `development` or `production`

Notes:
- `bun run dev` runs `convex dev --run-sh ...`, which injects `CONVEX_URL` for the API process.
- If you run only `bun run dev:api`, then you must provide `CONVEX_URL` manually.
- To pin Convex to a local dev deployment, run `bun run convex:configure-local` once.

Create local env file:

```zsh
cp .env.local.example .env.local
```

## Convex Setup

```zsh
# Authenticate and deploy schema/functions
npx convex deploy
```

## Scraping

```zsh
# Run one scraper
bun run scrape:mortgage

# Run all scrapers
bun run scrape:all
```

Each scraper:
- Loads current snapshot from Convex
- Scrapes latest rates from interest.co.nz
- Validates and compares data
- Applies guardrails to prevent suspicious overwrite
- Writes snapshot + daily aggregates to Convex

## Migrate Legacy D1 Data to Convex

Easy path with `.env.local`:

```zsh
bun run local:migrate:d1
```

For large datasets:

```zsh
bun run local:migrate:d1:small
```

Direct from D1 (manual env vars):

```zsh
CLOUDFLARE_D1_DATABASE="ratesapi-data" bun run migrate:d1
```

This uses remote D1 access (no `wrangler.toml` binding required).
For very large datasets, lower page size with `D1_MIGRATION_PAGE_SIZE`, for example:

```zsh
D1_MIGRATION_PAGE_SIZE=100 CLOUDFLARE_D1_DATABASE="ratesapi-data" bun run migrate:d1
```

Or from exported JSON files:

```zsh
bun run migrate:d1 ./exports/historical_data.json ./exports/latest_data.json
```

The migration validates payloads and inserts historical snapshots and latest records into Convex.

## Deploy

- `main` branch deploys through GitHub Actions to Convex and Vercel.
- Hourly scraping runs through `.github/workflows/scrape.yml`.

## License

MIT. See `LICENSE`.
