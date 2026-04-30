# ariaflow-dashboard Frontend Gaps

## Open (4)

### FE-26: Replace LOADERS manifest with FreshnessRouter subscriptions (paired with BG-34)

Today every tab's data refresh runs through `app.ts LOADERS` — a static
manifest of `{fn, k}` per tab that fires each loader once on entry and
then on `setInterval(k * refreshInterval)`. With BG-31's freshness
contract shipped, the router knows each endpoint's class + ttl + topics;
the manifest is now a parallel source of truth for cadence.

Replace it with subscriber-driven router calls per page. Each tab
component becomes a subscriber; the router decides when to fetch based
on class + visibility + ref-count. Eliminates the manifest, the per-tab
`k` multipliers, `_startTabPollers`, and `_stopTabPollers`.

Two prerequisites:

1. **Router needs a fetch-result notify hook** (`onUpdate(endpoint, cb)`
   or per-subscribe callback). Today the router caches `lastValue` but
   doesn't notify; without that, ports can't drive Alpine state on each
   refresh. Frontend-only design.
2. **BG-34** — five tab endpoints are unregistered in `/api/_meta`
   (`/api/torrents`, `/api/peers`, `/api/downloads/archive`,
   `/api/sessions`, `/api/declaration`). Without registration the router
   can't drive them, so the manifest can't go away cleanly.

Blocked by: BG-34 (partial — frontend can ship the router callback API
and port already-registered tabs first).

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
| FE-25 | Dropped legacy alias fallbacks (paired with BG-33): `state.dispatch_paused ?? state.paused` collapsed to `dispatch_paused` only, `s.removed ?? s.stopped` to `removed`, `'stopped'` removed from `itemCanRetry` allow-list and `formatters.badgeClass` bad-list. Earlier this session: `lifecycle.ts` `labelFromLegacy` + axes-absent fallbacks deleted | 2026-04-30 |
| FE-23 | Aria2-aligned item-status vocabulary (BG-30 cutover): dropped phantom statuses (recovered/failed/downloading/done/cancelled), switched filter buckets to canonical names (active/complete/removed), wired waiting counter, switched to `state.dispatch_paused` reads | 2026-04-30 |
| FE-21 | Bonjour service type fixed (`_ariaflow-server._tcp` / `_ariaflow-dashboard._tcp`) | 2026-04-09 |
| FE-20 | Archive button uses `archivable_count` from backend | 2026-04-09 |
| FE-19 | BGS SHA drift — warning-only, accepted | 2026-04-07 |
| FE-17 | No CI for BGS — won't-fix (BGSPrivate is private) | 2026-04-07 |
| FE-16 | Health from `/api/status.health`, no separate timer | 2026-04-06 |
| FE-15 | Log tab uses SSE `action_logged` events | 2026-04-06 |

Details for all resolved entries are preserved in git history.
