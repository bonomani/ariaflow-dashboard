# Plan

## Phase 1: Refactor — consolidate all Bonjour/network code into bonjour.py

Currently:
- `bonjour.py` — mDNS browse/resolve, IP resolution for .local hosts
- `webapp.py` — `_local_hostname()`, `_local_ips()` inlined (doesn't belong in HTTP server)

Move network identity helpers into `bonjour.py`:
- Keep `discover_http_services()` (existing)
- Add `local_hostname()` — short hostname via `platform.node()`
- Add `main_local_ip()` — Google UDP trick, identifies default outbound interface
- Add `all_local_ips()` — every non-loopback IPv4 via `getaddrinfo(hostname)`
- Add `local_identity()` — returns `{hostname, main_ip, ips: [...]}`

Update `webapp.py` to import and use them. Drop inlined versions.

## Phase 2: Simplify selector display

Goal: selector shows only the hostname/name, IPs move to System Info.

### 2a: Update `backendDisplayName(url)`

- Default backend → just `hostname` (e.g. `bcs-Mac-mini`)
- Discovered with Bonjour name → just the name, strip `(N)` suffix (e.g. `bc's Mac AriaFlow`)
- No metadata → just `host` from URL (e.g. `192.168.1.20:8000`)
- **No IP appended in parens** — keeps the dropdown clean

### 2b: Move IP info to System Info section

Inject into HTML via webapp.py globals:
- `window.__ARIAFLOW_WEB_HOSTNAME__`
- `window.__ARIAFLOW_WEB_LOCAL_MAIN_IP__`
- `window.__ARIAFLOW_WEB_LOCAL_IPS__` (array of all non-loopback IPs)

In the "System info" collapsible details block on the hero panel, add:
- Chip per IP: `<ip>` with a `main` badge on the primary one
- Label: "Interfaces"

## Phase 3: Verify

- Run fast tests (96 expected)
- Run mypy clean
