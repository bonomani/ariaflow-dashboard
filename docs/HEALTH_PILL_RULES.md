# Health Pill Color Rules

Two pills per component row: **running-state** ("is it doing its job")
and **latest-chip** ("am I on the latest"). Each follows the same
4-state palette but with different evidence sources.

## State table

| STATE                    | Running pill                | Latest chip          |
|--------------------------|-----------------------------|----------------------|
| Healthy steady-state     | `[PID … · 5s]` / `1h2m` 🟢 | Latest vX.Y.Z ✓    🟢 |
| Healthy + upgrade waits  | `[PID … · 1h2m]` 🟢        | Latest vX.Y.Z ↑    🟡 |
| Errors in last 5 min     | `[PID … · 1h2m]` 🟡        | Latest vX.Y.Z ✓    🟢 |
| Probe attempt failed     | `[PID … · 1h2m]` 🟢        | Latest ⚠ probe err 🟡 |
| Backend unreachable      | `[unreachable]`     🔴      | Latest ?           ⚪ |
| Process not running      | `[not running]`     🔴      | Latest ?           ⚪ |
| No probe yet (cold load) | `[PID … · 5s]` 🟢          | Latest ?           ⚪ |

## Mapping rules

```
evidence | recency  | result  | meaning
─────────┼──────────┼─────────┼────────────────────────────
present  | fresh    | success | 🟢 green — "yes, working"
present  | fresh    | partial | 🟡 yellow — "working, but ..."
present  | stale    |   any   | 🟡 yellow — "may be stuck"
absent   |    n/a   |   n/a   | ⚪ neutral — "I haven't checked"
negative |   any    |   any   | 🔴 red — "I checked, it's broken"
```

Key invariant: **probe-not-yet-run is neutral, not red**. Operator
opening a fresh page sees gray pills until evidence accumulates,
never red ones that scared them about a healthy system.

## Per-component evidence sources

### ariaflow-server (network daemon)

| Color  | Condition |
|--------|-----------|
| 🟢     | TCP `:8000` reachable + PID present + no 5xx in last 5 minutes |
| 🟡     | Reachable but a 5xx error landed in the last 5 minutes (filtered by `errors_recent[].at`) |
| 🔴     | Unreachable (lifecycle endpoint TCP refused) |
| ⚪     | No probe yet |

The 5-minute window is computed from `Date.now() - 5*60s` against
each entry's `at` timestamp, not from buffer presence. Old entries
in `errors_recent[]` no longer keep the pill yellow forever.

### ariaflow-dashboard (this page)

| Color  | Condition |
|--------|-----------|
| 🟢     | PID present (process is up) |
| ⚪     | No data yet (first request still in flight) |
| 🔴     | Impossible — page can't load if dashboard is down |

Note: an earlier draft had a 30s "warmup" yellow window after restart.
Dropped — recency is already visible in the chip text (`5s`, `1h2m`).
Yellow stays reserved for actual problems.

### aria2 (RPC service, supervised by ariaflow-server)

| Color  | Condition |
|--------|-----------|
| 🟢     | Backend's lifecycle probe got `aria2.getVersion` RPC reply + version parsed |
| 🟡     | Reply received but version unparseable, OR running with newer formula in tap |
| 🔴     | RPC fails / not running |
| ⚪     | Backend hasn't probed yet |

### networkquality (one-shot CLI, no daemon)

| Color  | Condition |
|--------|-----------|
| 🟢     | `which networkQuality` resolves + last invocation exited 0 |
| 🟡     | Binary exists, last probe exited non-zero |
| 🔴     | Binary not on PATH |
| ⚪     | Never probed |

## Latest-chip color (cross-component)

Same rules for every row.

| Color  | Condition |
|--------|-----------|
| 🟢 ✓   | Probe succeeded, `current === latest` |
| 🟡 ↑   | Probe succeeded, upgrade available |
| 🟡 ⚠   | Probe failed (network error, brew error) |
| ⚪ ?   | No probe yet (default) — never red |
| ⚪ ?   | Source install / unsupported channel |

## Visual hierarchy

```
   GREEN  — operator can ignore the row
  YELLOW  — needs attention soon (upgrade waiting / errors / staleness)
     RED  — needs intervention now (process dead / binary missing)
   GRAY   — no info yet (not lying about the state)
```

## Implementation status (v0.1.577+)

| Rule | Where applied |
|---|---|
| 🟢/🟡/🔴 axis-driven pill (`installed`/`current`/`running`) | all backend rows via `lifecycleBadgeClass` |
| 🟡 5xx errors in last 5 minutes (timestamp-filtered) | server ✓ |
| 🟡 monitoring stale (`now - last_probed_at > 2 × probe_interval`) | all backend rows ✓ via `lifecycleStaleOverlay` (BG-64) |
| Latest chip 🟢 ✓ / 🟡 ↑ / ⚪ ? | dashboard self ✓, server ✓ (via `_serverUpdateProbe` override), aria2 ✓, networkquality ✓ |
| 🟡 ⚠ probe-failed (vs ↑ upgrade-available) | dashboard self ✓, server ✓ |
| ~~30s warmup yellow~~ | **dropped** — recency is in chip text (`5s`/`1h2m`); yellow reserved for real problems |

## Implementation notes

- The 30s warmup means after every Restart click the operator sees
  ~30s of yellow before it goes green. Useful feedback — confirms
  the click landed and the process is fresh.
- "Errors in last 5 minutes" should gate on **5xx** only; benign
  4xx (operator typed a bad URL) shouldn't dim the pill.
- The probe-failed warn (🟡) needs a tooltip with the failure
  reason so the operator can act on it.
- Per-row Check buttons drive their own component's latest-chip;
  no global probe.
