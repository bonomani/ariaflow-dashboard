# ariaflow-dashboard Plan

## Done (history in git)

- Contract-governance migration (BGS, UCC, schemas, alignment tests).
- Header / tabs separation refactor (fragment includes, LOADERS manifest, CSS tokens).
- Cross-platform installation (PyPI, optional `[local]` dep, per-platform aria2 docs).
- Rename to ariaflow-dashboard (module, package, CLI, UI, GitHub repo, Homebrew formula).

## Open gaps

| Gap | Status | Notes |
|---|---|---|
| FE-18 | Deferred | SSE smoke test — add when/if payload drift causes a regression |
| FE-21 | Resolved | Bonjour service type fixed |
| FE-22 | Blocked by BG-15 | Fallback to `/api/peers` when local mDNS unavailable (WSL, containers) |

Resolved gaps (BG-12–14, FE-15–20) — see git history and `FRONTEND_GAPS.md`.

## Done (cont.)

- Governance alignment: Makefile (`check-drift`, `verify`, `ci` targets),
  `scripts/check_bgs_drift.py`, `.github/workflows/test.yml` (CI gate),
  BGS files moved to `docs/governance/`.

## Deferred

- **Mock fixtures (DEFAULT_STATUS etc.) → YAML.** Not worth the churn.
- **Generated `BGS.md`.** Too small to justify generation.
- **BGS Grade-2 style profiles/policies.** No clear value for this repo.

## Active: Download state machine consistency (BG-30)

Goal: align item-status vocabulary across **aria2 → backend → frontend**
on aria2's six canonical statuses, plus two backend-only pre-aria2
states. Today three layers use three vocabularies; phantom states exist
in code with no producer; `paused` is overloaded across scheduler vs
item; `waiting` is dropped on the floor.

**Canonical states (target):**
- aria2-native: `active`, `waiting`, `paused`, `error`, `complete`, `removed`
- backend-only (pre-aria2): `discovering`, `queued`

Diagram: `discovering → queued → (active ⇄ waiting ⇄ paused) → {complete, error, removed}`

### Backend (paired-repo, file as BG-30)

1. **Persist `waiting`.** When `pollActiveItems` sees aria2's `live_status="waiting"`, transition `item.status` to `waiting` (today only cached in `live_status`). Add `waiting` to `summarizeQueue` buckets.
2. **Rename `stopped` → `removed`.** Match aria2's vocabulary. Ship dual-keyed for one release (`status: "removed"`, alias counter `summary.stopped` mirrors `summary.removed`), then drop alias.
3. **Delete `cancelled`.** Unreachable in `ITEM_STATUSES` — no producer. Remove from policy + types.
4. **Disambiguate scheduler pause.** Rename `state.paused` → `state.dispatch_paused` (item-level `paused` keeps its name). Endpoints stay `/api/scheduler/{pause,resume}` but the JSON field renames. Dual-key for one release.
5. **`active_gid` derived, not stored.** Compute from `aria2.tellActive()` on `/api/status` read instead of stamping in `tick`/`poll`. Removes stale-after-crash class.
6. **Document the state diagram** in `ariaflow-server/docs/STATE_MACHINE.md` (8 states, transitions, who can trigger each).

### Frontend (this repo, after backend ships)

1. **Drop phantom statuses.** Remove `recovered`, `failed`, `downloading` from `filters.ts normalizeStatus`. Use `paused`/`error`/`active` directly.
2. **Drop bucket aliases.** `done` → `complete`, `downloading` → `active` in filter labels. Update tab counts and badges.
3. **Wire `waiting` bucket.** Remove the always-zero counter once backend emits it.
4. **Rename `state.paused` → `state.dispatch_paused`** in `app.ts` reads. Update `schedulerOverviewLabel`.
5. **Update `formatters.ts` badge map.** Add `removed` (yellow), drop `stopped` once backend cuts over.
6. **Update tests** in `filters.test.ts` / `lifecycle.test.ts` for new vocabulary.

### Sequence
- BG-30 filed (frontend) → backend lands #1–6 dual-keyed → frontend lands #1–6 → backend drops aliases.

## Active: Freshness axis (BG-31) + visibility-aware refresh

Goal: replace the current "SSE tick → refetch everything" pattern with
per-endpoint freshness classes declared by the backend, modulated by
tab/host visibility. Design captured in `docs/FRESHNESS_AXIS.md`
(seven classes, visibility table, prior-art comparison, upstream-push
venues).

### Backend (paired-repo, file as BG-31)

1. Add a `meta` block to every JSON endpoint: `{ freshness, ttl_s?, revalidate_on? }`.
2. Default unknown endpoints to `warm` + `ttl_s: 30` so the rollout is incremental.
3. Document the vocabulary in `ariaflow-server/docs/FRESHNESS.md` (server-side mirror of the frontend design note).
4. Validate at test time: `bootstrap` endpoints must return identical bodies across calls; `live` endpoints must declare a transport.

### Frontend (this repo, after backend ships meta)

1. **`FreshnessRouter` module.** Subscriber-driven, ref-counted. Three conditions must hold for the router to do I/O on an endpoint: (a) class permits work now, (b) host visibility true, (c) ≥1 visible subscriber. API: `subscribe(endpoint, subscriberId, {visible})`, `setSubscriberVisible(subscriberId, bool)`, `unsubscribe(endpoint, subscriberId)`, plus host-level `setVisible(bool)`. Maps class → strategy (SSE subscribe / setInterval / on-mount fetch / SWR cache / no-op).
2. **Replace eager SSE-tick refetch.** Today every `state_changed` triggers a full `/api/status` GET; route per-class instead.
3. **Visibility wiring.** Listen to `document.visibilitychange` + `postMessage({type:'visibility'})` from host shell; first event wins, both call `setVisible`.
4. **`revalidate_on` interceptor.** After any `_fetch` POST returns 2xx, invalidate endpoints whose `meta.revalidate_on` matches `<METHOD> <path>`.
5. **Tests.** Pure unit tests on the router (input: class + visibility + tick → output: action). No timer-based integration tests in this repo.

### Discoverability — `/api/_meta` index + Dev-tab panel

Rule: one declaration site (the endpoint's own `meta`), two read paths
(runtime router + dev panel). No hand-maintained parallel registry.

**Backend (BG-31, additional items):**

7. **Single registry on the server.** Wrap responses through one helper
   (e.g. `withMeta(endpoint, body)`) that pulls `freshness`/`ttl_s`/
   `revalidate_on` from a per-endpoint registration so the same source
   feeds both the per-call `meta` block and the index.
8. **`GET /api/_meta`** — returns `{ endpoints: [{ method, path, freshness, ttl_s, revalidate_on, transport? }] }` derived from that registry. `meta.freshness: "bootstrap"` itself.
9. **Runtime validator (test-only).** A test asserts that every route handler is registered (no implicit endpoints) and that `bootstrap` endpoints return byte-identical bodies across calls.

**Frontend (this repo, paired):**

6. **Consume `/api/_meta` at boot.** Cache the index (it's `bootstrap`); `FreshnessRouter` reads classes from there instead of from each response's inline meta. Inline `meta` stays as a per-response confirmation but the router doesn't depend on it.
7. **Dev-tab "Freshness map" panel.** Live table: endpoint · declared class · host visibility · subscribers (visible / hidden) · last fetch · next scheduled fetch · drift warning when inline `meta` disagrees with `/api/_meta`.
8. **No separate doc to maintain.** A static snapshot for review (PR descriptions, audit) is generated at build time from `/api/_meta`, never hand-edited. Add `npm run freshness:snapshot` that writes `docs/FRESHNESS_SNAPSHOT.md` from a running backend.

### BG-32: Per-topic SSE subscriptions (subscriber concept, end-to-end)

Concept #1 (class) shipped in BG-31. Concept #2 (visibility) is
frontend-only. Concept #3 (subscribers) is mostly frontend — but to
get the savings on the wire, the backend's SSE stream needs to filter
events per client.

**Backend (BG-32):**

1. Accept a topic filter at SSE connect time:
   - Query: `GET /api/events?topics=items,scheduler,lifecycle`
   - And/or a JSON-RPC-style command on the open stream: `{"op":"subscribe","topics":[...]}` and `{"op":"unsubscribe","topics":[...]}` so the frontend can adjust topics without reconnecting.
2. Filter `bus.subscribe(writeEvent)` so only events whose topic is in the client's set are written. Map existing event names to topics: `state_changed → items+scheduler`, `action_logged → log`, `lifecycle_changed → lifecycle` (if/when emitted), etc.
3. Document the topic vocabulary in `packages/api/src/sse.md` or alongside `freshness.ts` so it's discoverable. Add a `meta.transport_topics` field (or extend `/api/_meta`) so clients know which topic to subscribe to per `live` endpoint.
4. Default behaviour (no `?topics` query) stays "all topics" for backwards compatibility.

**Frontend (paired update inside FE-24):**

- `FreshnessRouter` reads `meta.transport_topics` from `/api/_meta` for `live` endpoints.
- When subscriber visibility changes for a `live` endpoint, send `subscribe`/`unsubscribe` over the open stream (or reconnect with adjusted `?topics`). Reference-counted same as polled endpoints.

**Sequence:** Frontend ships FE-24 with full-firehose SSE first (works today) → backend lands BG-32 → frontend wires topic filtering as a follow-up commit.

### Push upstream (only after second consumer proves the taxonomy)

- Propose `x-freshness` as OpenAPI vendor extension.
- JSON:API meta extension proposal.
- HTTP `Freshness-Class:` response header alongside `Cache-Control`.
- Blog post / ADR comparing to TanStack Query / SWR / Apollo policy locations.

Sequence: file BG-31 → backend lands `meta` on `/api/status`, `/api/lifecycle`, `/api/bandwidth` first → frontend ships `FreshnessRouter` consuming those three → expand backend coverage → consider upstream.

## Active: Remove legacy / fallback compatibility

The backend has shipped BG-25, BG-27, BG-30, BG-31, BG-32. The frontend
still carries fallback paths for "old backend" behaviour. Each one is a
dead branch that ages into bit-rot. Sweep them out in one focused PR.

### Fallback sites to remove

| # | Site | Today's fallback | Why it can go |
|---|------|------------------|---------------|
| 1 | `app.ts` `state.dispatch_paused ?? state.paused` (5 sites) | reads legacy field | BG-30 dual-keyed dispatch_paused; backend can drop the alias |
| 2 | `app.ts` summary `s.removed ?? s.stopped` | dual-key fallback | BG-30 same as above |
| 3 | `lifecycle.ts` `labelFromLegacy` (entire function) | maps legacy `reason` enum when axes absent | BG-27 axes are mandatory now; never absent |
| 4 | `lifecycle.ts` `lifecycleActionsFor` legacy-actions branch | falls back when `hasAxes(result)` is false | same as #3 |
| 5 | `freshness-bootstrap.ts` returns null on /api/_meta 404 | tolerates legacy backend | BG-31 shipped; /api/_meta is required |
| 6 | `app.ts` `_fetch.if (this._freshnessRouter)` invalidation guard | skips when router missing | router is always present after #5 |
| 7 | `app.ts` LOADERS manifest with hardcoded `k` multipliers | per-tab cadence in code | freshness contract supersedes — class+ttl drives cadence |
| 8 | `formatters.ts` `'stopped'` in bad-badge list | kept during BG-30 cutover | only `removed` should remain |
| 9 | `app.ts` `itemCanRetry(...).includes('stopped')` | dual-name allowance | only `removed` |
| 10 | SSE event-name → fallback "all topics" path | when backend doesn't filter | BG-32 shipped; topics are required |

### Constraint: paired with backend cleanup

Items 1, 2, 8, 9 require **backend to drop the alias** first. File as
**BG-33: Drop legacy aliases** (backend deletes `state.paused`,
`summary.stopped`, accepts only canonical names). Frontend cuts over in
the same PR week.

Items 3, 4 are frontend-only — `labelFromLegacy` is unreachable now
that BG-27 is mandatory. Just delete with the test cases that exercise
it.

Items 5, 6, 10 require a version bump declaration (e.g. `meta.api_version >= 2`)
or just the policy "minimum backend version is whatever shipped BG-31".
Pick the policy, document in `AGENTS.md`, then drop the guards.

Item 7 is the big one — replaces the LOADERS manifest with router
subscriptions per page. Already on FE-24 step 3 backlog. Stays there.

### Sequence

1. File **BG-33** for backend alias removal.
2. Frontend ships items 3, 4 (legacy lifecycle path) standalone.
3. Backend lands BG-33; frontend cuts over items 1, 2, 8, 9 same day.
4. Frontend declares minimum backend version, drops items 5, 6, 10.
5. Item 7 lands as part of FE-24 step 3 (router-driven LOADERS).

### Anti-goals

- **Do not break "I'm running an older backend"** without first declaring a minimum version policy. Silent breakage is worse than the dead code.
- **Do not delete tests just because the production path is gone.** If `labelFromLegacy` is unreachable, the test must come out too — leaving "tests for code that doesn't exist" is a different kind of rot.

## Active: TypeScript migration of frontend JS

Migrate `src/ariaflow_dashboard/static/*.js` (1853 LOC across `app.js`,
`formatters.js`, `sparkline.js`) to TypeScript. `alpine.min.js` stays
vendored. Python is out of scope.

Steps:

1. **Toolchain.** Add `package.json`, `tsconfig.json` (strict), devDeps
   (`typescript`, `esbuild`, `@types/alpinejs`). Add `static/dist/` and
   `node_modules/` to `.gitignore`.
2. **Source layout.** New `src/ariaflow_dashboard/static/ts/` for `.ts`
   sources. Bundle to `static/dist/app.js`. Update `index.html`.
3. **Build integration.** `npm run build` (esbuild) and `npm run dev`
   (watch). Wire `make build-frontend` into `make verify` / `make ci`.
   Ensure `pyproject.toml` ships `static/dist/` in package data.
4. **Migrate file-by-file** (smallest first): `sparkline.ts` →
   `formatters.ts` → split `app.js` into `types.ts` / `api.ts` /
   `state.ts` / `components/*.ts` / `main.ts`.
5. **Backend DTO types.** Hand-write interfaces matching JSON
   endpoints from `../ariaflow-server`. Log shape gaps in
   `FRONTEND_GAPS.md`.
6. **Strictness ramp.** Land migration with `strict: false`, then
   enable `noImplicitAny` → `strictNullChecks` → full `strict` in
   small follow-up PRs.
7. **Lint & format.** ESLint + `@typescript-eslint` + Prettier; hook
   into `make ci`.
8. **Tests.** Port any JS tests (or add a smoke test with `node:test`
   + `tsx`) for pure modules. Manual browser smoke per AGENTS policy.
9. **Cleanup.** Remove old `.js` sources once `.ts` ships and
   `index.html` points at `dist/`. Update `ARCHITECTURE.md`.
10. **CI.** `make ci` runs `npm ci && tsc --noEmit && npm run build`
    before push.

## To study — patterns from `claude-sub-proxy/ui` worth borrowing

Comparative review captured 2026-04-26 against `claude-sub-proxy` commit
`aeefa13`. Each item is **research-only** for now — no code change in
ariaflow-dashboard until/unless we decide to adopt. Listed roughly from
"highest leverage" to "cosmetic".

### Architecture & language

1. **TypeScript end-to-end with esbuild bundle.** Replace `app.js`,
   `formatters.js`, `sparkline.js` with `.ts` modules; bundle via
   esbuild (~5 ms cold, ~9 MB dev-dep). Strict typing
   (`noUncheckedIndexedAccess`, `strict`) catches the bug class we
   currently rely on humans to spot. Source maps inline → real stack
   traces in devtools. Coverage gate becomes meaningful.
2. **Mini reactive store + pure `render(parent, state)` functions.**
   Replace Alpine's Proxy-magic reactivity with an explicit
   `createStore<S>()` (~40 LOC) plus per-view render fns. Wins:
   testable in isolation under happy-dom, every state mutation is a
   breakpoint-able call site, no "I mutated a nested object and the
   view didn't refresh" surprises. Cost: write `store.subscribe(...)`
   and `replaceChildren(parent, …)` plumbing manually.
3. **Build-time constants injected via esbuild `define`.** Inject
   `__BACKEND__` (URL of the backend the UI talks to) and `__COMMIT__`
   (`git rev-parse --short HEAD`) into the bundle. Show the commit sha
   in the header (`v2 aeefa13`). Saved hours of "is the new bundle
   loaded" debugging during claude-sub-proxy's recent passes.

### Quality & testing

4. **Unit tests on the UI layer.** Use `node:test` + `tsx --test` on
   pure functions only (formatters, predicate matchers, store
   derivations). Claude-sub-proxy has 64 UI tests at
   ~5 LOC each; the formatters file feels like documentation by
   example. Zero framework dep (node:test is stdlib).
5. **Defensive runtime asserts.** Patterns like
   `if (inflight < 0) { log("BUG: …"); inflight = 0 }` and a
   process-level `uncaughtException` handler that logs + survives
   instead of dying. Loud-but-recover.

### Embedded-mode discipline

6. **`?embedded=1` flag + postMessage handshake (UbiX-style).** Detect
   embedded mode at boot; emit `{type:"ready", minSize, preferredSize,
   title}` to `window.parent`; listen for `visibility` / `theme` /
   `state` from the host. Standalone path is unchanged (every
   `parent.postMessage` is a no-op when `parent === window`). Makes
   ariaflow-dashboard droppable into any future shell aggregator
   without retrofit. ~80 LOC, see
   `claude-sub-proxy/ui/src/shell-handshake.ts`.
7. **CSS scoped under a single root class** (e.g. `.ariaflow-app`).
   Today everything in `style.css` is global; if/when same-document
   embedding lands, every selector is a collision risk. Even without
   embedding, this is hygiene that prevents future bugs at zero cost.
   One pass of CSS-nesting under one wrapper.
8. **Visibility-aware polling using BOTH `document.visibilitychange`
   AND postMessage `visibility`.** Whichever fires first wins; the
   other becomes a no-op until next change. Works standalone (tab
   switch / minimize) AND embedded (shell hides the iframe). Pattern
   in `ui/src/shell-handshake.ts`.

### Deploy flexibility

9. **Three deploy modes via `BACKEND_URL` build env + `CORS_ORIGIN`
   runtime env.** Single-host (default, same-origin), split-host (UI
   on a CDN, backend on a VPS), embedded (iframe behind reverse
   proxy). Same bundle, different envs. Today ariaflow assumes the
   Python server hosts both; this would let the UI deploy to
   Cloudflare Pages / Vercel.
10. **Three-process orchestration script.** `scripts/dev.sh` with
    `start / stop / restart / status / logs` subcommands; kill-by-port
    via `lsof -sTCP:LISTEN`; auto-build of native binaries; per-
    process log files. Cleaner than juggling terminals.

### UX / data presentation

11. **Search-box token syntax with include/exclude.** `messages` /
    `-otlp` / `!chatgpt` / `claude -opus` (AND-composed). ~30 LOC in
    a pure `matchesFilter()` predicate, testable. Ariaflow could apply
    it to whatever indexable list it has.
12. **Filter persistence with versioned localStorage key.**
    `csp_admin_flags_v1`-style: explicit schema, per-field `??
    fallback`, parse-failure → return defaults. New fields don't
    crash old localStorage; schema bumps to `_v2` cleanly.
13. **Time formatting context-aware.** `fmtTimeLocal(ts)` shows
    `HH:MM:SS` for today, `MMM DD · HH:MM:SS` for older. Prevents
    confusion when the events ring spans days.
14. **Paused state indicator.** Visual amber pill on the status line
    when polling is off (auto-refresh unchecked). Avoids the "why
    isn't it updating" silence.
15. **Build-artifact identifier in the header.** Show the commit sha
    (or build timestamp) next to the version: `v2 aeefa13`. Removes
    the "am I seeing a stale bundle?" question.

### State / persistence

16. **Server-side single source of truth for aggregates.** Anything
    that's a sum, count, or accumulated total lives on the server,
    not in client localStorage. Clients are pure views, multi-tab
    safe by construction. (Claude-sub-proxy did this in G2 — Phase
    G of the project plan).
17. **Event ring snapshot persistence with monotonic ID continuity.**
    On graceful shutdown, write `{nextId, events}` to disk as JSON;
    restore at boot. The `nextId` field matters: admin clients use
    `since=N` cursors that would alias old + new events without it.
18. **`PRIVACY=1` env: explicit data-sensitivity mode.** Redact
    request previews, response captures, and log lines via
    heuristic regexes (Bearer / sk- / JWT-shaped). Optional, opt-in.
    Useful pattern even if ariaflow's domain is less sensitive — the
    *discipline* of having a named, env-flagged degraded mode is
    portable.

### Documentation discipline

19. **Living `DEEP_ANALYSIS.md` with dated passes.** Multi-pass code
    audits (HIGH / MED / LOW classification, items fixed vs items
    explicitly deferred with rationale). Forces honest pruning and
    documents *why* something wasn't fixed.
20. **Stack-comparison decision doc** (`docs/stack-comparison.md`).
    Articulates the maturity ladder L0/L1/L2/L3 (Alpine|Vanilla JS →
    TS modulaire → Preact → React+shadcn). Even keeping ariaflow at
    L0 (current), having the doc clarifies *why* and what L1 would
    look like.

---

**How to use this list.** When ariaflow-dashboard hits a real pain
point — bug that types would have caught, a need to embed elsewhere,
a regression that tests would have prevented — pick the relevant item
and graduate it from "to study" to a real plan entry. Don't port them
en bloc; port reactively, when the cost stops being theoretical.
