# ariaflow-web — Feature Gap Analysis

Reference: [webui-aria2](https://github.com/ziahamza/webui-aria2)

This document identifies features present in webui-aria2 that are missing
or partially implemented in ariaflow-web, rated by value and feasibility.

Each gap is tagged with where the work lives:
- **frontend** — work in this repo (`ariaflow-web`)
- **backend** — work in `../ariaflow` (see `../ariaflow/GAPS.md`)
- **both** — coordinated change across both repos

---

## 1. Visual Feedback

### 1.1 Per-download speed chart — frontend

- **webui-aria2**: real-time line chart (DOWN / UP) rendered per active
  download, showing speed history over time.
- **ariaflow-web**: shows current speed as a text label only.
- **Value**: high — speed history reveals stalls, throttling, and recovery
  patterns that a single number cannot communicate.
- **Scope**: add a lightweight inline SVG or canvas sparkline to each
  active queue item. Data source is the existing poll cycle; buffer the
  last N speed samples in JS memory.
- **Backend dependency**: none — speed is already in the status payload.
- **Status**: implemented (inline SVG sparkline, last 30 samples).

### 1.2 Global speed chart — frontend

- **webui-aria2**: sidebar chart showing aggregate download and upload
  speed over time, with axis labels.
- **ariaflow-web**: shows current speed in the Queue panel metric card;
  no historical visualization.
- **Value**: medium — useful when multiple jobs run or when monitoring
  bandwidth cap effectiveness.
- **Scope**: add a small chart in the dashboard hero or summary area.
  Reuse the same sparkline approach as 1.1 with a global speed buffer.
- **Backend dependency**: none.
- **Status**: implemented (SVG sparkline in Speed metric card, last 40 samples, peak label).

### 1.3 ETA display — frontend

- **webui-aria2**: colored pill badges per download showing ETA,
  connections, hash, piece count.
- **ariaflow-web**: shows status badge, progress bar, speed, total, and
  done bytes. Missing: ETA.
- **Value**: medium — ETA is the most requested missing field.
- **Scope**: compute ETA from `(total - done) / speed` in JS. Display
  as an additional badge or sub-label on the active item.
- **Backend dependency**: none — all required data is in the status payload.
- **Status**: implemented (computed from total/done/speed, shown on progress line).

---

## 2. Queue Interaction

### 2.1 Queue status filters — frontend

- **Status**: implemented (filter chips with live counts).

### 2.2 Search / text filter — frontend

- **webui-aria2**: top-bar search field to filter downloads by name or URL.
- **ariaflow-web**: no text search.
- **Value**: medium — becomes important when the queue grows past ~20 items.
- **Scope**: add a search input above the queue list; filter on URL or
  output filename with a simple `includes()` match. Pure JS, no backend.
- **Backend dependency**: none.
- **Status**: implemented.

### 2.3 Per-item action buttons — both

- **webui-aria2**: inline pause, stop, file-list, and settings buttons on
  each download row.
- **ariaflow-web**: pause/resume is global (whole queue). No per-item
  pause, remove, or retry.
- **Value**: high — granular control is expected in any download manager UI.
- **Frontend scope**: add inline action buttons to each queue item row.
  Wire them to per-item API endpoints.
- **Backend scope** (in `../ariaflow`): expose new API endpoints:
  - `POST /api/item/<id>/pause`
  - `POST /api/item/<id>/resume`
  - `POST /api/item/<id>/remove`
  - `POST /api/item/<id>/retry`
  See `../ariaflow/GAPS.md` §2.3 for backend details.
- **Status**: implemented.

---

## 3. Download Features

### 3.1 Torrent / metalink file selection — both

- **webui-aria2**: after pausing a torrent/metalink download, users can
  select which files to download from the list icon.
- **ariaflow-web**: no torrent/metalink file picker.
- **Value**: medium — only relevant when aria2 handles torrents.
- **Frontend scope**: file picker UI that reads the file list from backend
  and sends back selected indices.
- **Backend scope** (in `../ariaflow`): expose aria2's `getFiles` result
  via a new endpoint and accept file selection updates.
  See `../ariaflow/GAPS.md` §3.1.
- **Status**: missing.

### 3.2 DirectURL (download completed files from UI) — both

- **webui-aria2**: configurable server URL pointing to aria2's download
  directory, enabling direct browser downloads of completed files.
- **ariaflow-web**: no direct file access from UI.
- **Value**: medium — convenient for remote setups.
- **Frontend scope**: add a download link/button on completed queue items.
- **Backend scope** (in `../ariaflow`): serve or expose the download
  directory path, or add a file-proxy endpoint.
  See `../ariaflow/GAPS.md` §3.2.
- **Status**: missing.

---

## 4. Configuration & Settings

### 4.1 aria2 global options editor — both

- **webui-aria2**: full settings panel exposing aria2's global and
  per-download options via RPC.
- **ariaflow-web**: Options page exposes ariaflow-level preferences only.
- **Value**: low-medium — ariaflow intentionally abstracts aria2.
- **Frontend scope**: if backend exposes it, add an "Advanced" section on
  the Options page with a safe subset of aria2 globals.
- **Backend scope** (in `../ariaflow`): optional proxy for a curated set
  of aria2 options. See `../ariaflow/GAPS.md` §4.1.
- **Status**: missing (by design).

---

## 5. Deployment & Access

### 5.1 Offline / PWA mode — frontend

- **webui-aria2**: Progressive Web App; works offline after first load.
- **ariaflow-web**: standard server-rendered HTML; no service worker.
- **Value**: low — backend required for any useful operation.
- **Scope**: add a service worker that caches the HTML shell.
- **Backend dependency**: none.
- **Status**: missing (low priority).

### 5.2 Docker image — both

- **webui-aria2**: Dockerfiles for x86 and ARM32v7.
- **ariaflow-web**: no Docker image. Distributed via pip and Homebrew.
- **Value**: medium — simplifies NAS, Raspberry Pi, server deployment.
- **Scope**: Dockerfile can live in either repo. Installs both
  ariaflow + ariaflow-web and exposes ports 8000/8001.
- **Status**: missing.

### 5.3 Multi-language support — frontend

- **Value**: low.
- **Status**: missing (low priority).

---

## 6. UI Polish

### 6.1 Keyboard shortcuts — frontend

- **Value**: low.
- **Status**: missing.

### 6.2 Responsive mobile layout — frontend

- **Status**: implemented.

### 6.3 Notification on completion — frontend

- **Value**: medium — browser Notification API is trivial to add.
- **Scope**: call `Notification.requestPermission()` on load; fire a
  notification when a queue item transitions to `done` or `error`.
- **Backend dependency**: none — status polling already detects transitions.
- **Status**: implemented.

---

## Priority Summary

| # | Feature | Value | Owner | Status |
|---|---------|-------|-------|--------|
| 1.1 | Per-download speed chart | high | frontend | implemented |
| 2.3 | Per-item actions | high | both | implemented |
| 1.3 | ETA display | medium | frontend | implemented |
| 2.2 | Search / text filter | medium | frontend | implemented |
| 6.3 | Browser notifications | medium | frontend | implemented |
| 1.2 | Global speed chart | medium | frontend | implemented |
| 3.2 | DirectURL file download | medium | both | missing |
| 5.2 | Docker image | medium | both | missing |
| 3.1 | Torrent file selection | medium | both | missing |
| 2.1 | Queue status filters | high | frontend | implemented |
| 6.2 | Responsive layout | — | frontend | implemented |

---

## Recommended Next Steps

All high and medium-value frontend-only items are now implemented.
Remaining gaps require either backend work (see `../ariaflow/GAPS.md`)
or are low priority (PWA, i18n, keyboard shortcuts).
