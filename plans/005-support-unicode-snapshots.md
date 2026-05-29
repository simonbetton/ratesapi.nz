# Plan 005: Serialize Unicode snapshots without breaking stored data

> **Executor**: Read the whole plan and run the drift check first. Stop under the conditions below. Update this plan's row in `plans/README.md` when complete. Verification must use local tests, never production D1.
>
> **Drift check**: `git diff --stat 5c9ae82..HEAD -- apps/api/src/lib/data-loader.ts test/data-loader.test.ts`. Compare excerpts below if either file changed, and inspect uncommitted changes with `git diff --`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none; coordinate before merging other serializer edits
- **Category**: bug, tests
- **Planned at**: commit `5c9ae82`, 2026-09-24

## Why this matters

`btoa` accepts a byte string, but `JSON.stringify` can emit Unicode characters outside its range. A name containing a Māori macron or curly punctuation throws `InvalidCharacterError` before either D1 write, blocking an entire dataset update. The fix must continue to read every existing base64 snapshot; changing only the encoder to emit ASCII-safe JSON preserves that requirement.

## Current state and conventions

- `apps/api/src/lib/data-loader.ts:103-109`:
  ```ts
  export function toSavableJson(json: unknown) {
    return btoa(JSON.stringify(json));
  }

  export function fromSavableJson(json: string): unknown {
    return JSON.parse(atob(json));
  }
  ```
- `apps/api/bin/utils.ts:62` calls the encoder before historical/latest writes. `apps/api/src/lib/data-loader.ts:48,95,156` and `apps/api/bin/utils.ts:160` decode stored snapshots.
- `test/data-loader.test.ts:9-22` checks an ASCII round-trip only. Add cases in that same file using `bun:test`, `describe`, `test`, and `expect`.
- Snapshots are intentionally base64 JSON documents in D1, with daily history. Do not migrate D1 or change the public JSON response. Match strict TypeScript and Biome's two-space/double-quote convention.

## Commands

| Purpose | Command | Expected result |
| --- | --- | --- |
| Focused tests | `bun test test/data-loader.test.ts` | Exit 0 |
| Typecheck | `bun run typecheck` | Exit 0 |
| API contracts | `bun test test/api-contract.test.ts` | Exit 0 |
| Lint | `bun run lint` | Exit 0 after unrelated web lint is resolved |

## Scope

**In scope**: `apps/api/src/lib/data-loader.ts`, `test/data-loader.test.ts`.

**Out of scope**: D1 schema, Wrangler writer, existing stored rows, API routes/schemas, web/docs, a new storage format or migration tool.

## Git workflow

Use isolated branch/worktree `feature/005-support-unicode-snapshots`. Match recent imperative commit subjects if asked to commit. Do not push or open a PR unless instructed.

## Steps

1. In `test/data-loader.test.ts`, add a failing round-trip case containing a macron, curly punctuation, and an emoji. Add a legacy-read case using a base64 blob produced by the old formula `btoa(JSON.stringify(value))` for a Latin-1 value; construct that blob in the test independently of `toSavableJson`. The old encoder cannot encode macrons but could encode Latin-1. **Verify**: `bun test test/data-loader.test.ts` → new Unicode case fails with `InvalidCharacterError`, legacy case passes.
2. Change only `toSavableJson`: escape all non-ASCII UTF-16 code units in the JSON string as four-digit `\uXXXX` sequences before passing it to `btoa`. This keeps the outer base64 JSON format, and `JSON.parse(atob(...))` resolves escapes back to original Unicode. Keep `fromSavableJson` unchanged for legacy rows. Do not use a new UTF-8 byte encoding unless a backward-compatible decoder is explicitly designed and tested. **Verify**: `bun test test/data-loader.test.ts` → all cases pass, including Unicode and legacy.
3. Run `bun run typecheck`, `bun test test/api-contract.test.ts`, `bun run lint`, and `git diff --check`. **Verify**: all exit 0. If lint fails only on the previously observed `apps/web/vite.config.ts` import-order issue, report it as an external blocker.

## Test plan and done criteria

The round-trip test covers macrons, typographic punctuation, emoji, ASCII, and a legacy Latin-1 blob. Both focused and API contract tests pass, as do typecheck and `git diff --check`. The decoder remains compatible with old stored snapshots; no D1 migration or live write is performed. Only Scope files change. Lint must pass after the separate web issue is resolved.

## STOP conditions

- Real stored snapshot blobs are not base64 of JSON text as `fromSavableJson` assumes.
- The fix requires altering D1 rows or changing the decoder's legacy behavior.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

Future serialization changes must round-trip Unicode and decode pre-change rows. Review the literal escaping carefully: the serialized JSON must contain one backslash before `uXXXX`, not double-escaped text or UTF-8 bytes that `atob` alone cannot decode.
