# ariaflow-web Architecture

## 1. Short Overview

`ariaflow-web` is the browser UI for `ariaflow`.
It does not own engine truth.
It reads the backend API, renders engine state, and sends user actions back to the engine.

## 2. Canonical Role

The UI should stay orthogonal to the engine:

- the backend owns truth
- the UI owns presentation and interaction
- the browser may store preferences locally
- the UI must not become a second source of truth

## 3. Technology

- **Framework:** Alpine.js — single `Alpine.data('ariaflow', ...)` object on `<body>`
- **Rendering:** Reactive DOM patching via `x-text`, `x-show`, `:class`, `x-for`
- **No build step:** Plain JS + HTML, no bundler, no transpiler
- **State:** One flat object with computed getters. All state derives from `lastStatus` (backend response)
- **Navigation:** Manual `history.pushState()` + `popstate` listener. `page` property controls visibility

## 4. Data Flow

```
Backend API → _fetch() / SSE → this.lastStatus → Alpine re-renders DOM
User click → action handler → POST to backend → SSE push or polling updates state
```

### Real-time updates

1. **SSE primary:** `EventSource` connects to `GET /api/events`
2. **Polling fallback:** `setInterval` at configurable rate (1.5s–30s)
3. **ETag caching:** `If-None-Match` header on status polls, skip on 304
4. **Revision skip:** `_rev` field compared to avoid unnecessary DOM updates
5. **Failure dampening:** Offline state shown only after 3 consecutive failures

### Optimistic UI

Item actions (pause/resume/retry/remove) snapshot state, update immediately,
rollback on API failure.

### Preference writes

Debounced read-modify-write: queue changes → 400ms delay → GET declaration →
merge → POST back. Last-write-per-name wins.

## 5. UI Pages

| Page | Route | Purpose | Data source |
|------|-------|---------|-------------|
| Dashboard | `/` | Queue, engine controls, active transfers | `GET /api/status` |
| Bandwidth | `/bandwidth` | Probe, bandwidth settings | `GET /api/declaration` |
| Service Status | `/lifecycle` | Component install status | `GET /api/lifecycle` |
| Options | `/options` | Auto-preflight, post-action rule | `GET /api/declaration` |
| Log | `/log` | Action history, preflight, UCC, declaration editor, session history | `GET /api/log`, `/api/sessions`, `/api/session/stats` |
| Developer | `/dev` | Swagger UI, OpenAPI spec, test runner, aria2 options, API discovery | `GET /api/tests`, `/api`, `POST /api/aria2/options` |
| Archive | `/archive` | Completed/removed items | `GET /api/archive` |

## 6. UI Layout Rule

The page layout should stay simple and human-readable:

- top: global summary + backend management
- middle: work area (tab content)
- bottom: logs or evidence

This keeps the originating engine object close to its debug signal.

## 7. Backend Selection

The UI supports multiple backend URLs as a browser preference.

- default backend: `http://127.0.0.1:8000`
- selected backend stored in localStorage
- Bonjour discovery merges found backends into the list
- SSE reconnects on backend switch
- the backend remains the source of truth
- the UI only routes requests to the chosen backend

## 8. UI State Rules

- do not duplicate backend truth in the browser
- do not treat localStorage as canonical state
- do not hide failures behind empty loading states
- show backend-unavailable errors clearly

## 9. UI / Backend Boundary

```text
Backend -> owns queue, session, run, policy, logs
UI -> renders engine state, sends actions, stores preferences
Browser storage -> remembers selected backend and UI preferences only
SSE -> real-time push from backend, polling as fallback
```

## 10. Design Rules

- Keep the UI simpler than the backend.
- Avoid duplicate explanations across pages.
- Keep debug near the object it explains when possible.
- Use logs for evidence, not as the primary explanation.
- Keep the selected backend visible.
- Make backend failure states obvious.
- Use the light-blue primary button style only for the active selection.
- Do not add extra active-selection text when the button style already communicates selection.
