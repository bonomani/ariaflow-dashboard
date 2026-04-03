# Backend Gaps — Missing from ariaflow backend

Features that require backend code changes in `ariaflow/webapp.py` (or core modules).
These cannot be solved by frontend wiring alone.

---

## GAP-1: No `POST /api/item/{id}/priority` endpoint

**Status: BROKEN** — the frontend calls this endpoint but it doesn't exist.

**Frontend does:** `moveToTop()` sends `POST /api/item/{id}/priority` with `{priority: max+1}`.

**Backend has:** `_post_item_action` only maps `pause|resume|remove|retry`. No `priority` handler.

**Fix:** Add a `priority` case to `_post_item_action` or a dedicated route that updates the item's priority in the queue store.

**Effort:** Small | **Impact:** Critical (Move-to-top button is broken)

---

## GAP-2: SSE pushes rev only, not full payload

**Current:** `_sse_publish()` sends `{rev, server_version}` on `state_changed`. The frontend would still need a round-trip to `GET /api/status` after each event.

**What's needed:** Push full `_status_payload()` in the SSE event data so the frontend can assign it directly with zero extra fetch.

**Fix:** In `_invalidate_status_cache()`, compute payload and include it in the SSE `data` field.

**Effort:** Small | **Impact:** High (enables true zero-polling)

---

## GAP-3: No bulk item operations

No endpoint to act on multiple items at once.

**What's needed:**
```
POST /api/items/bulk
{
  "action": "pause|resume|retry|remove",
  "ids": ["id1", "id2"]           // explicit list
  // OR
  "filter": "error|done|all"      // all matching items
}
```

**Enables:** "Retry all errors", "Remove all done", "Pause all" buttons.

**Effort:** Medium | **Impact:** Medium (needed for large queues)

---

## GAP-4: No pagination on `/api/status` items

Backend returns the entire queue in every status call.

**What's needed:**
```
GET /api/status?offset=0&limit=50
→ {items: [...], total: 500, offset: 0, limit: 50}
```
Or a dedicated `GET /api/items?offset=0&limit=50&status=queued&sort=priority`.

**Effort:** Medium | **Impact:** Medium (matters above ~100 items)

---

## GAP-5: No server-side search

No way to search items by URL or filename via the API.

**What's needed:** `GET /api/status?q=keyword` matching against item URL, output, and GID.

**Effort:** Small | **Impact:** Small

---

## GAP-6: No PATCH for individual preferences

Frontend does a full read-modify-write cycle for every preference change:
`GET /api/declaration` → merge → `POST /api/declaration`.

**What's needed:**
```
PATCH /api/declaration/preferences
{"bandwidth_free_percent": 25, "max_simultaneous_downloads": 3}
```
Server merges into existing preferences.

**Removes:** `_queuePrefChange()`, `_flushPrefQueue()`, `_prefQueue`, `_prefTimer`, `_prefSaving` from the frontend.

**Effort:** Small | **Impact:** Medium (simplifies preference flow significantly)

---

## GAP-7: No per-item error reporting in batch add

`POST /api/add` with multiple items: if one URL is invalid, the whole request fails at parse time.

**What's needed:** Per-item result:
```json
{
  "ok": true,
  "results": [
    {"url": "...", "status": "queued", "id": "..."},
    {"url": "bad", "status": "error", "message": "invalid URL"}
  ]
}
```

**Effort:** Small | **Impact:** Small

---

## GAP-8: No retry policy configuration

No max retries, backoff, or auto-retry on transient failures.

**What's needed:**
- Declaration preferences: `max_retries` (default 0), `retry_backoff_seconds` (default 30).
- Item fields: `{retry_count: 2, max_retries: 3}`.
- Scheduler auto-retries failed items up to max, with backoff.

**Effort:** Medium | **Impact:** Medium

---

## GAP-9: No post-download hooks

`post_action_rule` exists as a field in declarations and items, but no actions are actually defined or executed.

**What's needed:**
- Definable rules: move file to directory, run shell command, extract archive, notify webhook.
- Declaration config:
  ```json
  {"post_action_rules": [
    {"name": "move_completed", "action": "move", "target": "/downloads/complete"},
    {"name": "notify", "action": "webhook", "url": "https://..."}
  ]}
  ```
- Scheduler executes matching rule after item completes.

**Effort:** Large | **Impact:** Medium (automation)

---

## GAP-10: No webhook/notification support

Notifications only work when the browser tab is open (frontend `Notification` API).

**What's needed:**
```
GET    /api/webhooks              → list configured webhooks
POST   /api/webhooks              → {url, events: ["done", "error"]}
DELETE /api/webhooks/{id}         → remove webhook
```
Backend fires HTTP POST to webhook URL on matching events.

**Effort:** Medium | **Impact:** Medium

---

## GAP-11: No transfer speed history

Speed sparklines are frontend-only, stored in JS memory. Lost on page reload.

**What's needed:**
```
GET /api/stats/speed?range=1h
→ {samples: [{t: "ISO8601", speed: 12345}, ...]}
```
Backend records speed samples periodically (e.g. every poll cycle).

**Effort:** Medium | **Impact:** Small

---

## GAP-12: No authentication

All endpoints are open. Every response has `Access-Control-Allow-Origin: *`.

**What's needed:**
- API key via `X-API-Key` header.
- CORS restricted to known origins.
- Optional read-only vs read-write roles.

**Effort:** Medium | **Impact:** Medium (security, multi-user)

---

## GAP-13: No scheduling / time windows

No time-based download scheduling or bandwidth windows.

**What's needed:**
- Declaration preferences:
  ```json
  {"schedule_rules": [
    {"start": "22:00", "end": "06:00", "cap_mbps": 0},
    {"start": "09:00", "end": "17:00", "cap_mbps": 10}
  ]}
  ```
- Scheduler evaluates rules on each cycle and adjusts aria2 bandwidth limits.

**Effort:** Large | **Impact:** Medium (power feature)

---

## GAP-14: No item labels / categories

No way to tag or group downloads.

**What's needed:**
- `POST /api/add` accepts `tags: ["movies", "linux-iso"]` per item.
- `GET /api/status?tag=movies` filters by tag.
- Items store `tags` field.

**Effort:** Medium | **Impact:** Small

---

## Priority Summary

### Must fix

| # | Gap | Effort | Why |
|---|-----|--------|-----|
| 1 | Priority endpoint | Small | **Move-to-top is broken** |
| 2 | SSE full payload | Small | Enables zero-polling |
| 6 | PATCH preferences | Small | Removes read-modify-write complexity |

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
| 10 | Webhooks | Medium | Server-side notifications |
| 11 | Speed history | Medium | Persistent sparklines |
| 12 | Authentication | Medium | Security |
| 13 | Scheduling | Large | Power feature |
| 14 | Labels/categories | Medium | Organization |
