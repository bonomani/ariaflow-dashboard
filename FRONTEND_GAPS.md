# Frontend Gaps

Remaining issues — all blocked by backend changes.

---

### FE-1: SSE receives rev-only, needs extra fetch

SSE event only contains `{rev, server_version}`. Frontend must call `refresh()` per event.

**Blocked by:** Backend GAP-2

### FE-2: Preference writes use read-modify-write

`_flushPrefQueue()` does GET → merge → POST. Race-prone with multiple tabs.

**Blocked by:** Backend GAP-6

### FE-3: No bulk action UI

No multi-item buttons. Each action is a separate POST.

**Blocked by:** Backend GAP-3

### FE-4: No pagination UI

All items loaded at once. Backend lacks `offset`/`limit` on `/api/status`.

**Blocked by:** Backend GAP-4

### FE-5: Speed sparklines lost on reload

In-memory only. No server-side speed history.

**Blocked by:** Backend GAP-11

---

## Resolved

| Commit | What |
|--------|------|
| `91cb8c8` | Aligned preference names to backend, removed moveToTop (no endpoint), added waiting state, uplink controls, probe interval, backend summary for filter counts |
| `68accf4` | itemAction timeout/rollback, exponential backoff, SSE/polling overlap guard, console.warn on errors |
| `ddc503d` | Alpine reactivity fixes (spread reassignment), cached backend getters, stable x-for keys |
| `b0437d1` | Wired 13 backend features: SSE, server-side filtering, ETag, sessions, aria2 options, torrent upload, etc. |
