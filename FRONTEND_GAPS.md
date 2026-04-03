# Frontend Gaps

Remaining frontend issues after the FE-1..FE-13 wiring (commit `b0437d1`).

---

## FE-GAP-1: Preference changes still use read-modify-write

`_queuePrefChange()` / `_flushPrefQueue()` does GET → merge → POST for every
preference change. This is fragile (race conditions if two tabs are open).

**Blocked by:** Backend GAP-6 (PATCH endpoint needed).

**Current workaround:** Debounce + last-write-wins + re-entrancy guard.

---

## FE-GAP-2: No bulk action UI

No "Retry all errors", "Remove all done", "Pause all downloading" buttons.
Each item action is a separate POST.

**Blocked by:** Backend GAP-3 (bulk endpoint needed).

---

## FE-GAP-3: No pagination UI

All queue items loaded at once. No next/prev controls.
Server-side filtering (`?status=`) is wired, but pagination (`offset`/`limit`) is not
because the backend doesn't support it on `/api/status`.

**Blocked by:** Backend GAP-4 (pagination support needed).

---

## FE-GAP-4: SSE receives rev-only events

The SSE handler supports both full-payload and rev-only modes, but the backend
only pushes `{rev, server_version}`. On each SSE event the frontend calls
`refresh()` — one extra round-trip per event.

**Blocked by:** Backend GAP-2 (push full payload).

---

## FE-GAP-5: Move-to-top calls a non-existent endpoint

`moveToTop()` calls `POST /api/item/{id}/priority` which doesn't exist.
The backend returns 400 (invalid action).

**Blocked by:** Backend GAP-1 (priority endpoint missing).

---

## FE-GAP-6: Speed sparklines lost on reload

`speedHistory` and `globalSpeedHistory` are in-memory only.

**Blocked by:** Backend GAP-11 (speed history endpoint needed).

---

## Summary

| # | Gap | Blocked by |
|---|-----|------------|
| 1 | Read-modify-write preferences | Backend GAP-6 |
| 2 | No bulk action UI | Backend GAP-3 |
| 3 | No pagination | Backend GAP-4 |
| 4 | SSE rev-only (extra fetch) | Backend GAP-2 |
| 5 | Move-to-top broken | Backend GAP-1 |
| 6 | Sparklines lost on reload | Backend GAP-11 |

All remaining frontend gaps are **blocked by backend work**.
