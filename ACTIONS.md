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

## Internal / Automatic Triggers

| Trigger | When | What it does | Endpoint(s) |
|---------|------|-------------|-------------|
| `init()` | Page load | Sets page, inits theme/notifications/SSE, loads page data, starts polling, defers discovery | varies |
| `_initSSE()` | `init()` + backend switch | Opens `EventSource` to `/api/events`, pauses polling on connect, resumes on error | `GET /api/events` |
| `popstate` listener | Browser back/forward | Updates `page`, calls `_loadPageData()` | varies |
| `setInterval` polling | Every N seconds (fallback when SSE disconnected) | `refresh()` → `GET /api/status` with ETag | `GET /api/status` |
| `deferRefresh(delay)` | After backend selection (delay=0 or 300ms) | Debounced `refresh()` | `GET /api/status` |
| `_flushPrefQueue()` | 400ms after last preference change | Batch read-modify-write of preferences | `GET + POST /api/declaration` |
| `discoverBackends()` | 2s after `init()` | Bonjour backend discovery | `GET /api/discovery` |
| `checkNotifications(items)` | Every status update | Browser notification on `done`/`error` | — |
| `initNotifications()` | `init()` | One-shot click handler for Notification permission | — |
| `initTheme()` | `init()` | localStorage theme + OS prefers-color-scheme listener | — |
| `_loadPageData(target)` | Navigation | Loads data for target tab | varies |
| Revision skip | Every `refresh()` | Skip DOM update if `_rev` unchanged | — |
| Failure dampening | Failed `refresh()` | Offline after 3 consecutive failures | — |
| Optimistic rollback | Item action failure | Restore `lastStatus.items` from snapshot | — |
| `recordSpeed()` / `recordGlobalSpeed()` | Every status update | Speed sparkline history (in-memory) | — |

### Data loaded per page navigation

| Page | Calls triggered |
|------|----------------|
| dashboard | `refresh()`, `loadDeclaration()` |
| bandwidth | `loadDeclaration()` |
| lifecycle | `loadLifecycle()` |
| options | `loadDeclaration()` |
| log | `loadDeclaration()`, `refreshActionLog()`, `loadSessionHistory()` |
| dev | `loadApiDiscovery()` |
| archive | `loadArchive()` |

---

## Global / Backend Management

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Tab navigation links | Not API | `history.pushState()` + `_loadPageData()` |
| Refresh interval dropdown | Not API | localStorage + `setInterval` reset |
| Theme toggle | Not API | localStorage |
| Add backend | Not API | localStorage + `deferRefresh(0)` |
| Select backend | Complex | localStorage + `_initSSE()` + `deferRefresh(0)` + page loads |
| Remove backend | Not API | localStorage + `deferRefresh(0)` |

---

## Dashboard

### Queue Controls

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Add URLs | Simple | `POST /api/add` (supports torrent_data, metalink_data, post_action_rule) |
| Start / Stop engine | Complex | `POST /api/run` + optimistic state |
| New session | Complex | `POST /api/session` + conditional reloads |
| Pause / Resume queue | Complex | `POST /api/pause` or `/api/resume` + optimistic UI |
| Cleanup old items | Simple | `POST /api/cleanup` (with max_done_age_days, max_done_count) |

### Per-Item Actions

| Element | Classification | Endpoint(s) | Notes |
|---------|----------------|-------------|-------|
| Pause item | Simple | `POST /api/item/{id}/pause` | optimistic |
| Dequeue item | Simple | `POST /api/item/{id}/pause` | same endpoint |
| Resume item | Simple | `POST /api/item/{id}/resume` | optimistic |
| Retry item | Simple | `POST /api/item/{id}/retry` | optimistic |
| Remove item | Simple | `POST /api/item/{id}/remove` | optimistic |
| Move to top | Simple | `POST /api/item/{id}/priority` | **backend missing** |
| Open file selection | Complex | `GET /api/item/{id}/files` | modal |
| Save file selection | Simple | `POST /api/item/{id}/files` | |
| Close file selection | Not API | — | |

### Filtering

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Filter chips | Not API + Simple | `?status=` forwarded to backend when not `all` |
| Queue search | Not API | client-side |

---

## Bandwidth

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Run probe | Complex | `POST /api/bandwidth/probe` → `GET /api/bandwidth` |
| Min free bandwidth (%) | Complex | debounced `GET + POST /api/declaration` |
| Min free bandwidth (abs) | Complex | debounced `GET + POST /api/declaration` |
| Bandwidth floor | Complex | debounced `GET + POST /api/declaration` |
| Simultaneous downloads | Complex | debounced `GET + POST /api/declaration` |
| Duplicate active transfer | Complex | `GET + POST /api/declaration` |

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
| Auto preflight checkbox | Complex | `GET + POST /api/declaration` |
| Post-action rule dropdown | Complex | `GET + POST /api/declaration` |

---

## Log

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Run contract | Simple | `POST /api/ucc` + `refreshActionLog()` |
| Preflight | Simple | `POST /api/preflight` |
| Action / Target / Session filters | Not API | client-side filtering |
| Log limit dropdown | Simple | `GET /api/log?limit=N` |
| Load declaration | Simple | `GET /api/declaration` |
| Save declaration | Simple | `POST /api/declaration` |
| Session history list | Simple | `GET /api/sessions?limit=50` |
| Session stats (click) | Simple | `GET /api/session/stats?session_id=X` |

---

## Developer

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Open Swagger UI | Not API | opens `{backend}/api/docs` |
| Download OpenAPI spec | Not API | opens `{backend}/api/openapi.yaml` |
| Run tests | Simple | `GET /api/tests` |
| API endpoint catalog | Simple | `GET /api` |
| Set aria2 option | Simple | `POST /api/aria2/options` |

---

## Archive

| Element | Classification | Endpoint(s) |
|---------|----------------|-------------|
| Auto-load on navigation | Internal | `GET /api/archive?limit=N` |
| Load more | Simple | `GET /api/archive?limit=N` (increased) |
