#!/usr/bin/env bash
# FE-28 smoke test: hit the 5 canonical routes the dashboard now uses.
# Reports HTTP status for each and exits non-zero on any 4xx/5xx.
#
# Usage:
#   BACKEND_URL=http://127.0.0.1:8080 scripts/smoke-canonical-routes.sh
#
# Run after a deploy, before BG-36 deletes the alias handlers, to confirm
# the canonical paths are live. Each request body is intentionally minimal —
# we're checking routing, not semantics.

set -uo pipefail

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8080}"
fail=0

probe() {
  local method="$1" path="$2" body="${3:-}"
  local code
  if [[ -n "$body" ]]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
      -X "$method" -H 'Content-Type: application/json' -d "$body" \
      --max-time 5 "$BACKEND_URL$path" || echo "000")
  else
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
      -X "$method" --max-time 5 "$BACKEND_URL$path" || echo "000")
  fi
  if [[ "$code" =~ ^2 ]]; then
    printf '  ok    %-3s %s -> %s\n' "$method" "$path" "$code"
  else
    printf '  FAIL  %-3s %s -> %s\n' "$method" "$path" "$code"
    fail=1
  fi
}

echo "Probing canonical routes against $BACKEND_URL"
probe POST  '/api/downloads'                  '{"items":[]}'
probe PUT   '/api/declaration'                '{}'
probe PATCH '/api/declaration/preferences'    '{}'
probe GET   '/api/aria2/global_option'
probe GET   '/api/aria2/option?gid=dummy'

if [[ $fail -ne 0 ]]; then
  echo "Some canonical routes are not responding. Check backend deploy." >&2
  exit 1
fi
echo "All 5 canonical routes responded 2xx."
