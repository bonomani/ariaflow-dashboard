# Backend Gaps — Missing from ariaflow backend

Features that require code changes in `ariaflow/src/aria_queue/webapp.py`
or core modules. Based on a fresh scan of both codebases.

**Backend scanned:** `/home/bc/repos/github/bonomani/ariaflow/src/aria_queue/webapp.py`
**Frontend scanned:** `/home/bc/repos/github/bonomani/ariaflow-web/src/ariaflow_web/static/app.js`

---

## GAP-1: No `POST /api/item/{id}/priority` endpoint — BROKEN

The frontend `moveToTop()` calls this endpoint. The backend `_post_item_action`
only handles `pause|resume|remove|retry`. Returns 400 "unknown item action: priority".

**Fix:** Add `priority` case to `_post_item_action`. Backend already has
`_aria2_apply_priority()` and `_aria2_position_for_priority()` in `queue_ops.py`.

**Effort:** Small | **Impact:** Critical (button is broken)

---

## GAP-2: SSE pushes `{rev, server_version}` only

`_invalidate_status_cache()` publishes `_sse_publish("state_changed", {rev, server_version})`.
The frontend receives this and must do a full `GET /api/status` round-trip.

**Fix:** Push `_status_payload(force=True)` as the SSE event data.

**Effort:** Small | **Impact:** High (eliminates polling entirely)

---

## GAP-3: No bulk item operations

No endpoint to act on multiple items. Frontend does N individual calls.

**What's needed:**
```
POST /api/items/bulk
{"action": "pause|resume|retry|remove", "ids": ["id1", "id2"]}
```
Response: `{"ok": true, "results": [{id, ok, error?}, ...]}`

**Effort:** Medium | **Impact:** Medium

---

## GAP-4: No pagination on `/api/status` items

Backend returns entire queue. Frontend downloads all items every poll.

**What's needed:** `?offset=0&limit=50` on `/api/status`.
Response adds `total_count`, `offset`, `limit`.

**Effort:** Medium | **Impact:** Medium (matters above ~100 items)

---

## GAP-5: No server-side search

No `?q=keyword` on `/api/status`. Frontend searches client-side.

**What's needed:** Match against item URL, output, GID.

**Effort:** Small | **Impact:** Small

---

## GAP-6: No PATCH for preferences

Frontend does GET → merge → POST for every preference change.
Race-prone with multiple tabs.

**What's needed:**
```
PATCH /api/declaration/preferences
{"bandwidth_free_percent": 25, "max_simultaneous_downloads": 3}
```
Also needs `do_PATCH` method and `PATCH` in `Access-Control-Allow-Methods`.

**Effort:** Small | **Impact:** Medium

---

## GAP-7: No per-item error in batch add

`_parse_add_items` validates all items upfront — one bad item fails the batch.

**What's needed:** Per-item results:
```json
{"ok": true, "results": [
  {"url": "...", "status": "queued"},
  {"url": "bad", "status": "error", "message": "..."}
]}
```

**Effort:** Small | **Impact:** Small

---

## GAP-8: No retry policy

No auto-retry on transient failures. Frontend retry button re-queues manually.

**What's needed:**
- Declaration preferences: `max_retries` (default 3), `retry_backoff_seconds` (default 30)
- Item field: `retry_count`
- Scheduler auto-retries with backoff

**Effort:** Medium | **Impact:** Medium

---

## GAP-9: No post-download hooks

`post_action_rule` field exists on items and declarations but nothing executes.

**What's needed:** Definable hook types: move file, run command, extract, notify.
Scheduler calls hook after item completion.

**Effort:** Large | **Impact:** Medium

---

## GAP-10: No webhooks

Browser notifications only work when tab is open.

**What's needed:**
```
GET/POST/DELETE /api/webhooks
```
Backend fires HTTP POST on events (done, error, session end).

**Effort:** Medium | **Impact:** Medium

---

## GAP-11: No speed history

Speed data is frontend-only, in-memory, lost on reload.

**What's needed:**
```
GET /api/stats/speed?range=1h
→ {samples: [{t: "ISO8601", speed: 12345}, ...]}
```

**Effort:** Medium | **Impact:** Small

---

## GAP-12: No authentication

All endpoints open. `Access-Control-Allow-Origin: *`.
`do_OPTIONS` declares `GET, POST, OPTIONS` only.

**What's needed:** API key header, CORS restrictions, optional roles.

**Effort:** Medium | **Impact:** Medium

---

## GAP-13: No scheduling / time windows

No time-based bandwidth caps or download scheduling.

**What's needed:** Declaration rules with time windows affecting bandwidth cap.

**Effort:** Large | **Impact:** Medium

---

## GAP-14: No item labels / categories

No tagging or grouping of downloads.

**What's needed:** `tags` field on items, `?tag=` filter on `/api/status`.

**Effort:** Medium | **Impact:** Small

---

## Priority

### Must fix

| # | Gap | Effort | Why |
|---|-----|--------|-----|
| 1 | Priority endpoint | Small | Move-to-top is broken |
| 2 | SSE full payload | Small | Eliminates polling |
| 6 | PATCH preferences | Small | Removes race condition |

### Should fix

| # | Gap | Effort | Why |
|---|-----|--------|-----|
| 3 | Bulk operations | Medium | Large queue usability |
| 4 | Pagination | Medium | Large queue performance |
| 7 | Batch add errors | Small | Better feedback |
| 8 | Retry policies | Medium | Reduces manual work |

### Nice to have

| # | Gap | Effort | Why |
|---|-----|--------|-----|
| 5 | Server-side search | Small | Convenience |
| 9 | Post-download hooks | Large | Automation |
| 10 | Webhooks | Medium | Server notifications |
| 11 | Speed history | Medium | Persistent sparklines |
| 12 | Authentication | Medium | Security |
| 13 | Scheduling | Large | Power feature |
| 14 | Labels/categories | Medium | Organization |

---

## Backend Endpoint Inventory (for reference)

**16 GET endpoints:**
`/api`, `/api/status`, `/api/events`, `/api/scheduler`, `/api/bandwidth`,
`/api/declaration`, `/api/options`, `/api/lifecycle`, `/api/log`, `/api/archive`,
`/api/sessions`, `/api/session/stats`, `/api/item/{id}/files`,
`/api/docs`, `/api/openapi.yaml`, `/api/tests`

**14 POST endpoints:**
`/api/add`, `/api/run`, `/api/pause`, `/api/resume`, `/api/session`,
`/api/declaration`, `/api/cleanup`, `/api/bandwidth/probe`, `/api/preflight`,
`/api/ucc`, `/api/lifecycle/action`, `/api/aria2/options`,
`/api/item/{id}/{action}` (pause/resume/remove/retry),
`/api/item/{id}/files`

**Missing:** No PATCH, PUT, or DELETE methods. No priority action on items.
