# ariaflow-web — Actionable Elements Reference

Complete inventory of all triggers in the UI: user-facing actions, internal
behaviors, and automatic events. Organized by tab, then by trigger type.

## Classification Key

| Label | Meaning |
|-------|---------|
| **Simple** | Single API call, no branching logic |
| **Complex** | Multiple API calls, multi-step logic, or optimistic UI |
| **Not API** | Purely frontend state change (localStorage, filtering, navigation) |
| **Internal** | Automatic behavior triggered by the framework or other actions |

---

## How the Single-Page Update Works (Alpine.js)

ariaflow-web is a single-page application built with **Alpine.js**.
All state lives in one `Alpine.data('ariaflow', ...)` object bound to `<body x-data="ariaflow">`.

### Reactive rendering

Alpine watches every property on the data object. When a property changes
(e.g. `this.lastStatus = data`), Alpine automatically re-renders every DOM
element that references that property via `x-text`, `x-show`, `:class`,
`x-for`, or any other Alpine directive. There is no virtual DOM — Alpine
patches the real DOM in place.

**Example flow:**

1. `refresh()` fetches `GET /api/status` and assigns the response to `this.lastStatus`.
2. Every `x-text="state.running"`, `x-show="backendReachable"`, `x-for="item in filteredItems"` etc. re-evaluates automatically.
3. Computed getters (`get enrichedItems()`, `get filteredItems()`, `get queueStateLabelText()`, …) re-run because their source properties changed.

### No router — manual history

Navigation uses `history.pushState()` + a `popstate` listener. The `page`
property controls which `x-show="page === '...'"` panel is visible. On
navigation, `_loadPageData(target)` fires the right data-fetching calls for
the target tab.

### Optimistic UI

For item actions (pause/resume/retry/remove), the UI updates `lastStatus.items`
immediately before the API responds. If the API fails, the previous state is
rolled back from a snapshot.

### Debounced preference writes

Preference inputs (bandwidth settings, options) go through `_queuePrefChange()`:
1. Each change is queued; last-write-per-name wins.
2. A 400 ms timer resets on every change.
3. When the timer fires, `_flushPrefQueue()` does a read-modify-write cycle:
   `GET /api/declaration` → merge changes → `POST /api/declaration`.
4. If new changes arrive while saving, they flush again after the current save.

### Revision-based skip

`refresh()` compares `data._rev` with `this.lastRev`. If unchanged, the
response is discarded and no DOM update occurs. This avoids unnecessary
re-renders when the backend state hasn't changed.

### Failure dampening

`refresh()` tracks `_consecutiveFailures`. The UI only switches to offline
state after 3 consecutive failures (or immediately if there was no prior data),
preventing flicker from transient network errors.

---

## Internal / Automatic Triggers

These are not user-clickable — they fire automatically.

| Trigger | When | What it does | Endpoint(s) |
|---------|------|-------------|-------------|
| `init()` | Page load | Reads URL path → sets `page`, calls `initTheme()`, `initNotifications()`, loads page-specific data, starts refresh timer, defers backend discovery | varies per page |
| `popstate` listener | Browser back/forward | Updates `page`, calls `_loadPageData()` | varies per page |
| `setInterval` polling | Every N seconds (default 10s, configurable) | Calls `refresh()` → `GET /api/status`, updates all reactive state | `GET /api/status` |
| `deferRefresh(delay)` | After backend selection, add, remove backend (delay=0 or 300ms) | Debounced `refresh()` — cancels pending timer, waits `delay` ms, then fetches | `GET /api/status` |
| `_flushPrefQueue()` | 400ms after last preference change | Batch read-modify-write of declaration preferences | `GET /api/declaration` → `POST /api/declaration` |
| `discoverBackends()` | 2s after `init()` (deferred via `setTimeout`) | Fetches Bonjour-discovered backends, merges into localStorage list | `GET /api/discovery` |
| `checkNotifications(items)` | Every `refresh()` when items change status | Compares previous vs current item status; sends browser Notification on `done` or `error`/`failed` | — (browser Notification API) |
| `initNotifications()` | `init()` | Registers a one-shot click handler to request Notification permission | — (browser Notification API) |
| `initTheme()` | `init()` | Reads saved theme from localStorage, applies it, listens for OS `prefers-color-scheme` changes | — |
| `_loadPageData(target)` | `navigateTo()` or `popstate` | Loads data specific to the target tab (see table below) | varies |
| Revision skip (`_rev`) | Every `refresh()` | If `data._rev === lastRev`, discard response — no DOM update | — |
| Failure dampening | Every failed `refresh()` | Increments `_consecutiveFailures`; only shows offline after 3 failures | — |
| Optimistic rollback | On item action API failure | Restores `lastStatus.items` from pre-action snapshot | — |
| `recordSpeed()` / `recordGlobalSpeed()` | Every `refresh()` | Pushes current speed into per-item and global sparkline history arrays (capped at 30/40 points) | — |

### Data loaded per page navigation

| Target page | Calls triggered by `_loadPageData()` |
|-------------|--------------------------------------|
| dashboard | `refresh()`, `loadDeclaration()` |
| bandwidth | `loadDeclaration()` |
| lifecycle | `loadLifecycle()` → `GET /api/lifecycle` |
| options | `loadDeclaration()` → `GET /api/declaration` |
| log | `loadDeclaration()`, `refreshActionLog()` → `GET /api/log?limit=120` |
| dev | (none) |
| archive | `loadArchive()` → `GET /api/archive` |

---

## Global / Backend Management

### User Actions

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Tab navigation links | Not API | `history.pushState()` + `_loadPageData()` |
| Refresh interval dropdown | Not API | localStorage + `setInterval` reset |
| Theme toggle | Not API | localStorage + `document.documentElement.dataset.theme` |
| Add backend | Not API | localStorage write + `deferRefresh(0)` |
| Select backend | Complex | localStorage write + `deferRefresh(0)` + page-specific loads |
| Remove backend | Not API | localStorage write + `deferRefresh(0)` |

---

## Dashboard

### Queue Controls

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Add URLs | Simple | `POST /api/add` |
| Start / Stop engine | Complex | `POST /api/run` (+ optional `auto_preflight_on_run` param) + optimistic state update |
| New session | Complex | `POST /api/session` + conditional `loadLifecycle()` / `refreshActionLog()` |
| Pause / Resume queue | Complex | `POST /api/pause` or `POST /api/resume` + optimistic `state.paused` update |
| Cleanup old items | Simple | `POST /api/cleanup` |

### Per-Item Actions

| Element | Classification | Endpoint(s) | Notes |
|---------|----------------|-------------|-------|
| Pause item | Simple | `POST /api/item/{id}/pause` | optimistic: sets status to `paused` |
| Dequeue item | Simple | `POST /api/item/{id}/pause` | same endpoint as pause |
| Resume item | Simple | `POST /api/item/{id}/resume` | optimistic: sets status to `queued` |
| Retry item | Simple | `POST /api/item/{id}/retry` | optimistic: sets status to `queued` |
| Remove item | Simple | `POST /api/item/{id}/remove` | optimistic: removes from `items` array |
| Move to top | Simple | `POST /api/item/{id}/priority` | sets priority to `max + 1` |
| Open file selection | Complex | `GET /api/item/{id}/files` | opens modal, loads file list |
| Save file selection | Simple | `POST /api/item/{id}/files` | sends selected file indices |
| Close file selection | Not API | — | clears modal state |

### Filtering

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Filter chips (queued, downloading, …) | Not API | sets `queueFilter`, Alpine re-renders `filteredItems` |
| Queue search input | Not API | sets `queueSearch`, Alpine re-renders `filteredItems` |

---

## Bandwidth

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Run probe | Complex | `POST /api/bandwidth/probe` → `GET /api/bandwidth` (refreshBandwidth) |
| Min free bandwidth (%) | Complex | debounced `GET /api/declaration` → `POST /api/declaration` |
| Min free bandwidth (absolute) | Complex | debounced `GET /api/declaration` → `POST /api/declaration` |
| Bandwidth floor | Complex | debounced `GET /api/declaration` → `POST /api/declaration` |
| Simultaneous downloads | Complex | debounced `GET /api/declaration` → `POST /api/declaration` |
| Duplicate active transfer | Complex | `GET /api/declaration` → `POST /api/declaration` (no delay) |

> All preference inputs use `_queuePrefChange()` with 400 ms debounce and batch flushing.

---

## Service Status

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Refresh status | Simple | `GET /api/lifecycle` |
| Install / Update ariaflow | Simple | `POST /api/lifecycle/action` → `GET /api/lifecycle` |
| Remove ariaflow | Simple | `POST /api/lifecycle/action` → `GET /api/lifecycle` |
| Load aria2 autostart | Simple | `POST /api/lifecycle/action` → `GET /api/lifecycle` |
| Unload aria2 autostart | Simple | `POST /api/lifecycle/action` → `GET /api/lifecycle` |

---

## Options

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Auto preflight checkbox | Complex | `GET /api/declaration` → `POST /api/declaration` |
| Post-action rule dropdown | Complex | `GET /api/declaration` → `POST /api/declaration` |

---

## Log

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Run contract | Simple | `POST /api/ucc` + `refreshActionLog()` |
| Preflight | Simple | `POST /api/preflight` |
| Action / Target / Session filters | Not API | frontend filtering of `actionLogEntries` (already fetched) |
| Load declaration | Simple | `GET /api/declaration` |
| Save declaration | Simple | `POST /api/declaration` |

---

## Developer

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Open Swagger UI | Not API | opens `{backend}/api/docs` in new tab |
| Download OpenAPI spec | Not API | opens `{backend}/api/openapi.yaml` in new tab |
| Run tests | Simple | `GET {backend}/api/tests` |

---

## Archive

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| (auto-load on navigation) | Internal | `GET /api/archive` |

---

## Totals

| Classification | Count |
|----------------|-------|
| Simple | 22 |
| Complex | 13 |
| Not API | 12 |
| Internal | 12 |
| **Total** | **59** |

---

## Backend API Specification

Detailed description of every endpoint the backend must provide to support
all frontend actions and internal behaviors listed above.

### Conventions

- All endpoints are prefixed with `/api/`.
- Request/response bodies are JSON (`Content-Type: application/json`).
- Every response includes `"ok": true|false`.
- On error: `{"ok": false, "message": "human-readable reason"}`.
- The backend is the single source of truth — the frontend never owns state.

---

### 1. Status & Real-Time

#### `GET /api/status`

**Used by:** `refresh()` (polling every 1.5–30s), `deferRefresh()`

The single most important endpoint. The frontend's entire reactive state
derives from this response.

**Must return:**

```json
{
  "ok": true,
  "_rev": "string — opaque revision token, changes when any state changes",
  "state": {
    "running": true,
    "paused": false,
    "session_id": "uuid",
    "session_started_at": "ISO8601",
    "session_last_seen_at": "ISO8601",
    "session_closed_at": null,
    "session_closed_reason": null,
    "last_error": "string or null",
    "active_gid": "string or null",
    "download_speed": 0
  },
  "active": {
    "gid": "string",
    "url": "string",
    "status": "downloading|paused|recovered|...",
    "downloadSpeed": 12345,
    "totalLength": 100000,
    "completedLength": 50000,
    "percent": 50.0,
    "recovered": false,
    "recovered_at": null,
    "errorMessage": null
  },
  "actives": [ "...same shape as active, array of all active transfers" ],
  "items": [
    {
      "id": "unique-item-id",
      "url": "https://...",
      "output": "filename",
      "status": "queued|downloading|paused|recovered|done|error|failed|stopped|cancelled|discovering",
      "priority": 0,
      "gid": "aria2-gid or null",
      "mode": "http|torrent|metalink|null",
      "totalLength": 0,
      "completedLength": 0,
      "percent": null,
      "downloadSpeed": 0,
      "error_message": null,
      "created_at": "ISO8601",
      "completed_at": null,
      "error_at": null
    }
  ],
  "summary": {
    "queued": 3,
    "done": 10,
    "error": 1
  },
  "bandwidth": {
    "interface_name": "en0",
    "source": "networkquality",
    "downlink_mbps": 100.5,
    "uplink_mbps": 20.3,
    "cap_mbps": 50,
    "limit": "50M",
    "partial": false,
    "reason": null
  },
  "ariaflow": {
    "reachable": true,
    "version": "0.1.70",
    "pid": 12345,
    "error": null
  }
}
```

**Key behaviors:**
- `_rev` must change whenever any field changes. The frontend skips DOM updates when `_rev` is unchanged.
- `active` is the single primary transfer. `actives` is the full list (for multi-download).
- `items` is the complete queue. The frontend filters and sorts client-side.
- `bandwidth` is embedded so the dashboard can show cap/speed without a separate call.
- `ariaflow.reachable: false` triggers offline mode in the frontend.

#### `GET /api/events` (SSE)

**Used by:** future replacement for polling

Server-Sent Events stream. Each event pushes the same shape as `/api/status`
(or a delta). The frontend would replace `setInterval` + `refresh()` with:

```js
const es = new EventSource('/api/events');
es.addEventListener('status', (e) => { this.lastStatus = JSON.parse(e.data); });
```

**Event types to support:**
- `status` — full state snapshot (same as `GET /api/status` response)
- `item_update` — single item changed (delta: `{id, status, percent, speed, ...}`)
- `bandwidth` — bandwidth measurement changed
- `session` — session started/closed

---

### 2. Queue Management

#### `POST /api/add`

**Used by:** Add URLs button

**Request:**
```json
{
  "items": [
    {
      "url": "https://example.com/file.zip",
      "output": "custom-name.zip (optional)",
      "priority": 10,
      "mirrors": ["https://mirror1.com/file.zip"]
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "added": [
    { "id": "item-id", "url": "https://...", "status": "queued" }
  ]
}
```

#### `POST /api/item/{id}/pause`

**Used by:** Pause item button, Dequeue button

Pauses an active download or dequeues a waiting item.

**Response:** `{"ok": true, "id": "...", "status": "paused"}`

#### `POST /api/item/{id}/resume`

**Used by:** Resume item button

**Response:** `{"ok": true, "id": "...", "status": "queued"}`

#### `POST /api/item/{id}/retry`

**Used by:** Retry item button

Re-queues a failed/stopped item for another attempt.

**Response:** `{"ok": true, "id": "...", "status": "queued"}`

#### `POST /api/item/{id}/remove`

**Used by:** Remove item button

Removes an item from the queue entirely.

**Response:** `{"ok": true, "id": "...", "removed": true}`

#### `POST /api/item/{id}/priority`

**Used by:** Move to top button

**Request:** `{"priority": 11}`

The frontend calculates `max(all priorities) + 1` and sends it.

**Response:** `{"ok": true, "id": "...", "priority": 11}`

#### `GET /api/item/{id}/files`

**Used by:** Open file selection (torrent/metalink)

**Response:**
```json
{
  "files": [
    { "index": 0, "path": "folder/file1.mkv", "length": 700000000, "selected": true },
    { "index": 1, "path": "folder/file2.nfo", "length": 1024, "selected": true }
  ]
}
```

#### `POST /api/item/{id}/files`

**Used by:** Save file selection

**Request:** `{"select": [0, 2, 3]}` — array of file indices to download.

**Response:** `{"ok": true}`

---

### 3. Engine Control

#### `POST /api/run`

**Used by:** Start / Stop engine button

**Request:**
```json
{
  "action": "start|stop",
  "auto_preflight_on_run": true
}
```

`auto_preflight_on_run` is only sent with `"start"`. If true, the backend
should run preflight checks before starting the queue runner.

**Response:**
```json
{
  "ok": true,
  "result": {
    "started": true,
    "stopped": false
  }
}
```

The frontend optimistically updates `state.running` based on `result.started` / `result.stopped`.

#### `POST /api/pause`

**Used by:** Pause queue button

Pauses the entire queue (no new items start, active transfer may continue).

**Response:** `{"ok": true, "paused": true}`

#### `POST /api/resume`

**Used by:** Resume queue button

**Response:** `{"ok": true, "resumed": true}`

#### `POST /api/session`

**Used by:** New session button

**Request:** `{"action": "new"}`

Creates a new session. The previous session is closed.

**Response:** `{"ok": true, "session_id": "new-uuid"}`

---

### 4. Cleanup & Archive

#### `POST /api/cleanup`

**Used by:** Cleanup old items button

Moves completed/failed items out of the active queue into the archive.

**Response:**
```json
{
  "ok": true,
  "archived": 5
}
```

#### `GET /api/archive`

**Used by:** Archive tab (auto-loaded on navigation)

**Response:**
```json
{
  "items": [
    {
      "id": "...",
      "url": "...",
      "output": "...",
      "status": "done|error|...",
      "created_at": "ISO8601",
      "completed_at": "ISO8601",
      "error_at": null
    }
  ]
}
```

---

### 5. Declaration (Configuration)

#### `GET /api/declaration`

**Used by:** `loadDeclaration()` — loaded on dashboard, bandwidth, options, log tabs. Also read before every preference write (`_flushPrefQueue`).

The declaration is the full engine configuration. The frontend reads
preferences from `uic.preferences[]`.

**Response:**
```json
{
  "ok": true,
  "session_id": "uuid",
  "uic": {
    "preferences": [
      { "name": "bandwidth_free_percent", "value": 20, "options": [20], "rationale": "default 20" },
      { "name": "bandwidth_free_absolute_mbps", "value": 0, "options": [0], "rationale": "default 0" },
      { "name": "bandwidth_floor_mbps", "value": 2, "options": [2], "rationale": "default 2" },
      { "name": "max_simultaneous_downloads", "value": 1, "options": [1], "rationale": "1 preserves the sequential default" },
      { "name": "duplicate_active_transfer_action", "value": "remove", "options": ["remove", "pause", "ignore"], "rationale": "remove duplicate live jobs by default" },
      { "name": "auto_preflight_on_run", "value": false, "options": [true, false], "rationale": "default off" },
      { "name": "post_action_rule", "value": "pending", "options": ["pending"], "rationale": "default placeholder" }
    ]
  }
}
```

**Known preference names used by the frontend:**

| Name | Type | Default | Tab |
|------|------|---------|-----|
| `bandwidth_free_percent` | number | 20 | Bandwidth |
| `bandwidth_free_absolute_mbps` | number | 0 | Bandwidth |
| `bandwidth_floor_mbps` | number | 2 | Bandwidth |
| `max_simultaneous_downloads` | number | 1 | Bandwidth |
| `duplicate_active_transfer_action` | string (`remove`\|`pause`\|`ignore`) | `remove` | Bandwidth |
| `auto_preflight_on_run` | boolean | `false` | Options |
| `post_action_rule` | string | `pending` | Options |

#### `POST /api/declaration`

**Used by:** Save declaration (Log tab), `_flushPrefQueue()` (all preference writes)

**Request:** Full declaration object (same shape as GET response).

The frontend does a **read-modify-write**: GET → patch `uic.preferences` → POST entire object back.

**Response:** The updated declaration (same shape as GET response).

---

### 6. Bandwidth

#### `GET /api/bandwidth`

**Used by:** `refreshBandwidth()` after probe completes

**Response:**
```json
{
  "ok": true,
  "interface_name": "en0",
  "source": "networkquality",
  "downlink_mbps": 100.5,
  "uplink_mbps": 20.3,
  "cap_mbps": 50,
  "limit": "50M",
  "partial": false,
  "reason": null
}
```

#### `POST /api/bandwidth/probe`

**Used by:** Run probe button

Triggers a bandwidth measurement (e.g. via `networkquality` on macOS).
This is a blocking call — the frontend shows "Probe running..." until it resolves.

**Response:**
```json
{
  "ok": true,
  "downlink_mbps": 100.5,
  "uplink_mbps": 20.3
}
```

---

### 7. Lifecycle & Service Status

#### `GET /api/lifecycle`

**Used by:** Service Status tab, refreshed after lifecycle actions

**Response:**
```json
{
  "ok": true,
  "session_id": "uuid or null",
  "ariaflow": {
    "result": { "outcome": "ok|error|...", "reason": "match|missing|...", "message": "...", "completion": "..." }
  },
  "aria2": {
    "result": { "outcome": "...", "reason": "match|missing|..." }
  },
  "networkquality": {
    "result": { "outcome": "...", "reason": "ready|missing|timeout|error|..." }
  },
  "aria2-launchd": {
    "result": { "outcome": "...", "reason": "match|missing|..." }
  }
}
```

Each component has the same structure: `result.outcome` + `result.reason` + optional `result.message` and `result.completion`.

#### `POST /api/lifecycle/action`

**Used by:** Install/Remove ariaflow, Load/Unload aria2 autostart

**Request:**
```json
{
  "target": "ariaflow|aria2-launchd",
  "action": "install|uninstall"
}
```

**Response:** Updated lifecycle state (same shape as GET, possibly nested under `lifecycle` key).

---

### 8. Log & Diagnostics

#### `GET /api/log?limit=120`

**Used by:** `refreshActionLog()` on Log tab

**Response:**
```json
{
  "ok": true,
  "items": [
    {
      "timestamp": "ISO8601",
      "session_id": "uuid",
      "action": "add|poll|run|pause|resume|retry|remove|cleanup|probe|...",
      "target": "queue|item|runner|bandwidth|...",
      "reason": "string or null",
      "outcome": "string or null",
      "message": "string or null",
      "detail": { "...arbitrary data..." },
      "observed_before": { "...snapshot..." },
      "observed_after": { "...snapshot..." }
    }
  ]
}
```

The frontend filters these client-side by `action`, `target`, and `session_id`.

#### `POST /api/preflight`

**Used by:** Preflight button on Log tab

Runs all system checks (aria2 reachable, dependencies present, config valid, etc.).

**Response:**
```json
{
  "ok": true,
  "status": "pass|fail",
  "checks": [
    { "name": "aria2", "status": "pass", "message": "..." },
    { "name": "disk_space", "status": "pass", "message": "..." }
  ]
}
```

#### `POST /api/ucc`

**Used by:** Run contract button on Log tab

Runs the UCC (Unified Contract Check) — the full compliance/health contract.

**Response:**
```json
{
  "ok": true,
  "meta": { "contract": "contract-name", "version": "1.0" },
  "result": {
    "outcome": "converged|error|...",
    "observation": "string",
    "message": "string or null",
    "reason": "string or null"
  },
  "preflight": { "status": "pass|fail" }
}
```

---

### 9. Backend Discovery

#### `GET /api/discovery`

**Used by:** `discoverBackends()` — called 2s after page load

Discovers ariaflow backends on the local network (e.g. via Bonjour/mDNS).

**Response:**
```json
{
  "ok": true,
  "items": [
    { "url": "http://192.168.1.50:8000", "name": "hostname" }
  ]
}
```

The frontend merges discovered URLs into the localStorage backend list.

---

### 10. Developer & Testing

#### `GET /api/docs`

**Used by:** Open Swagger UI button

Serves Swagger UI (interactive API explorer). Opened in a new browser tab.

#### `GET /api/openapi.yaml`

**Used by:** Download OpenAPI spec button

Returns the OpenAPI specification file. Opened in a new browser tab.

#### `GET /api/tests`

**Used by:** Run tests button on Developer tab

Runs the backend test suite and returns results.

**Response:**
```json
{
  "ok": true,
  "passed": 42,
  "failed": 0,
  "errors": 0,
  "total": 42,
  "tests": [
    { "name": "test_add_item", "status": "pass", "duration": 0.05 },
    { "name": "test_bandwidth_probe", "status": "pass", "duration": 1.2 }
  ]
}
```

---

### Endpoint Summary

| Method | Endpoint | Tab / Trigger | Classification |
|--------|----------|---------------|----------------|
| GET | `/api/status` | Polling (all pages) | Simple |
| GET | `/api/events` | SSE stream (future) | Internal |
| POST | `/api/add` | Dashboard | Simple |
| POST | `/api/item/{id}/pause` | Dashboard | Simple |
| POST | `/api/item/{id}/resume` | Dashboard | Simple |
| POST | `/api/item/{id}/retry` | Dashboard | Simple |
| POST | `/api/item/{id}/remove` | Dashboard | Simple |
| POST | `/api/item/{id}/priority` | Dashboard | Simple |
| GET | `/api/item/{id}/files` | Dashboard | Simple |
| POST | `/api/item/{id}/files` | Dashboard | Simple |
| POST | `/api/run` | Dashboard | Complex |
| POST | `/api/pause` | Dashboard | Simple |
| POST | `/api/resume` | Dashboard | Simple |
| POST | `/api/session` | Dashboard | Simple |
| POST | `/api/cleanup` | Dashboard | Simple |
| GET | `/api/archive` | Archive | Simple |
| GET | `/api/declaration` | Bandwidth, Options, Log | Simple |
| POST | `/api/declaration` | Bandwidth, Options, Log | Simple |
| GET | `/api/bandwidth` | Bandwidth | Simple |
| POST | `/api/bandwidth/probe` | Bandwidth | Complex |
| GET | `/api/lifecycle` | Service Status | Simple |
| POST | `/api/lifecycle/action` | Service Status | Simple |
| GET | `/api/log?limit=N` | Log | Simple |
| POST | `/api/preflight` | Log | Simple |
| POST | `/api/ucc` | Log | Simple |
| GET | `/api/discovery` | Init (auto) | Simple |
| GET | `/api/docs` | Developer | Not API |
| GET | `/api/openapi.yaml` | Developer | Not API |
| GET | `/api/tests` | Developer | Simple |
