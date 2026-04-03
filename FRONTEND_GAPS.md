# Frontend Gaps — Features the Backend Already Supports

The backend (`ariaflow/webapp.py`) provides these features. The frontend
does not use them. Zero backend work needed — only frontend wiring.

---

## FE-1: SSE real-time stream (`GET /api/events`)

**Backend:** Full SSE with `connected` + `state_changed` events, 30s keepalive, per-client queue.

**Frontend:** Polls via `setInterval` every 1.5–30s with `_rev` skip, failure dampening, `refreshInFlight` guard.

**What to wire:**
- Listen for `state_changed` events
- On event, call `GET /api/status` only if `rev !== lastRev` (Option A)
- Or wait for GAP-2 (backend pushes full payload) and assign directly (Option B)

**Removes:** `setInterval`, `deferRefresh()`, `_consecutiveFailures`, `refreshInFlight`, optimistic UI rollback.

**Effort:** Medium | **Impact:** High

---

## FE-2: Server-side item filtering (`GET /api/status?status=...&session=...`)

**Backend:** Accepts `?status=queued,paused` and `?session=current` query params. Returns `"filtered": true`.

**Frontend:** Downloads all items, filters client-side in `filteredItems` / `filterQueueItems()`.

**What to wire:** When `queueFilter !== 'all'`, pass `?status=<filter>` to the API. Keep client-side search as fallback.

**Effort:** Small | **Impact:** Medium (matters for large queues)

---

## FE-3: Scheduler `stopping` state (`GET /api/scheduler`)

**Backend:** Returns `{status: "stopping"}` when `stop_requested=true`.

**Frontend:** Only shows "running" or "idle". The `stopping` transition is invisible.

**What to wire:** Read `stop_requested` from `/api/status` state or call `/api/scheduler`. Show "stopping..." indicator on the engine button.

**Effort:** Small | **Impact:** Small

---

## FE-4: Session history (`GET /api/sessions?limit=50`)

**Backend:** Returns `{sessions: [...]}` — full list of past sessions.

**Frontend:** Only shows current session info.

**What to wire:** Add a session history panel (Log tab or new tab) listing past sessions with start/close times and reasons.

**Effort:** Medium | **Impact:** Medium

---

## FE-5: Per-session statistics (`GET /api/session/stats?session_id=...`)

**Backend:** Returns per-session stats.

**Frontend:** No usage.

**What to wire:** Show stats per session: items processed, bytes, duration, errors. Combine with FE-4 session history.

**Effort:** Medium | **Impact:** Medium

---

## FE-6: aria2 global options (`POST /api/aria2/options`)

**Backend:** Accepts `{key: value}` pairs, passes to aria2 directly.

**Frontend:** No UI. All tuning goes through declaration preferences.

**What to wire:** Add an "Advanced" section (Developer or Options tab) for direct aria2 options: `max-concurrent-downloads`, `max-connection-per-server`, `split`, `min-split-size`, speed limits, etc.

**Effort:** Medium | **Impact:** Medium (power users)

---

## FE-7: Configurable cleanup thresholds (`POST /api/cleanup`)

**Backend:** Accepts `{max_done_age_days: 7, max_done_count: 100}`.

**Frontend:** Sends no params, always uses defaults.

**What to wire:** Add inputs near the Cleanup button: "Keep done items for N days", "Keep at most N items".

**Effort:** Small | **Impact:** Small

---

## FE-8: Archive pagination (`GET /api/archive?limit=N`)

**Backend:** Accepts `limit` param (1–500, default 100).

**Frontend:** Loads all with no limit param.

**What to wire:** Pass `?limit=100` and add "Load more" or pagination controls.

**Effort:** Small | **Impact:** Small

---

## FE-9: Variable log limit (`GET /api/log?limit=N`)

**Backend:** Accepts `limit` param (1–500, default 120).

**Frontend:** Hardcodes `?limit=120`.

**What to wire:** Add a "Show more" control or dropdown (50/120/250/500).

**Effort:** Small | **Impact:** Small

---

## FE-10: Torrent/metalink file upload (`POST /api/add`)

**Backend:** Accepts `torrent_data` (base64) and `metalink_data` (base64) per item. Validates base64.

**Frontend:** Only sends `{url, output, priority, mirrors}`.

**What to wire:** Add file picker or drag-and-drop for `.torrent`/`.metalink` files. Read → base64 → send as `torrent_data`/`metalink_data`.

**Effort:** Small | **Impact:** Medium (new capability)

---

## FE-11: Per-item post_action_rule (`POST /api/add`)

**Backend:** Each item can have its own `post_action_rule` field.

**Frontend:** Global `post_action_rule` in Options only, not per-item.

**What to wire:** Add per-item "post action" dropdown in the advanced add form.

**Effort:** Small | **Impact:** Small (depends on GAP-9 backend hooks)

---

## FE-12: ETag / HTTP 304 caching (`GET /api/status`)

**Backend:** Sends `ETag` header. Returns `304 Not Modified` on `If-None-Match` match.

**Frontend:** Never sends `If-None-Match`. Always parses full response.

**What to wire:** Add `If-None-Match: <lastETag>` to `_fetch()` for status calls. On 304, skip JSON parsing entirely.

**Effort:** Small | **Impact:** Small (bandwidth saving)

---

## FE-13: API self-discovery (`GET /api`)

**Backend:** Returns full endpoint catalog with descriptions and param hints.

**Frontend:** Hardcodes all paths.

**What to wire:** Low priority. Could display in Developer tab or use to detect available features.

**Effort:** Small | **Impact:** Minimal

---

## Frontend Workarounds to Remove

| Workaround | Root cause | Fix |
|------------|------------|-----|
| `setInterval` + `refresh()` + `_rev` skip + `_consecutiveFailures` + `refreshInFlight` | SSE not consumed | FE-1 |
| `deferRefresh()` after every action | Actions don't push updates | FE-1 (SSE fires after every POST) |
| Optimistic UI + rollback in `itemAction()` | Latency between action and next poll | FE-1 |
| Client-side filtering (`filteredItems`) | All items returned | FE-2 |
| Frontend calculates `max(priority) + 1` | No priority endpoint | Backend GAP-1 |
| `_queuePrefChange()` + `_flushPrefQueue()` read-modify-write | No PATCH for preferences | Backend GAP-6 |
| `recordSpeed()` / `recordGlobalSpeed()` in memory | No server-side history | Backend GAP-11 |
| `checkNotifications()` browser-only | No server-side notifications | Backend GAP-10 |

---

## Priority

| Priority | Items | Effort |
|----------|-------|--------|
| **High** | FE-1 (SSE), FE-2 (filtering), FE-10 (torrent upload) | Small–Medium |
| **Medium** | FE-3 (stopping state), FE-4 (sessions), FE-5 (stats), FE-6 (aria2 options), FE-12 (ETag) | Small–Medium |
| **Low** | FE-7 (cleanup config), FE-8 (archive pagination), FE-9 (log limit), FE-11 (per-item rules), FE-13 (discovery) | Small |
