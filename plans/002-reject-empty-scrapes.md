# Plan 002: Reject empty or structurally broken scrapes before persistence

> **Executor**: Read this whole plan. Run the drift check first; stop on the conditions below. Update the row in `plans/README.md` when complete. Do not run scraper entrypoints against live D1 while verifying.
>
> **Drift check**: `git diff --stat 5c9ae82..HEAD -- apps/api/bin/scrape-{mortgage,personal-loan,car-loan,credit-card}-rates.ts`. Compare the excerpts below if any file changed, and inspect uncommitted changes with `git diff --` before editing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none; finish before Plan 003 on the same scraper files
- **Category**: bug, tests
- **Planned at**: commit `5c9ae82`, 2026-09-24

## Why this matters

All four scrapers accept an HTTP 200 page even if the expected rate table is absent. An empty parse still satisfies each `t.Array(...)` schema, then `hasDataChanged` treats it as a change and `saveToD1` can replace useful latest data and that day's history with an empty snapshot. A changed table layout can also create providers with no actual rates. Fail ingestion before the change comparison or any D1 write.

## Current state and conventions

- Each entrypoint lives under `apps/api/bin/scrape-<family>-rates.ts`. For example, `scrape-mortgage-rates.ts:79-84` parses `getModelExtractedFromDOM($)` into a `MortgageRates` model; `:95-105` compares and saves it. The personal, car, and credit-card scripts have the same sequence at lines `69-95`, `71-97`, and `69-95` respectively.
- Every scraper's `config.tableSelector` is `"#interest_financial_datatable tbody tr"`; the mortgage parser at `scrape-mortgage-rates.ts:120-141` loops selected rows and returns an empty array if none are present. Other parsers behave similarly.
- `apps/api/src/models/mortgage-rates.ts:84` uses `data: t.Array(MortgageInstitution)` without a minimum. Keep public response schemas unchanged; protect the ingestion boundary instead.
- The scraper source is the interest.co.nz aggregate table (`apps/api/src/lib/interest-scraper-api.ts:12`). Preserve the stated design: hourly collection, skip writes when content is unchanged, daily historical replacement when it changes.
- Existing tests use `bun:test` with `describe`, `test`, and `expect`; see `test/data-loader.test.ts:1-22`. Match strict TypeScript and Biome's two-space, double-quote style.

## Commands

| Purpose | Command | Expected result |
| --- | --- | --- |
| Focused tests | `bun test test/scrape-guards.test.ts` | Exit 0, all cases pass |
| Typecheck | `bun run typecheck` | Exit 0 |
| Lint | `bun run lint` | Exit 0 after unrelated current web lint is resolved |
| All tests | `bun test` | Exit 0 |

## Scope

**In scope**: four `apps/api/bin/scrape-*-rates.ts` entrypoints, new `apps/api/bin/scrape-guards.ts`, new `test/scrape-guards.test.ts`.

**Out of scope**: public schemas/routes, D1 SQL or schema, `apps/api/bin/utils.ts`, scraper failure exit behavior (Plan 003), numeric parsing (Plan 004), docs and web files.

## Git workflow

Use isolated branch/worktree `feature/002-reject-empty-scrapes`. Follow recent imperative commit subjects if asked to commit. Do not push or open a PR unless instructed.

## Steps

1. Add a pure `assertScrapeHasRates` function in `apps/api/bin/scrape-guards.ts`, accepting `SupportedModels` from `apps/api/src/lib/data-loader.ts`. It must throw when `data` is empty, when no provider has a product/plan, or when loan products have no rates. For credit cards, a nonempty issuer must have at least one plan. Keep it independent of fetch, Wrangler, and process exit. **Verify**: `bun run typecheck` → exit 0.
2. Add `test/scrape-guards.test.ts` using the existing Bun test style. Cover one minimal valid model from each family; all four empty top-level arrays; mortgage/personal/car providers with empty products or empty rates; credit-card issuer with empty plans. A fixture with an otherwise valid model and one empty product may remain valid if another product has a rate—the required invariant is at least one usable rate/plan in the whole snapshot. **Verify**: `bun test test/scrape-guards.test.ts` → all cases pass.
3. In all four scripts, after `parseSchema(...)` returns and before `hasDataChanged`, call the guard. Also fail explicitly when the expected table selector has no rows, so a missing table is distinguishable in logs from parsed-but-empty data. Put both checks inside the existing extraction/validation `try` block; its catch already throws. **Verify**: `rg -n 'assertScrapeHasRates|tableSelector|hasDataChanged' apps/api/bin/scrape-*-rates.ts` → each script has a guard before comparison; `bun run typecheck` → exit 0.
4. Run `bun test`, `bun run lint`, and `git diff --check`. **Verify**: all exit 0. If only the pre-existing web import-order lint error remains, report it without editing web code.

## Test plan and done criteria

The new guard tests must prove that a missing/empty/zero-rate scrape throws while normal fixtures for every family pass. No test may run the entrypoints, fetch the real upstream, or write D1. All four entrypoints must guard before `hasDataChanged` and `saveToD1`. `bun run typecheck`, `bun test`, and `git diff --check` must pass. `bun run lint` must pass before DONE, subject only to the documented external web blocker. No file outside Scope changes.

## STOP conditions

- Any scraper's source selector or parser shape materially differs from the excerpts.
- A legitimate supported family has no rate/plan entries by design; report the case before weakening the invariant.
- Guarding requires changing public API schemas or touching persistence code.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

When the upstream table or a new family is added, update the ingestion guard and its fixtures. This prevents a total wipeout, but it does not detect plausible yet incomplete tables; quantitative coverage checks would be separate work. Plan 003 should make the thrown guard error fail the scheduled job.
