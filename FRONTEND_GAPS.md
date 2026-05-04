# ariaflow-dashboard Frontend Gaps

## Open (5)

### FE-31: FreshnessRouter routes dashboard-served paths to the wrong origin

`apiPath()` in `backend.ts:223` always composes against the selected
backend (`http://127.0.0.1:8000`), so every fetch the FreshnessRouter
makes via its `fetchJson` adapter (`app.ts:641`) targets the backend —
including `/api/web/log`, which only exists on the dashboard server
(port 8001). Confirmed live 2026-05-04:

- `GET http://127.0.0.1:8000/api/web/log` → 404 (backend has no such route)
- `GET http://127.0.0.1:8001/api/web/log` → 200 (dashboard server)

The Log tab's Action history / Web Server Log panels still render
because `loadWebLog()` is invoked through a different code path that
silently swallows the failure; the freshness contract is just wrong.

Same flaw will block plan #5 (consuming the dashboard's new
`/api/_meta` from the router): once dashboard endpoints are
declared in a meta document, the router needs to know each
endpoint is dashboard-served (same-origin) vs backend-served
(via apiPath).

**Fix sketch** (~+120 / −30 across 5 files):
1. `EndpointMeta` gains a `host: 'backend' | 'dashboard'` field
   (default `'backend'` for back-compat).
2. `RouterAdapters` exposes `originFor(host) => string` (or a
   host-aware `fetchJson(method, path, params, host)`); the router
   composes URLs from that.
3. `bootstrapFreshnessRouter` fetches both metas (backend + dashboard
   `/api/_meta`), tags each endpoint with its origin.
4. `LOCAL_METAS` shrinks to just `/api/aria2/option_tiers`
   (the only remaining synthetic backend mirror).
5. `freshness.test.ts` + `freshness-bootstrap.test.ts` updates;
   pre-existing TS2532 errors at `freshness.test.ts:359,373` get
   resolved while we're in there.

No backend dependency. Best approached with e2e regression coverage
in place first (see FE-32 once filed) so the router refactor doesn't
ship blind.

### FE-27: Snapshot test asserting unread `/api/status` payload keys are gone (paired with BG-35)

After BG-35 ships, add a frontend snapshot regression test asserting
that `dispatch_paused` (top-level) and `filtered` no longer appear in
the `/api/status` response shape consumed by this dashboard. Mirrors
the BG-33 negative-snapshot pattern (`state.paused`, `summary.stopped`,
`status:"stopped"`) on the FE side so any future drift is caught
before it lands.

Blocked by: BG-35.

### FE-24: Per-endpoint freshness routing + Dev-tab map (paired with BG-31)

Replace today's "every SSE tick refetches everything" with a
`FreshnessRouter` that consumes the backend's per-endpoint `meta.freshness`
and routes to the right strategy (SSE subscribe / setInterval / on-mount /
SWR / no-op). Visibility (`document.visibilitychange` + host postMessage)
modulates cadence. Dev tab gets a "Freshness map" panel showing every
endpoint, its declared class, last fetch, next scheduled fetch, and any
inline-vs-index drift warnings. `npm run freshness:snapshot` writes a
build-time markdown snapshot from `/api/_meta` for audit/PR review.

Blocked by: BG-31 (backend ships `meta.freshness` + `/api/_meta` index).

Design rationale and seven-class taxonomy in `docs/FRESHNESS_AXIS.md`.
Work split in `docs/PLAN.md`.

### FE-18: No schema/test oracle for `/api/events` (deferred)

SSE stream at `/api/events` is outside the contract layer. Add an
event-stream test strategy only if SSE payload drift causes a regression.

### FE-22: Fallback to `/api/peers` when local mDNS unavailable

When the dashboard runs in environments without mDNS (WSL NAT, containers,
VMs), `discoverBackends()` gets no results from local browse. The backend's
`/api/peers` endpoint can provide peer info as a fallback.

Blocked by: BG-15 (backend discovery uses stale service type, so
`/api/peers` returns nothing).

Once BG-15 is fixed, the frontend should:
1. Try local mDNS browse first (current behavior).
2. If local browse returns nothing, fall back to `GET /api/peers` on the
   current backend and merge results into `mergeDiscoveredBackends()`.

---

_End of open gaps._

## Resolved

| ID | Summary | Date |
|----|---------|------|
| FE-30 | Archive tab badge fallback `item.status \|\| 'cancelled'` replaced with `'removed'` (canonical post-BG-30 terminal status) in `static/_fragments/tab_archive.html`. `cancelled` was removed from `ITEM_STATUSES` by BG-30 as unreachable, so the literal was dead | 2026-05-04 |
| FE-29 | Dev tab surfaces OpenAPI/runtime version drift: new `loadSpecVersion()` fetches `/api/openapi.yaml` on dev-tab nav, parses `info.version`, exposes `specVersion` + `specVersionMismatch` getter; tab_dev.html renders Runtime/Spec chips and a `version drift` warn badge when they differ. Backend pairing dropped (BG-37 not accepted upstream); the chip is purely an observability surface so any future stamp drift is visible at a glance | 2026-05-04 |
| FE-28 | Migrated off 5 backend aliases: `POST /api/downloads/add` → `POST /api/downloads`; `POST /api/declaration` → `PUT /api/declaration`; `GET /api/aria2/get_global_option` → `GET /api/aria2/global_option`; `GET /api/aria2/get_option` → `GET /api/aria2/option`. (`/api/declaration/preferences` was already `PATCH`.) Updates: `app.ts` 4 sites, `actions.ts` urlAria2GetOption builder, `actions.test.ts` expected URL, `tests/conftest.py` mock backend (canonical paths + new `do_PUT` handler), `tests/test_api_params.py` (`_put` helper, `TestPostDeclaration` uses PUT, aria2 GET tests use new paths), `docs/ucc-declarations.yaml` (4 entries renamed). Pairs with backend BG-36 — wait one full release cycle before backend deletes the alias handlers (old browser tabs still hit old paths) | 2026-05-01 |
| FE-26 | LOADERS manifest replaced by `TAB_SUBS` declarations driven by `FreshnessRouter`. All six tabs (dashboard, bandwidth, lifecycle, options, log, archive) subscribe through the router; per-tab `k` multipliers gone. Two prereqs landed first: `onUpdate` notify hook (commit 6777814) and `subscribe(params)` for query-stringed endpoints (`?limit=` on archive/sessions). Synthetic meta registered for `/api/web/log` and `/api/aria2/option_tiers` (not in `/api/_meta`). Loader functions kept as `_apply<X>(data)` helpers + thin fetch wrappers for explicit-call paths (e.g. `loadLifecycle()` after a lifecycle action). `_startTabPollers`/`_stopTabPollers` retained as harness; LOADERS now empty for every tab — follow-up commit can remove them outright | 2026-05-01 |
| FE-25 | Dropped legacy alias fallbacks (paired with BG-33): `state.dispatch_paused ?? state.paused` collapsed to `dispatch_paused` only, `s.removed ?? s.stopped` to `removed`, `'stopped'` removed from `itemCanRetry` allow-list and `formatters.badgeClass` bad-list. Earlier this session: `lifecycle.ts` `labelFromLegacy` + axes-absent fallbacks deleted | 2026-04-30 |
| FE-23 | Aria2-aligned item-status vocabulary (BG-30 cutover): dropped phantom statuses (recovered/failed/downloading/done/cancelled), switched filter buckets to canonical names (active/complete/removed), wired waiting counter, switched to `state.dispatch_paused` reads | 2026-04-30 |
| FE-21 | Bonjour service type fixed (`_ariaflow-server._tcp` / `_ariaflow-dashboard._tcp`) | 2026-04-09 |
| FE-20 | Archive button uses `archivable_count` from backend | 2026-04-09 |
| FE-19 | BGS SHA drift — warning-only, accepted | 2026-04-07 |
| FE-17 | No CI for BGS — won't-fix (BGSPrivate is private) | 2026-04-07 |
| FE-16 | Health from `/api/status.health`, no separate timer | 2026-04-06 |
| FE-15 | Log tab uses SSE `action_logged` events | 2026-04-06 |

Details for all resolved entries are preserved in git history.
