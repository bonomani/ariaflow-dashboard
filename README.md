# ariaflow-web

Local dashboard frontend for `ariaflow`.

It expects an `ariaflow` backend running on the same machine, reachable via:

```bash
ARIAFLOW_API_URL=http://127.0.0.1:8000
```

## Run

```bash
ariaflow-web --host 127.0.0.1 --port 8001
```

## Homebrew

When installed from the tap, the service is intended to run alongside the
`ariaflow` backend:

```bash
brew services start ariaflow
brew services start ariaflow-web
```

Stable GitHub releases now update `bonomani/homebrew-ariaflow/Formula/ariaflow-web.rb`
automatically. The generated formula also depends on `ariaflow`, so a fresh
`brew install ariaflow-web` pulls in the backend package.

## Features

- **7 tabs:** Dashboard, Bandwidth, Service Status, Options, Log, Developer, Archive
- **Real-time updates:** SSE (`/api/events`) with polling fallback
- **Server-side filtering:** Status and session filters forwarded to backend
- **ETag caching:** HTTP 304 support on status polling
- **Optimistic UI:** Item actions update instantly, rollback on failure
- **Multi-backend:** Switch between backends, Bonjour discovery
- **Torrent/metalink upload:** File picker with base64 encoding
- **Session history:** View past sessions and per-session stats
- **aria2 options:** Direct aria2 global option tuning
- **Configurable cleanup:** Threshold inputs for max age and count
- **Browser notifications:** On download complete or failure

## Architecture

Built with **Alpine.js** — single `Alpine.data()` object, reactive DOM patching,
no build step.

Full details in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Documentation

| File | Content |
|------|---------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | UI design rules and backend boundary |
| [`ACTIONS.md`](./ACTIONS.md) | All actionable elements by tab + API spec |
| [`FRONTEND_GAPS.md`](./FRONTEND_GAPS.md) | Remaining frontend gaps (blocked by backend) |
| [`BACKEND_GAPS.md`](./BACKEND_GAPS.md) | Missing backend features |
| [`RELEASE.md`](./RELEASE.md) | Release workflow and checklist |

## Release

Prefer the helper:

```bash
python3 scripts/publish.py plan
python3 scripts/publish.py push
```

Or push to `main` — the GitHub Actions workflow auto-releases, creates a tag,
builds the sdist, updates the Homebrew tap, and creates a GitHub release.
