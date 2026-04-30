# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Rates API is a single Cloudflare Worker serving a REST API + documentation site for NZ lending rates. It uses Bun for package management/testing and Node.js for the Wrangler dev server.

### Key gotchas

- **Wrangler requires Node.js**: `bun run dev` will fail because Wrangler doesn't support the Bun runtime. Use `npx wrangler dev --env development src/index.ts` instead, which runs under Node.js.
- **D1 data is base64-encoded**: The `data` column in both `latest_data` and `historical_data` stores base64-encoded JSON (via `btoa(JSON.stringify(...))`). When seeding manually, encode data accordingly.
- **Local D1 initialization**: Before the dev server returns data, run `npx wrangler d1 execute ratesapi-data --file=schema.sql --env=development --local` to create tables.
- **Blocked postinstall**: `fallow` (code health devDependency) has a blocked postinstall; this is non-critical and can be ignored.

### Running services

| Command | Description |
|---------|-------------|
| `npx wrangler dev --env development src/index.ts` | Start local dev server on http://localhost:8787 |
| `bun test` | Run all tests (20 tests, no external deps needed) |
| `bun run lint` | Biome lint/format check |
| `bun run typecheck` | TypeScript type check |
| `bun run check` | Lint + typecheck + tests combined |

### Testing

Tests run entirely in-memory with mocked D1 bindings — no running dev server or database needed. Just `bun test`.

### Environment

- **Bun** — package manager and test runner
- **Node.js** — required for `wrangler dev` and `npx wrangler d1 execute`
- Both must be on PATH (`~/.bun/bin` for Bun, system Node.js)
