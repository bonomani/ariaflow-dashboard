# Frontend Gaps

Remaining issues — all blocked by backend changes.

---

### FE-1: Move-to-top calls non-existent endpoint — BROKEN

`moveToTop()` calls `POST /api/item/{id}/priority`. Backend returns 400.

**Blocked by:** Backend GAP-1

### FE-2: SSE receives rev-only, needs extra fetch

SSE event only contains `{rev, server_version}`. Frontend must call `refresh()` per event.

**Blocked by:** Backend GAP-2

### FE-3: Preference writes use read-modify-write

`_flushPrefQueue()` does GET → merge → POST. Race-prone with multiple tabs.

**Blocked by:** Backend GAP-6

### FE-4: No bulk action UI

No multi-item buttons. Each action is a separate POST.

**Blocked by:** Backend GAP-3

### FE-5: No pagination UI

All items loaded at once. Backend lacks `offset`/`limit` on `/api/status`.

**Blocked by:** Backend GAP-4

### FE-6: Speed sparklines lost on reload

In-memory only. No server-side speed history.

**Blocked by:** Backend GAP-11

---

## Resolved (commit `68accf4`)

| Issue | Fix |
|-------|-----|
| itemAction timeout/rollback | Fetch wrapped in try/catch, rollback on network failure |
| No polling backoff | Exponential backoff on failures (cap 60s), reset on recovery |
| SSE/polling overlap | 2s debounce before polling fallback, cancelled on SSE reconnect |
| Silent error swallowing | `.catch(() => {})` → `console.warn` |
