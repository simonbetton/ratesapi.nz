# Plan 001: Install web dependencies before shared CI checks

> **Executor**: Read this whole plan. Run the drift check first and stop on any condition below. Update this plan's row in `plans/README.md` when complete. Do not reset or clean unrelated working-tree changes.
>
> **Drift check**: `git diff --stat 5c9ae82..HEAD -- .github/workflows/ci.yml .github/workflows/deploy.yml .github/workflows/scrape.yml`. If any listed workflow changed, compare the excerpts below with live code; stop if the installation or check sequence has materially changed. Also inspect uncommitted changes to these paths with `git diff --` before editing.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `5c9ae82`, 2026-09-24

## Why this matters

The root `check` script invokes the web app's TypeScript check, but each GitHub Actions workflow installs dependencies only at the repository root. The root `package.json` does not declare Bun workspaces; `apps/web` has its own `package.json` and `bun.lock`. A clean runner therefore has no guaranteed installation of the web toolchain. Install the web package from its own frozen lockfile anywhere a workflow runs the shared check.

## Current state and conventions

- `package.json:17,21`: `"typecheck:web": "bun --bun run --cwd apps/web typecheck"`; `"check": "bun run lint && bun run typecheck && bun run typecheck:docs && bun run typecheck:web && bun test"`.
- `apps/web/package.json`: separate private package with `"typecheck": "tsc --noEmit"`; `apps/web/bun.lock` is its lockfile. Do not convert the repository to workspaces in this plan.
- `.github/workflows/ci.yml:25-29`:
  ```yaml
  - name: Install dependencies
    run: bun install --frozen-lockfile
  - name: Run check
    run: bun run check
  ```
- `.github/workflows/deploy.yml:20-24` and `.github/workflows/scrape.yml:30-34` repeat the root install followed by `bun run check`. Match the existing two-space YAML indentation and `bun install --frozen-lockfile` convention.
- The web redesign has existing unrelated uncommitted work. At planning time `bun run lint` failed on import ordering in `apps/web/vite.config.ts`; do not fix that file under this plan.

## Commands

| Purpose | Command | Expected result |
| --- | --- | --- |
| Check the web package | `bun --bun run --cwd apps/web typecheck` | Exit 0 after both installs |
| Check workflow edits | `git diff --check` | Exit 0 |
| Full project gate | `bun run check` | Exit 0 once the unrelated web lint change is settled |

## Scope

**In scope**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/scrape.yml`.

**Out of scope**: `package.json`, all lockfiles, `apps/web/vite.config.ts`, API and docs code, deployment commands, scheduled scraper logic, and the unrelated working-tree edits.

## Git workflow

Use an isolated branch or worktree named `feature/001-install-web-dependencies-in-ci`. Recent commits use short imperative subjects; follow that style if asked to commit. Do not push or open a PR unless instructed.

## Steps

1. In each of the three workflows, add an `Install web dependencies` step immediately after the root install and before `bun run check`:
   ```yaml
   - name: Install web dependencies
     working-directory: apps/web
     run: bun install --frozen-lockfile
   ```
   **Verify**: `rg -n 'Install web dependencies|working-directory: apps/web|bun install --frozen-lockfile' .github/workflows/{ci,deploy,scrape}.yml` → all three files show the new step between root install and check.
2. From a fresh checkout or isolated worktree, run root `bun install --frozen-lockfile`, then `bun install --frozen-lockfile` with working directory `apps/web`, then `bun --bun run --cwd apps/web typecheck`. This is local verification only; no deployment or scraper commands. **Verify**: the web typecheck exits 0.
3. Run `git diff --check` and `bun run check`. **Verify**: both exit 0. If `bun run check` fails only on the pre-existing web import-order error, report that as an external blocker and do not edit it here.

## Test plan and done criteria

No new unit test is needed for a YAML installation step. The clean-checkout install and web typecheck are the meaningful integration test. All three workflows must contain the web install before `bun run check`; both installs must use frozen lockfiles. `git diff --check` and web typecheck must pass. `bun run check` must pass before marking DONE, unless the operator explicitly accepts the documented unrelated lint blocker. No files outside Scope may be changed.

## STOP conditions

- The root manifest gains workspaces, or web no longer has its own lockfile.
- A workflow's install/check order no longer matches Current state.
- A frozen web install changes its lockfile or fails because it is stale; report the lockfile mismatch instead of regenerating it outside Scope.
- Full check is blocked by the existing web lint error or another unrelated failure; report it without expanding scope.

## Maintenance notes

Every new workflow that invokes root `bun run check` must install `apps/web` first while the web package remains outside root workspaces. Reviewers should confirm the scheduled scraper still has no web build or deployment step.
