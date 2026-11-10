# Application state machines

Audit date: 2026-11-10. Baseline: `ee6227a`. Scope: application-owned state in `apps/api`, `apps/web`, `apps/docs`, and `.github`; third-party framework internals are outside this audit. This file is the issue register as well as the state-machine specification. Issue identifiers below are local; no external issues were created.

Evidence distinguishes executable reproductions from limitations inferred from code. Tests use local fixtures and databases, never production writes or paid browser sessions.

## Confirmed issue groups, by impact

| Issue | Priority | Invalid reachable transition | Status |
| --- | --- | --- | --- |
| SM-01: publication concurrency and ordering | P1 | Overlapping/stale collections overwrite verified updates or mark different data fresh. | Fixed locally; SQLite and Wrangler D1 regressions pass |
| SM-04: deployment ordering and stale reruns | P1 | Older deployment can finish after newer deployment; a successful old deployment admits a stale collection rerun. | Fixed locally; workflow and shell regressions pass |
| SM-02: history identity, completeness, and recovery | P2 | Chart uses the wrong stored day, silently drops failed monthly reads, caches errors without retry, or skips February. | Fixed locally; loader/calendar regressions pass |
| SM-03: HTTP retry termination and cleanup | P2 | Permanent statuses retry; cancellation starts more attempts; failed responses retain their streams. | Fixed locally; retry regressions pass |
| SM-05: homepage facts refresh lifecycle | P2 | Late failed refresh replaces good facts; early failure removes the timeout without cancelling sibling requests. | Fixed locally; concurrency/cancellation regressions pass |

P1 means lost verified data or a production version regression; P2 means incorrect history presentation, avoidable requests, or temporary loss of homepage facts. The fixes are implemented in this branch; deployment is a separate step. The actionable issue groups are tracked in this document.

### SM-01: publication concurrency and ordering

Evidence: `apps/api/test/publication-concurrency.test.ts`, test “an overlapping partial publisher cannot overwrite a peer's verified update”, fails on the baseline production publication functions. Starting at ANZ=5/Midlands=5, A verifies ANZ=6 and B verifies Midlands=7. Both read 5/5. A saves 6/5, then B saves 5/7 and reports success. `publishDirectDataset` reads before merging; `saveToD1` unconditionally replaces history/latest. Its transaction protects atomicity, not the earlier read. The workflow concurrency group covers scheduled runs, but two documented CLI invocations can overlap. A stale collection can also load after a newer writer and replace newer observations; an unchanged collection can mark a concurrently changed dataset fresh. These transitions need separate ordering and revision guards.

Acceptance: guard both changed and unchanged publications atomically; reject conflicts and older/replayed collections without changing history or freshness; keep partial-update freshness unchanged; bound SQL statements for large datasets; exercise ambiguous acknowledgements and rollback.

Fix: `createPublicationStore` in `apps/api/bin/direct/publication-store.ts` reads data and revision in one query. A conditional claim advances the revision and collection-start watermark in the **same batch** as all history/latest/freshness writes. Every mutation checks ownership of that claim. An older or repeated collection, or a changed baseline, produces a conflict with no writes; callers must collect again before retrying. No automatic rebase of old observations occurs. The additive `publication_state` table is created idempotently for existing databases. Legacy missing-`last_checked` changed saves retain their compatibility fallback.

Tests in `publication-concurrency.test.ts` cover overlapping partial updates, fresh recollection after conflict, a slow older collection, concurrent unchanged freshness checks, replay after a lost acknowledgement, large-payload rollback, and legacy schema behavior. `d1-persistence.integration.test.ts` exercises the actual Wrangler command/file runner against an isolated local D1 database, including claim/history/latest rollback and retry after a forced database failure.

### SM-04: deployment ordering and stale reruns

Evidence: baseline `.github/workflows/deploy.yml` had neither a concurrency group nor a main-branch guard for manual dispatch. Two push runs can deploy concurrently; if B finishes first and A finishes last, A replaces the newer Workers. Cancelling midway can also leave different Worker generations. The collection gate only looked for **any successful deployment of its SHA**, so rerunning A after main advances to B was accepted. `deployment-gate.test.ts`, “a successful old deployment cannot admit a rerun after main advances”, returned exit 0 before the fix. Workflow configuration regressions failed because serialization and the pre-deploy guard were absent.

Fix: serialize production deployments without cancellation, restrict them to main, and run `.github/scripts/assert-current-main.sh` immediately before deployment and on the successful branch of the collection deployment gate. Stale queued/rerun commits fail closed. `deployment-workflow.test.ts` checks these workflow boundaries; the gate tests execute the real shell scripts with controlled GitHub responses.

This prevents the reproduced stale-rerun and overlapping-deployment cases. The three Workers are still separate deployments: provider failures midway through deployment can leave mixed versions, and main can advance after a gate check. That is a deployment architecture limitation, not an atomic rollout guarantee.

### SM-02: history identity, completeness, and recovery

Evidence in `apps/web/src/lib/rates-data.ts` and `components/rates-explorer.tsx`:

- Partial publication preserves an older model `lastUpdated`, while D1 stores the changed snapshot under the **publication** day. Baseline `fetchHistory` fetched only the `lastUpdated` day, omitting newer partial data. A collection crossing UTC midnight could request a nonexistent day. The fixture with an October 9 model timestamp and November 10 snapshot returned October 9 instead of November 10.
- A 503 on a requested monthly snapshot was filtered out and the reduced chart returned `success`. The regression received success when it required an error.
- History errors stayed in `historyCache`. Changing categories revisited the same promise; the history card had no retry button. A new explicit attempt in the regression still received the original error before the fix.
- `Date.UTC(2026, 1, 31)` rolls into March. Subtracting one month from March 31 selected March 3, including March rates in February's slot. The calendar regression received March 3 instead of February 28; it also covers leap-year February 29.

Fix: discover stored days through the history index, fetch the newest actual key, reject incomplete monthly fetches, give history its own retry attempt and button, and clamp month-end dates. Promise identities remain stable within an attempt; different attempts have different cache keys, so late completions cannot overwrite the new attempt. Filter and sort state survive a history retry.

Regressions: `apps/web/test/history-loading.test.ts` and the month-end test in `apps/web/test/rates-explorer.test.ts`.

### SM-03: HTTP retry termination and cleanup

Evidence: `createHttpClient` threw permanent HTTP failures inside the same catch that retried network errors. A 404 with `retryOn: [503]` made **four** requests instead of one. Caller cancellation did not interrupt backoff; the abort regression continued through all attempts and ended with an HTTP error. Failed response bodies were never consumed/cancelled before another attempt started.

Fix: catch only fetch/network exceptions, keep HTTP status handling outside that catch, make backoff abortable, check caller cancellation before attempts/after network errors, and cancel discarded response bodies. Per-attempt timeout failures remain retryable, with a new timeout for each attempt. Only uptime's read-only GETs currently use this helper; the source collector has its own retry machine.

Regressions: `apps/api/test/http-retry-state.test.ts`; existing loopback tests in `http-client.test.ts` still cover timeout recovery and successful body reads.

### SM-05: homepage facts refresh lifecycle

Evidence: two concurrent cold `loadKeyFacts()` calls launched ten API requests. The first returned valid facts; the second finished with a 503 and replaced memory with null for a minute. The isolated Workers-module regression observed `calls: 10` and `cached: false`, losing the successful facts. Separately, `fetchKeyFacts()` cleared its timeout when one sibling failed, leaving slower sibling fetches alive; the regression observed `signal.aborted === false` after the lookup had ended.

Fix: one in-flight refresh per Worker isolate owns the next cache state; all concurrent callers await it. Always abort unfinished siblings on completion/failure. The cache TTLs and static fallback wording are unchanged.

Regressions: `apps/web/test/key-facts-cache.test.ts` (real cache module in an isolated Bun subprocess) and `apps/web/test/key-facts.test.ts` (API-fetch boundary).

## State inventory and transition tables

### 1. Source fetch and parsing

Owners: `apps/api/bin/direct/collect.ts`, `failures.ts`, `types.ts`.

States: unrequested, fetching, redirecting, waiting to retry, fetched, extracting, validated, failed-outage, failed-extraction. A per-run promise cache coalesces URL reads; failures are cached too. Four workers process independent sources.

Invariants: HTTPS and approved origins only; bounded redirects and two HTTP attempts; at most 20 discovered documents; rates finite and within 0–100, ranges have both ordered endpoints, product/rate IDs unique; a failed source contributes no publishable observations. Every source for an institution must succeed before the institution can replace its stored row.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Unrequested | First URL request | Fetching; cache promise |
| Fetching / settled | Concurrent identical URL | Share existing promise |
| Fetching | Same-origin redirect | Redirecting; follow, bounded to five hops |
| Fetching | First 429/5xx or timeout/network failure | Wait 500 ms; fresh HTTP attempt |
| Fetching | Valid nonempty response | Fetched; parse and validate |
| Extracting | Valid observations | Validated |
| Any source phase | Failure | Outage only for recognized fetch failures; otherwise extraction failure |
| Failed | Recovery transport supplied | One fresh pass with independent sessions/cache |
| Failed extraction | Recovery fails with outage | Still blocking; preserve initial extraction evidence |

### 2. Browser transport and session lifecycle

Owners: `apps/api/bin/direct/browser.ts`, `transport.ts`.

States: idle, opening-local, opening-cloud, rendering, retrying-cloud, cached-success, cached-failure, closing, closed/cleanup-failed. Browser pages are serialized through a promise queue; HTTP sources remain independent. Sessions are shared per host; each page normally owns an isolated context. Cloud challenge pages use the existing cloud context and close only their page.

Invariants: no competing browser pages within one transport; errors never expose credential-bearing CDP URLs; cloud disconnect must also stop the billed session; three cloud attempts maximum per URL; payment failure does not repeatedly create sessions within a pass; cleanup attempts both primary and recovery transports.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Idle | Browser URL | Enqueue; open/reuse host session |
| Local rendering | Failure, auto mode and API key | Cloud rendering |
| Cloud rendering | Retryable connection/outage, attempts remain | Close/discard session, switch NZ/AU proxy, retry |
| Cloud opening | HTTP 402 | Cached nonretryable outage for this transport |
| Rendering | Readiness and required feeds pass | Cached HTML/JSON success |
| Rendering | Extraction/readiness failure | Cached failure; next queued task still runs |
| Primary pass complete | Failed sources exist | Separate recovery transport |
| Collection ends | Close | Drain browser queue; stop all opened sessions; report cleanup failure |

### 3. Coverage, reconciliation, publication, and persistence

Owners: `apps/api/bin/direct/collect.ts`, `run.ts`, `publication-store.ts`, `apps/api/bin/utils.ts`, `apps/api/schema.sql`.

Coverage states: active, excluded (reviewed evidence required), or pending. Collection states: complete, partial-outage, partial-blocking, no-replacement. Publication states: collecting, loading baseline, reconciling, saving, unchanged, saved-with-warnings, saved-then-failed, conflicted, failed-without-write.

Invariants: previews never persist; an incomplete institution never replaces its stored row; removals need reviewed exclusions/product decisions; duplicates fail closed; partial publication preserves the previous complete-check time and model `lastUpdated`; complete unchanged checks advance only freshness; independent categories continue after a failure. There is at most one snapshot per UTC day per dataset; history and latest must contain the same payload after a changed save. Revision ownership and strictly increasing collection-start times protect both changed saves and complete unchanged checks. Partial unchanged checks do not claim a revision because they change neither data nor freshness.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Collected | No publishable rows, outages only | Unchanged; warn; preserve freshness |
| Collected | No publishable rows, blockers | Fail without write |
| Loading | Read/schema error | Fail closed; never assume empty database |
| Reconciling | Missing/unreviewed product | Retain entire stored institution; add blocker |
| Reconciling | Reviewed institution exclusion | Remove stored institution |
| Reconciled | Revision changed or collection time not newer | Conflict; no data/history/freshness mutation |
| Reconciled | Equal data, complete | Mark checked; unchanged |
| Reconciled | Equal data, partial | No write; retain freshness |
| Reconciled | Changed | Atomic history/latest batch; complete sets check time, partial preserves it |
| Saved | Outages only | Warn and return success |
| Saved | Blocking failure | Throw after saving healthy institutions |
| Saving | SQL failure | Roll back batch; fail |
| Batch | One category fails | Continue other categories, then throw aggregate failure |

On a lost acknowledgement, the committed revision may already exist. Replaying that collection is rejected; a new collection can proceed. A concurrent writer between commit and acknowledgement verification can cause a conservative reported conflict even if the earlier commit succeeded. The database remains consistent. The guard assumes all production writers use the new store. Historical/low-level unconditional helpers in `utils.ts` are retained for existing persistence tests; production `persistenceFor` no longer uses them. Old deployed binaries or manual SQL do not participate in this protocol. A legacy database has no collection watermark until its first guarded publication; that older ordering history cannot be recovered.

### 4. Schema migration and local initialization

Owners: `apps/api/bin/migrate-d1.ts`, `init-local-d1.ts`, `seed-local-d1.ts`.

States: missing tables, legacy schema, current schema, seeded/empty, failed. Invariant: migration is idempotent and preserves rows; concurrent addition of an already-added column is accepted only after re-reading the schema.

| From | Event | To / effect |
| --- | --- | --- |
| Missing tables | Local setup | Create schema |
| Missing tables | Migration alone | Error; require schema setup |
| Legacy | Add last_checked succeeds | Current |
| Legacy | ALTER fails, re-read finds column | Current; concurrent migration won |
| Legacy | ALTER fails, column absent | Fail |
| Current | Repeated migration | No change |
| Legacy/current | First guarded publication read | Create additive publication_state table if absent |

### 5. API reads, history queries, freshness, and routing

Owners: `apps/api/src/lib/data-loader.ts`, `data-freshness.ts`, `entity-time-series.ts`, `mortgage-time-series.ts`, routes and `app.ts`.

States: validating, reading, success, not-found, unavailable; freshness is unknown, fresh, or stale. These are request-scoped decisions, not sessions.

Invariants: decode and schema-validate data before serving; production never silently falls back to itself; API errors are structured JSON; only development latest-data reads may use production fallback; missing snapshots differ from database failures. Freshness becomes stale after 12 hours without a complete check; no check timestamp means unknown, not fresh. Daily snapshot keys are persistence dates, not necessarily the model's `lastUpdated` date.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Latest read | Valid D1 row | Success |
| Latest read | Failure in development | Fetch/validate production fallback |
| Latest read | Failure in production | Error |
| History index | No dates | No-snapshots error |
| History request | No date/range | Return available dates |
| History request | Single date / valid range | Read and filter snapshots |
| History read | Missing requested date/entity | Not-found |
| Freshness read | last_checked column absent | Return last_updated; check unknown |
| Fresh | Time exceeds threshold | Stale without a write |

### 6. MCP request lifecycle

Owners: `apps/api/src/routes/mcp/index.ts`, `protocol.ts`.

States: transport validation, envelope validation, era resolution, notification accepted, method dispatch, tool success/tool error/protocol error. The implementation is stateless: legacy initialize returns capabilities but does not create a session; later requests do not depend on an earlier handshake.

Invariants: notifications never execute tools; each request resolves its protocol era independently; modern request metadata/mirrored headers validate before dispatch; read-only tools share REST validation; concurrent calls have no shared mutable session.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Transport | GET/DELETE | 405; POST required |
| POST | Malformed JSON/envelope | JSON-RPC error |
| Envelope | Unsupported version/header mismatch | Protocol error |
| Valid envelope | Notification (no id) | 202; no dispatch |
| Legacy | initialize | Negotiate supported legacy revision |
| Modern request | Valid metadata | Dispatch discovery/list/call |
| Tool call | Invalid arguments | Protocol/tool error according to era |
| Tool call | REST success/failure | Tool result/error |
| Legacy headerless / 2025-03-26 | Batch | Concurrent independent replies; omit notifications |

### 7. Browser explorer, requests, and history cache

Owners: `apps/web/src/components/rates-explorer.tsx`, `lib/rates-data.ts`, `rates-stats.ts`, `dom-hooks.ts`.

States: offscreen, loading, loaded, failed; category selection can be pending while the previous category remains visible and dimmed. History loads separately. Filters and sort belong to a keyed category view. Promise caches preserve identity for React `use()` and share concurrent requests within a category/version/attempt.

Invariants: no browser fetch before intersection; the view key resets filters on category changes/retries; missing rates remain missing rather than zero; sort/filter are derived from the selected snapshot; a deliberate retry invalidates its cache.

| From | Event | To / effect |
| --- | --- | --- |
| Offscreen | First intersection | Loading; stays activated |
| Loading | Fetch success/schema valid | Loaded |
| Loading | HTTP/network/format error | Failed |
| Loaded | Select category | Deferred category loading; old view dimmed |
| Category failed | Try again | Delete category/history promises; new keyed attempt |
| History failed | Retry history | New attempt/promise; preserve category filters and sort |
| Loaded | Filter/sort | Recompute rows/charts locally |
| History loading | Index then all required snapshots succeed | Render chart or insufficient data |
| History loading | Any required snapshot fails | Show error and retry action; never silently drop points |
| Monthly sampling | Previous month lacks selected day | Clamp to that month's final day |

### 8. Demo, clipboard, chart focus, and navigation

Owners: `demo-player.tsx`, `copy-button.tsx`, `rate-charts.tsx`, `mobile-nav.tsx`.

| Machine / states | Transition | Invariant |
| --- | --- | --- |
| Demo: example/loading/success/error | Run → loading → success/error; term change → example | Disable term and run while loading; retries start a new request |
| Clipboard: ready/copied/error | Click → async write → copied/error; text-key remount → ready | Feedback belongs to the mounted snippet |
| Chart: inactive/active index | Pointer/focus → index; leave/blur → inactive | Selection only affects highlighting |
| Mobile navigation: closed/open | Native popover toggle, Escape/outside click, link selection | Native popover owns expanded state; same-page links close it |
| Resize/intersection observers | Attach → observe; detach → disconnect | No observer remains attached after its element unmounts |

### 9. Homepage facts cache and content negotiation

Owners: `apps/web/src/lib/key-facts.server.ts`, `key-facts.ts`, `page-negotiation.ts`, `server.ts`; docs routes and search.

Facts states: memory hit, cache lookup, origin lookup, cached facts, cached fallback, refresh pending. A single refresh owns the next memory state per isolate. Invariant: failed lookup returns static fallback, not fabricated statistics; API lookup is time-bounded. Memory success lasts one hour; fallback and cache-derived facts recheck in one minute; edge cache has one-hour TTL.

| From | Event | To / effect |
| --- | --- | --- |
| Memory valid | Request | Return cached facts/fallback |
| Memory expired/absent | Edge cache hit | Use facts; recheck in one minute |
| Refresh pending | Concurrent request | Share the refresh; do not start another generation |
| Cache miss | API success | Save memory and edge cache |
| Cache miss | API failure | Cache null fallback for one minute |
| Origin lookup | Success/failure/timeout | Abort unfinished siblings; release pending refresh |
| HTTP request | Canonical redirect / Markdown negotiation | Redirect / Markdown response with Vary: Accept |
| Page route | Known / missing content | HTML or Markdown with correct 200/404 |

Docs search/provider state is library-owned; repository code supplies the index, routes, and layouts, with no application-owned authentication or editing session.

### 10. HTTP client retry loop and uptime checks

Owners: `apps/api/src/lib/http-client.ts`, `apps/api/bin/uptime-check.ts`.

States: attempting, backoff, headers received/body reading, succeeded, failed. Invariant: each attempt has its own timeout including body consumption; independent uptime GETs run concurrently and aggregate failures only after all settle.

| From | Event | To / effect |
| --- | --- | --- |
| Attempting | HTTP success | Return response; caller consumes body |
| Attempting | Configured retryable status/network failure, budget remains | Backoff; decrement budget; fresh attempt |
| Attempting | Exhausted/permanent error | Reject |
| Attempting / backoff | Caller abort | Terminal cancellation; no further attempts |
| HTTP failure | Response discarded | Cancel its body before retry/failure |
| Body reading | Complete / stalled | Success / timeout failure |
| All endpoint checks settled | Any failure | Nonzero exit and diagnostics |

### 11. CI, deployment gate, collection reporting, and incidents

Owners: `.github/workflows/{deploy,scrape,uptime,browser-sources}.yml`, `.github/scripts/{wait-for-deployment.sh,report-collection.ts}`.

States: queued, checking, deploying, waiting-for-deploy, collecting, reporting, success/failure/cancelled/timed-out. Collection production runs share one workflow concurrency group; dry runs have separate groups and no database secrets. Dataset matrix jobs write distinct keys, with at most two category jobs active.

| From | Event / guard | To / effect |
| --- | --- | --- |
| Main push | Deploy starts | Install/check → deploy workers |
| Deployment queued | Another deployment active | Wait; do not cancel a multi-Worker deployment |
| Deployment ready | Non-main or stale SHA | Skip/fail before production writes |
| Production collection | Matching deployment pending/missing | Poll at most 30 times |
| Deployment gate | Matching SHA succeeds and still equals main | Admit publication |
| Deployment gate | Failure/cancellation/timeout or wrong branch | Block writes |
| Collection matrix | One category fails | Other categories continue |
| Reporting | Existing bot marker | Update comment |
| Reporting | Findings without marker | Create comment |
| Uptime | Endpoint failure | Export diagnostics; create incident issue |

Monitoring intentionally tests availability, not freshness: `/health` may return `ok` with stale datasets. Uptime currently creates an issue per failed run and has no deduplicated incident/recovery lifecycle. Collection comments are upserted by bot marker; the workflow concurrency groups serialize normal reports for a target. These are documented behaviors, not additional confirmed regressions in this audit.

### 12. Immutable generated-content caches

`apps/api/src/lib/openapi-page.ts` lazily caches a generated HTML page in one module-level string: unbuilt → built on first request → reused for the isolate's lifetime. Its inputs are bundled constants, so request interleavings cannot mix versions. Docs source/search generation and route metadata similarly derive from bundled content rather than application-managed sessions.

## Concurrency boundaries and non-findings

- Normal collection workers never mutate D1 until collection and browser cleanup finish; category publication catches failures and continues its peers. Browser `close()` is called after collection, so calling fetch after close is not a demonstrated application path. No speculative lifecycle guard was added there.
- Session promise rejection caching is intentional within a pass; the recovery pass creates new transports. Existing source-outage tests cover payment failures, failed-source isolation, and preserving extraction blockers during retry outages.
- API reads are independent requests. Successful dataset GETs cache for five minutes; health and MCP do not. Latest/history/index HTTP requests can therefore observe different committed generations within that caching window. The chart now follows actual available snapshot keys, but does not claim snapshot isolation across separate HTTP requests.
- Browser latest-data caches live for the page session; category error retry clears them. They do not poll for new collections. No automatic-live-refresh guarantee was added. History retries are explicit to preserve React promise identity.
- Framework-owned docs search/sidebar/theme state and native popover behavior were identified but not reimplemented. The repository has no account, checkout, subscription, write API, or persisted MCP-session machine.
- SQLite/D1 batch atomicity is essential to the publication protocol. See [Cloudflare D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) and the real local-D1 rollback regression. GitHub queue order need not match commit order, hence the separate current-main check; see [GitHub concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency).

## Verification log

- Final `bun run check`: **623 passed, 12 skipped, 0 failed**; Oxlint, Oxfmt, and all three workspace type checks pass. Default skips are opt-in local D1 tests and their hooks; the persistence suite was run separately below.
- Final `bun run build`: API, web, and docs all pass. Tooling emits a CSS sourcemap warning and a suggestion to advance the docs Worker compatibility date.
- Browser check (Playwright + local web server + intercepted fixture API): monthly snapshot 503 → visible **Retry history** → successful chart at **10 Nov 2026, 6.00%**. The `ANZ` search filter survives; no browser page errors occur. This is an executed smoke check; the persistent regressions are the test files above.
- Baseline: `bun test` with loopback access: **605 passed, 11 skipped, 0 failed**. Skips are opt-in Wrangler D1 integration tests. Sandbox-only run could not bind local test servers; that is an environment restriction, not an application bug.
- SM-01 red: `bun test apps/api/test/publication-concurrency.test.ts`: second publisher resolved successfully when the regression required a conflict.
- SM-01 green: six transactional SQLite regressions; opt-in D1 suite **6 passed**, including large guarded rollback/retry through Wrangler.
- SM-02 red → green: wrong latest snapshot day, silently missing monthly snapshot, failed retry, and month-end rollover reproduced before their respective fixes.
- SM-03 red → green: permanent HTTP retries, continued requests after abort, and unreleased response streams reproduced before their respective fixes.
- SM-04 red → green: stale successful deployment admitted publication; absent workflow concurrency/branch guards. Real shell and workflow regressions now pass.
- SM-05 red → green: ten requests and late cache overwrite; uncancelled sibling request after failure. Both public-boundary regressions now pass.

## Maintenance

When changing a transition, update its row, invariant, affected issue, and regression evidence here. Do not mark a hypothetical interleaving as confirmed without a real caller path and executable reproduction or an exact workflow trace. Local fixes are not deployed fixes; record that distinction in issue status.
