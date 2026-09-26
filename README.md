<br />
<h1 align="center">
  Rates API
</h1>
<p align="center">
  ✨ <a href="https://www.ratesapi.nz">https://www.ratesapi.nz</a> ✨
  <br />
  A free JSON API for New Zealand mortgage, personal loan, car loan, and credit card rates, updated hourly.
</p>
<br />

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/simonbetton/ratesapi.nz" alt="License"></a>
  <a href="https://github.com/simonbetton/ratesapi.nz/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/simonbetton/ratesapi.nz/ci.yml?branch=main&label=CI" alt="CI"></a>
</p>
<br />

Rates API collects the interest rates of New Zealand financial institutions from [interest.co.nz](https://www.interest.co.nz) every hour. It serves the newest rates and a daily snapshot history. You don't need an API key, and every response is JSON. AI agents can use the data through an MCP endpoint, the OpenAPI document, or `llms.txt`.

> [!NOTE] The data can be wrong. Check rates with the financial institution before you make a decision.

## Usage

```bash
# Newest mortgage rates from all institutions
curl https://www.ratesapi.nz/api/v1/mortgage-rates

# Fixed 12-month rates only
curl "https://www.ratesapi.nz/api/v1/mortgage-rates?termInMonths=12"

# One institution
curl https://www.ratesapi.nz/api/v1/mortgage-rates/institution:anz

# Snapshots in a date range
curl "https://www.ratesapi.nz/api/v1/mortgage-rates/time-series?startDate=2026-04-01&endDate=2026-04-30&institutionId=institution:anz"
```

### Endpoints

| Category | List | By ID | Time series |
| --- | --- | --- | --- |
| Mortgages | `/api/v1/mortgage-rates` | `/api/v1/mortgage-rates/{institutionId}` | `/api/v1/mortgage-rates/time-series` |
| Personal loans | `/api/v1/personal-loan-rates` | `/api/v1/personal-loan-rates/{institutionId}` | `/api/v1/personal-loan-rates/time-series` |
| Car loans | `/api/v1/car-loan-rates` | `/api/v1/car-loan-rates/{institutionId}` | `/api/v1/car-loan-rates/time-series` |
| Credit cards | `/api/v1/credit-card-rates` | `/api/v1/credit-card-rates/{issuerId}` | `/api/v1/credit-card-rates/time-series` |

The API stores at most one snapshot per dataset per UTC day, and only on days when the data changed. Each time-series response has an `availableDates` field that lists the dates with data.

| Path | Purpose |
| --- | --- |
| `/api/v1/health` | Health check, with the last change and last successful collection of each dataset |
| `/openapi` | Interactive API reference (Scalar) |
| `/openapi/json` | OpenAPI document for SDK and tool generators |
| `POST /api/v1/mcp` | [Model Context Protocol](https://modelcontextprotocol.io) endpoint with read-only tools for each category |
| `/llms.txt` | Plain-text index of the documentation pages |

Read the [documentation](https://www.ratesapi.nz/docs) for IDs, date filters, errors, and the MCP protocol details.

## How it works

| Component | Path | Runs on |
| --- | --- | --- |
| API | `apps/api` | Cloudflare Workers ([Elysia](https://elysiajs.com)) serving `/api/v1/*` and `/openapi*` |
| Docs | `apps/docs` | Cloudflare Workers ([Next.js](https://nextjs.org) + [Fumadocs](https://fumadocs.dev) via OpenNext), serving `/docs*` |
| Landing page | `apps/web` | Cloudflare Workers ([TanStack Start](https://tanstack.com/start)), serving everything else on `www.ratesapi.nz` and redirecting the apex to `www` |
| Database | `apps/api/schema.sql` | [Cloudflare D1](https://developers.cloudflare.com/d1/), holding the newest datasets and snapshots |
| Scrapers | `apps/api/bin` | GitHub Actions, every hour ([Cheerio](https://cheerio.js.org)) |

GitHub Actions also run CI, deploy on every push to `main`, and check the production API every 15 minutes. A failed check opens an issue.

## Development

You need [Bun](https://bun.sh). A Cloudflare account is only needed for remote D1 access or deployment.

```bash
git clone https://github.com/simonbetton/ratesapi.nz.git
cd ratesapi.nz
bun i
bun run dev
```

`bun run dev` starts all three apps. The API creates a local D1 database and seeds it with a small sample dataset.

| App    | URL                        |
| ------ | -------------------------- |
| `api`  | http://localhost:8787      |
| `docs` | http://localhost:3000/docs |
| `web`  | http://127.0.0.1:3002      |

To run one app, use `bun run --filter <app> dev`.

To load real rates into your local database, run the scrapers:

```bash
bun run --filter api scrape:local
```

> [!WARNING] `bun run --filter api dev:remote` connects to the **production** D1 database. The API endpoints only read data, but don't run any script that writes while you use this connection.

### Checks

```bash
bun run check   # Oxlint, Oxfmt, type checks, and Bun tests
bun run build   # Builds each app the same way CI does
```

Run `bun run check` before you open a pull request.

## Deployment

```bash
bun run deploy
```

This deploys the API Worker (`ratesapi-nz`), the docs Worker (`ratesapi-nz-docs`), and the landing page Worker (`ratesapi-nz-web`). For D1 setup, route configuration, and the GitHub Actions secrets, read the [deployment guide](https://www.ratesapi.nz/docs/open-source/deployment).

## Contributing

Issues and pull requests are welcome. When you change an endpoint, update its route, schema, OpenAPI description, and contract test together. Write the docs pages and OpenAPI descriptions in [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org). The [open source guide](https://www.ratesapi.nz/docs/open-source) covers the repository layout.

## License

MIT. See [LICENSE](LICENSE).
