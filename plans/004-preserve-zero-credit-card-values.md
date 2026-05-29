# Plan 004: Preserve zero-valued credit-card fees and rates

> **Executor**: Read the plan, run the drift check first, and stop under the conditions below. Update this plan's row in `plans/README.md` when complete. Do not execute the live scraper for verification.
>
> **Drift check**: `git diff --stat 5c9ae82..HEAD -- apps/api/bin/scrape-credit-card-rates.ts apps/api/src/models/plan.ts`. Plans 002 and 003 intentionally change the scraper entrypoint; continue only if the numeric extraction at lines 128-151 remains equivalent. Inspect uncommitted changes with `git diff --`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/002-reject-empty-scrapes.md`, `plans/003-fail-scraper-jobs-on-error.md` because they touch the same entrypoint
- **Category**: bug, tests
- **Planned at**: commit `5c9ae82`, 2026-09-24

## Why this matters

The credit-card scraper uses JavaScript's `|| null` after `parseFloat`. Since zero is falsy, a genuine $0 fee or 0% rate is published as `null`, meaning unknown or absent. The public schema already permits `0`; correct the parser without changing response shape or historical storage.

## Current state and conventions

- `apps/api/bin/scrape-credit-card-rates.ts:128-140`:
  ```ts
  const primaryFeeNZD = parseFloat($(cells[3]).text().trim()) || null;
  const balanceTransferRate = parseFloat($(cells[4]).text().trim()) || null;
  const cashAdvanceRate = parseFloat($(cells[6]).text().trim()) || null;
  const purchaseRate = parseFloat($(cells[7]).text().trim()) || null;
  ```
  `interestFreePeriodInMonths` at `:130-131` uses the same pattern; apply the same missing-versus-zero rule to it, without changing its units in this plan.
- `apps/api/src/models/plan.ts:17-39` explicitly includes `0.0` among allowed numeric examples and wraps each numeric field in `t.Nullable(t.Number(...))`.
- Scraper output is schema-validated before `hasDataChanged` and saved. A corrected zero will publish on the next changed scrape. Match Bun tests in `test/data-loader.test.ts`, strict TypeScript, and Biome formatting.

## Commands

| Purpose | Command | Expected result |
| --- | --- | --- |
| Focused test | `bun test test/credit-card-number.test.ts` | Exit 0 |
| Typecheck | `bun run typecheck` | Exit 0 |
| Suite | `bun test` | Exit 0 |
| Lint | `bun run lint` | Exit 0 after unrelated web lint is resolved |

## Scope

**In scope**: `apps/api/bin/scrape-credit-card-rates.ts`; new `apps/api/bin/parse-optional-number.ts`; new `test/credit-card-number.test.ts`.

**Out of scope**: public `Plan` schema, other scrapers, credit-card units/field names, D1 storage, source scraping URL, docs and web files.

## Git workflow

Use isolated branch/worktree `feature/004-preserve-zero-credit-card-values`. Match recent imperative commit subjects if asked to commit. Do not push or open a PR unless instructed.

## Steps

1. Create a pure `parseOptionalNumber(text: string): number | null` helper under `apps/api/bin/parse-optional-number.ts`. Trim input; return `null` for blank text or when `parseFloat` is `NaN`; otherwise return the parsed value, including zero. Preserve current permissive `parseFloat` treatment of decorated source text; stricter source validation is separate work. **Verify**: `bun run typecheck` → exit 0.
2. Add Bun tests for `"0"`, `"0.00"`, positive decimal text, empty/whitespace text, and a nonnumeric placeholder. Assert numeric zero stays zero and only absent/invalid values become null. **Verify**: `bun test test/credit-card-number.test.ts` → all cases pass.
3. Replace the five `parseFloat(... ) || null` expressions in `addPlanTo` with calls to the helper, passing the same cell text. Do not alter column indexes or the `Plan` object. **Verify**: `rg -n 'parseFloat\(|parseOptionalNumber' apps/api/bin/scrape-credit-card-rates.ts` → five helper calls and no old `parseFloat(... ) || null` expression; `bun run typecheck` → exit 0.
4. Run `bun test`, `bun run lint`, and `git diff --check`. **Verify**: all exit 0, except report the unrelated existing web lint error if still present.

## Test plan and done criteria

The focused test must distinguish zero from null. All five nullable numeric fields in `addPlanTo` must use the tested helper. `bun run typecheck`, `bun test`, and `git diff --check` pass; lint passes when the separate web import-order issue is resolved. No live scrape or D1 write is run. Only Scope files change.

## STOP conditions

- The upstream source encodes zero in a way the existing parser did not support and the helper cannot handle without revising a broader parsing contract.
- Plan 002/003 refactors numeric extraction to a different file; report the drift and request a plan update rather than editing a new out-of-scope file.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

Review every future optional number conversion for `|| null`; it collapses valid zero. The `interestFreePeriodInMonths` field may have a separate unit problem, but changing its units requires a public contract decision and is outside this plan.
