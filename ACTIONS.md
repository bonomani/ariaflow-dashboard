# ariaflow-web — Actionable Elements Reference

Complete inventory of all triggers in the UI.

## Internal / Automatic Triggers

| Trigger | What it does | Endpoint(s) |
|---------|-------------|-------------|
| `init()` | Sets page, inits theme/notifications/SSE, loads page data, starts polling | varies |
| `_initSSE()` | EventSource to `/api/events`, pauses polling on connect, 2s debounce fallback | `GET /api/events` |
| `popstate` | Browser back/forward → `_loadPageData()` | varies |
| Polling (fallback) | `refresh()` with ETag, backoff on failure | `GET /api/status` |
| `_flushPrefQueue()` | Debounced read-modify-write of preferences | `GET + POST /api/declaration` |
| `discoverBackends()` | Bonjour discovery (2s after init) | `GET /api/discovery` |
| `checkNotifications()` | Browser notification on done/error | — |

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

## Global / Backend Management

| Element | Endpoint(s) |
|---------|-------------|
| Tab navigation | `history.pushState()` + `_loadPageData()` |
| Refresh interval | localStorage |
| Theme toggle | localStorage |
| Add/select/remove backend | localStorage + `_initSSE()` + `deferRefresh()` |

---

## Dashboard

| Element | Endpoint(s) | Notes |
|---------|-------------|-------|
| Add URLs | `POST /api/add` | supports torrent_data, metalink_data, post_action_rule |
| Start / Stop engine | `POST /api/run` | optimistic state |
| New session | `POST /api/session` | |
| Pause / Resume queue | `POST /api/pause` or `/api/resume` | optimistic |
| Cleanup | `POST /api/cleanup` | configurable max_done_age_days, max_done_count |
| Pause item | `POST /api/item/{id}/pause` | optimistic |
| Dequeue item | `POST /api/item/{id}/pause` | |
| Resume item | `POST /api/item/{id}/resume` | optimistic |
| Retry item | `POST /api/item/{id}/retry` | optimistic |
| Remove item | `POST /api/item/{id}/remove` | optimistic |
| Open file selection | `GET /api/item/{id}/files` | modal |
| Save file selection | `POST /api/item/{id}/files` | |
| Filter chips | `?status=` forwarded to backend | all/queued/waiting/discovering/downloading/paused/stopped/done/error/cancelled |
| Queue search | client-side | |

---

## Bandwidth

| Element | Endpoint(s) | Notes |
|---------|-------------|-------|
| Run probe | `POST /api/bandwidth/probe` → `GET /api/bandwidth` | |
| Downlink free (%) | `GET + POST /api/declaration` | pref: `bandwidth_down_free_percent` |
| Downlink free (abs) | `GET + POST /api/declaration` | pref: `bandwidth_down_free_absolute_mbps` |
| Uplink free (%) | `GET + POST /api/declaration` | pref: `bandwidth_up_free_percent` |
| Uplink free (abs) | `GET + POST /api/declaration` | pref: `bandwidth_up_free_absolute_mbps` |
| Probe interval | `GET + POST /api/declaration` | pref: `bandwidth_probe_interval_seconds` |
| Simultaneous downloads | `GET + POST /api/declaration` | pref: `max_simultaneous_downloads` |
| Duplicate transfer action | `GET + POST /api/declaration` | pref: `duplicate_active_transfer_action` |

---

## Service Status

| Element | Endpoint(s) |
|---------|-------------|
| Refresh | `GET /api/lifecycle` |
| Install/Update ariaflow | `POST /api/lifecycle/action` |
| Remove ariaflow | `POST /api/lifecycle/action` |
| Load/Unload aria2 autostart | `POST /api/lifecycle/action` |

---

## Options

| Element | Endpoint(s) | Notes |
|---------|-------------|-------|
| Auto preflight | `GET + POST /api/declaration` | pref: `auto_preflight_on_run` |
| Post-action rule | `GET + POST /api/declaration` | pref: `post_action_rule` |

---

## Log

| Element | Endpoint(s) |
|---------|-------------|
| Run contract | `POST /api/ucc` |
| Preflight | `POST /api/preflight` |
| Action/Target/Session filters | client-side |
| Log limit dropdown | `GET /api/log?limit=N` |
| Load/Save declaration | `GET/POST /api/declaration` |
| Session history | `GET /api/sessions?limit=50` |
| Session stats | `GET /api/session/stats?session_id=X` |

---

## Developer

| Element | Endpoint(s) |
|---------|-------------|
| Swagger UI | opens `{backend}/api/docs` |
| OpenAPI spec | opens `{backend}/api/openapi.yaml` |
| Run tests | `GET /api/tests` |
| API endpoint catalog | `GET /api` |
| Set aria2 option | `POST /api/aria2/options` |

---

## Archive

| Element | Endpoint(s) |
|---------|-------------|
| Auto-load | `GET /api/archive?limit=N` |
| Load more | increases limit, re-fetches |

---

## Dropped Features

| Feature | Reason |
|---------|--------|
| Move to top button | `POST /api/item/{id}/priority` does not exist in backend |
| Bandwidth floor input | `bandwidth_floor_mbps` preference does not exist in backend |
