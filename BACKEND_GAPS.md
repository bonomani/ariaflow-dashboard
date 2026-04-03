# Backend Gaps

Missing features in `ariaflow/src/aria_queue/webapp.py`.

---

## GAP-1: SSE pushes rev-only

`_invalidate_status_cache()` publishes `{rev, server_version}`.
Frontend must do `GET /api/status` after each event.

**Fix:** Push full `_status_payload(force=True)` as SSE data.

**Effort:** Small | **Impact:** High

## GAP-2: No bulk item operations

No endpoint for multi-item actions.

**Needed:** `POST /api/items/bulk` with `{action, ids}`.

**Effort:** Medium | **Impact:** Medium

## GAP-3: No pagination on `/api/status`

Returns entire queue. No `offset`/`limit`.

**Effort:** Medium | **Impact:** Medium

## GAP-4: No server-side search

No `?q=keyword` on `/api/status`.

**Effort:** Small | **Impact:** Small

## GAP-5: No PATCH for preferences

Frontend does GET→merge→POST. Race-prone.

**Needed:** `PATCH /api/declaration/preferences`.

**Effort:** Small | **Impact:** Medium

## GAP-6: No per-item error in batch add

One bad item fails entire batch.

**Effort:** Small | **Impact:** Small

## GAP-7: No retry policies

No auto-retry, no `max_retries` preference, no `retry_count` on items.

**Effort:** Medium | **Impact:** Medium

## GAP-8: No post-download hooks

`post_action_rule` field exists but nothing executes.

**Effort:** Large | **Impact:** Medium

## GAP-9: No webhooks

No server-side event notifications.

**Effort:** Medium | **Impact:** Medium

## GAP-10: No speed history

Speed data is frontend-only, in-memory.

**Needed:** `GET /api/stats/speed?range=1h`.

**Effort:** Medium | **Impact:** Small

## GAP-11: No authentication

All endpoints open. `Access-Control-Allow-Origin: *`.

**Effort:** Medium | **Impact:** Medium

## GAP-12: No scheduling / time windows

No time-based bandwidth caps.

**Effort:** Large | **Impact:** Medium

## GAP-13: No item labels / categories

No tags on items, no `?tag=` filter.

**Effort:** Medium | **Impact:** Small

---

## Priority

### Must fix

| # | Gap | Effort |
|---|-----|--------|
| 1 | SSE full payload | Small |
| 5 | PATCH preferences | Small |

### Should fix

| # | Gap | Effort |
|---|-----|--------|
| 2 | Bulk operations | Medium |
| 3 | Pagination | Medium |
| 6 | Batch add errors | Small |
| 7 | Retry policies | Medium |

### Nice to have

| # | Gap | Effort |
|---|-----|--------|
| 4 | Search | Small |
| 8 | Post-download hooks | Large |
| 9 | Webhooks | Medium |
| 10 | Speed history | Medium |
| 11 | Authentication | Medium |
| 12 | Scheduling | Large |
| 13 | Labels | Medium |

---

## Backend Endpoint Inventory

**17 GET:** `/api`, `/api/health`, `/api/status`, `/api/events`, `/api/scheduler`,
`/api/bandwidth`, `/api/declaration`, `/api/options`, `/api/lifecycle`, `/api/log`,
`/api/archive`, `/api/sessions`, `/api/session/stats`, `/api/item/{id}/files`,
`/api/docs`, `/api/openapi.yaml`, `/api/tests`

**14 POST:** `/api/add`, `/api/run`, `/api/pause`, `/api/resume`, `/api/session`,
`/api/declaration`, `/api/cleanup`, `/api/bandwidth/probe`, `/api/preflight`,
`/api/ucc`, `/api/lifecycle/action`, `/api/aria2/options`,
`/api/item/{id}/{action}` (pause/resume/remove/retry), `/api/item/{id}/files`

**Missing:** No PATCH/PUT/DELETE. SSE is notification-only.
