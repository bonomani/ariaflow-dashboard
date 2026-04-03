# ariaflow-web — Actionable Elements Reference

Complete inventory of all triggers in the UI, based on a fresh scan of
`app.js` (1445 lines) and `index.html` (789 lines).

---

## Internal / Automatic Triggers

| Trigger | When | Endpoint |
|---------|------|----------|
| `init()` | Page load | varies |
| `_initSSE()` | init + backend switch | `GET /api/events` |
| `popstate` | Browser back/forward | varies via `_loadPageData()` |
| Polling (`refresh()`) | Fallback every N seconds | `GET /api/status` (with ETag, backoff) |
| `_flushPrefQueue()` | 400ms after pref change | `GET + POST /api/declaration` |
| `discoverBackends()` | 2s after init | `GET /api/discovery` |
| `checkNotifications()` | Every status update | Browser Notification API |
| `recordSpeed()` / `recordGlobalSpeed()` | Every status update | — (in-memory sparklines) |

### Data loaded per page

| Page | Calls |
|------|-------|
| dashboard | `refresh()`, `loadDeclaration()` |
| bandwidth | `loadDeclaration()` |
| lifecycle | `loadLifecycle()` |
| options | `loadDeclaration()` |
| log | `loadDeclaration()`, `refreshActionLog()`, `loadSessionHistory()` |
| dev | `loadApiDiscovery()` |
| archive | `loadArchive()` |

---

## Global (34 @click, 10 @change, 5 @input, 19 x-model)

| Element | Handler | Endpoint |
|---------|---------|----------|
| Tab links (7) | `navigateTo(target)` | — |
| Refresh interval | `setRefreshInterval($el.value)` | — (localStorage) |
| Theme toggle | `toggleTheme()` | — (localStorage) |
| Add backend | `addBackend()` | — (localStorage + SSE reconnect) |
| Select backend | `selectBackend(backend)` | — (localStorage + `_initSSE()` + `deferRefresh()`) |
| Remove backend | `removeBackend(backend)` | — (localStorage + `deferRefresh()`) |

---

## Dashboard

### Queue Controls

| Element | Handler | Endpoint |
|---------|---------|----------|
| Add URLs | `add()` | `POST /api/add` |
| Start / Stop engine | `toggleRunner()` | `POST /api/run` |
| New session | `newSession()` | `POST /api/session` |
| Pause / Resume queue | `toggleQueue()` | `POST /api/pause` or `/api/resume` |
| Cleanup | `cleanup()` | `POST /api/cleanup` |

### Per-Item Actions

| Element | Handler | Endpoint | Notes |
|---------|---------|----------|-------|
| Pause | `itemAction(id, 'pause')` | `POST /api/item/{id}/pause` | optimistic |
| Dequeue | `itemAction(id, 'pause')` | `POST /api/item/{id}/pause` | same endpoint |
| Resume | `itemAction(id, 'resume')` | `POST /api/item/{id}/resume` | optimistic |
| Retry | `itemAction(id, 'retry')` | `POST /api/item/{id}/retry` | optimistic |
| Remove | `itemAction(id, 'remove')` | `POST /api/item/{id}/remove` | optimistic |
| File select (open) | `openFileSelection(id)` | `GET /api/item/{id}/files` | modal |
| File select (save) | `saveFileSelection()` | `POST /api/item/{id}/files` | |
| File select (close) | `closeFileSelection()` | — | |

### Filtering & Search

| Element | Handler | Notes |
|---------|---------|-------|
| Filter chips | `setQueueFilter(f)` | `?status=` mapped to backend names (downloading→active, done→complete) |
| Search input | `x-model="queueSearch"` | client-side |

**Filter states:** all, queued, waiting, discovering, downloading, paused, stopped, done, error, cancelled

---

## Bandwidth

| Element | Handler | Endpoint / Preference |
|---------|---------|----------------------|
| Run probe | `runProbe()` | `POST /api/bandwidth/probe` → `GET /api/bandwidth` |
| Downlink free (%) | `setBandwidthPref(...)` | `bandwidth_down_free_percent` (default 20) |
| Downlink free (abs) | `setBandwidthPref(...)` | `bandwidth_down_free_absolute_mbps` (default 0) |
| Uplink free (%) | `setBandwidthPref(...)` | `bandwidth_up_free_percent` (default 50) |
| Uplink free (abs) | `setBandwidthPref(...)` | `bandwidth_up_free_absolute_mbps` (default 0) |
| Probe interval | `setBandwidthPref(...)` | `bandwidth_probe_interval_seconds` (default 180) |
| Simultaneous downloads | `setSimultaneousLimit(...)` | `max_simultaneous_downloads` (default 1) |
| Duplicate transfer | `setDuplicateAction(...)` | `duplicate_active_transfer_action` (default remove) |

All preference inputs debounced 400ms via `_queuePrefChange()`.

---

## Service Status

| Element | Handler | Endpoint |
|---------|---------|----------|
| Refresh | `loadLifecycle()` | `GET /api/lifecycle` |
| Install/Update ariaflow | `lifecycleAction('ariaflow', 'install')` | `POST /api/lifecycle/action` |
| Remove ariaflow | `lifecycleAction('ariaflow', 'uninstall')` | `POST /api/lifecycle/action` |
| Load aria2 autostart | `lifecycleAction('aria2-launchd', 'install')` | `POST /api/lifecycle/action` |
| Unload aria2 autostart | `lifecycleAction('aria2-launchd', 'uninstall')` | `POST /api/lifecycle/action` |

---

## Options

| Element | Handler | Preference |
|---------|---------|------------|
| Auto preflight | `setAutoPreflightPreference(...)` | `auto_preflight_on_run` |
| Post-action rule | `setPostActionRule(...)` | `post_action_rule` |

---

## Log

| Element | Handler | Endpoint |
|---------|---------|----------|
| Run contract | `uccRun()` | `POST /api/ucc` |
| Preflight | `preflightRun()` | `POST /api/preflight` |
| Action filter | `x-model="actionFilter"` @change `refreshActionLog()` | — (client-side) |
| Target filter | `x-model="targetFilter"` @change `refreshActionLog()` | — (client-side) |
| Session filter | `x-model="sessionFilter"` @change `refreshActionLog()` | — (client-side) |
| Log limit | `x-model="logLimit"` @change `refreshActionLog()` | `GET /api/log?limit=N` |
| Load declaration | `loadDeclaration(true)` | `GET /api/declaration` |
| Save declaration | `saveDeclaration()` | `POST /api/declaration` |
| Session history | auto-loaded on navigation | `GET /api/sessions?limit=50` |
| Session stats | `loadSessionStats(id)` on click | `GET /api/session/stats?session_id=X` |

---

## Developer

| Element | Handler | Endpoint |
|---------|---------|----------|
| Swagger UI | `openDocs()` | opens `{backend}/api/docs` |
| OpenAPI spec | `openSpec()` | opens `{backend}/api/openapi.yaml` |
| Run tests | `runTests()` | `GET /api/tests` |
| API catalog | auto-loaded on navigation | `GET /api` |
| Set aria2 option | `setAria2Option()` | `POST /api/aria2/options` |

---

## Archive

| Element | Handler | Endpoint |
|---------|---------|----------|
| Auto-load | `loadArchive()` | `GET /api/archive?limit=N` |
| Load more | `loadMoreArchive()` | `GET /api/archive?limit=N` (increased) |

---

## Add Form (Advanced Options)

| Element | Binding | Sent in `POST /api/add` |
|---------|---------|------------------------|
| URL textarea | `x-model="urlInput"` | `items[].url` |
| Output filename | `x-model="addOutput"` | `items[].output` |
| Priority | `x-model="addPriority"` | `items[].priority` |
| Mirrors | `x-model="addMirrors"` | `items[].mirrors` |
| .torrent file | `handleFileUpload($event, 'torrent')` | `items[].torrent_data` (base64) |
| .metalink file | `handleFileUpload($event, 'metalink')` | `items[].metalink_data` (base64) |
| Post-action rule | `x-model="addPostActionRule"` | `items[].post_action_rule` |

---

## Totals

| Category | Count |
|----------|-------|
| Async backend methods | 28 |
| @click handlers | 34 |
| @change handlers | 10 |
| @input handlers (debounced) | 5 |
| x-model bindings | 19 |
| SSE event handlers | 2 (connected, state_changed) |
| Timers | 3 (polling, defer, SSE fallback) |
| Getters from lastStatus | ~50 |
| Getters from lastDeclaration | 9 |

## Dropped Features

| Feature | Reason |
|---------|--------|
| Move to top button | `POST /api/item/{id}/priority` does not exist in backend |
| Bandwidth floor input | `bandwidth_floor_mbps` preference does not exist in backend |
