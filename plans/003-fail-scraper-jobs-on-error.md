# Plan 003: Fail scheduled scraper jobs when collection or saving fails

> **Executor**: Read the whole plan, run the drift check first, and stop under the conditions below. Update this plan's row in `plans/README.md` when complete. Never execute a scraper against production during verification.
>
> **Drift check**: `git diff --stat 5c9ae82..HEAD -- apps/api/bin/scrape-{mortgage,personal-loan,car-loan,credit-card}-rates.ts apps/api/bin/utils.ts .github/workflows/scrape.yml`. Plan 002 intentionally changes the four scraper files; compare the failure paths below with live code and continue only if they still match. Inspect uncommitted changes with `git diff --`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/002-reject-empty-scrapes.md`
- **Category**: bug, tests
- **Planned at**: commit `5c9ae82`, 2026-09-24

## Why this matters

The hourly job executes the four scraper scripts sequentially. Each script can log a fetch failure and return normally, and `saveToD1` can return `false` while the caller displays a success spinner. The final `.catch(console.error)` also leaves the process successful. GitHub Actions therefore reports green even when published rates are stale. Error paths must exit nonzero while a successful unchanged scrape remains successful.

## Current state and conventions

- `.github/workflows/scrape.yml:43-53` runs the four Bun entrypoints as separate steps. Actions uses each command's exit status to decide whether the job failed.
- `apps/api/bin/scrape-mortgage-rates.ts:62-71` catches a fetch error, logs it, and `return`s; `:105-113` treats `saved === false` as a success message and returns on thrown errors; `:116` uses `main().catch(console.error)`. The personal, car, and credit-card entrypoints repeat this pattern around lines `52-106`, `54-108`, and `52-106`.
- `apps/api/bin/utils.ts:37-40` declares `saveToD1(...): Promise<boolean>`; it returns `false` when D1 is unavailable at `:57` or catches a write error at `:119`. Preserve this API so the caller can make the job fail.
- `apps/api/bin/scrape-mortgage-rates.ts:95-99` exits normally when content is unchanged. That is intended: history stores changed daily snapshots and should not write unchanged data.
- Match existing TypeScript, Bun `bun:test` (`test/data-loader.test.ts`), Biome formatting, and simple imperative log messages.

## Commands

| Purpose | Command | Expected result |
| --- | --- | --- |
| Focused tests | `bun test test/scrape-runner.test.ts` | Exit 0 |
| Typecheck | `bun run typecheck` | Exit 0 |
| Suite | `bun test` | Exit 0 |
| Lint | `bun run lint` | Exit 0 after unrelated web lint is resolved |

## Scope

**In scope**: four `apps/api/bin/scrape-*-rates.ts` entrypoints; new `apps/api/bin/scrape-runner.ts`; new `test/scrape-runner.test.ts`.

**Out of scope**: `.github/workflows/scrape.yml`, `apps/api/bin/utils.ts`, D1 schema/SQL, public API, numerical parsing (Plan 004), all web/docs files. Do not add retries or change the unchanged-snapshot policy.

## Git workflow

Use isolated branch/worktree `feature/003-fail-scraper-jobs-on-error`. Follow recent imperative commit subjects if asked to commit. Do not push or open a PR unless instructed.

## Steps

1. Add a pure orchestration boundary in `apps/api/bin/scrape-runner.ts` that accepts injected asynchronous `loadCurrent`, `fetchHtml`, `parseAndValidate`, and `save` functions plus a `hasChanged` comparison. It returns a discriminated outcome (`saved` or `unchanged`), throws on fetch/parse errors, and throws when `save` resolves `false`. It must invoke `save` exactly once for changed data and never for unchanged data. Use generic types only where they clarify the contract; retain the concrete family schemas in entrypoints. **Verify**: `bun run typecheck` → exit 0.
2. Add `test/scrape-runner.test.ts` using injected in-memory functions. Cover: changed data saves once and returns `saved`; identical data returns `unchanged` and does not save; fetch rejection propagates; parser/Plan 002 guard rejection propagates; `save` resolving false throws; save rejection propagates. No real network or D1 calls. **Verify**: `bun test test/scrape-runner.test.ts` → all six paths pass.
3. Adapt each entrypoint's `main` to call the runner with its existing loader, upstream fetcher, model parser plus Plan 002 guard, comparison, and `saveToD1`. Keep useful spinners/logs, but use failure indicators on errors. At the top level use `main().catch(...)` that logs and sets `process.exitCode = 1` (or equivalent nonzero exit) rather than swallowing rejection. **Verify**: `rg -n 'process.exitCode|runScrape' apps/api/bin/scrape-*-rates.ts` → all four scripts have both; `bun run typecheck` → exit 0.
4. Run `bun test`, `bun run lint`, and `git diff --check`. **Verify**: all exit 0. Report the known pre-existing `apps/web/vite.config.ts` import-order error if it is the only lint blocker; do not edit web code here.

## Test plan and done criteria

Model the test file on `test/data-loader.test.ts`, asserting outcomes and call counts rather than log text. Changed, unchanged, and four failure cases must pass. All four real entrypoints must use the tested runner and end rejected promises with a nonzero process exit code. `bun run typecheck`, `bun test`, and `git diff --check` pass; lint passes when the unrelated web error is resolved. No live scraper or D1 command is a verification gate. No files outside Scope change.

## STOP conditions

- Plan 002's guard or parser shape differs so much that the listed runner boundary cannot accommodate it without public API or persistence changes.
- A scraper has a documented reason to succeed after a fetch or save failure.
- A verification command fails twice after one reasonable correction.
- A fix requires changing the workflow, D1 helper, or other out-of-scope file.

## Maintenance notes

Future scrapers should use the same runner so Actions receives reliable exit status. Review that `unchanged` is success and that `saveToD1(false)` is failure; confusing those states would create false alerts or silently stale data.
