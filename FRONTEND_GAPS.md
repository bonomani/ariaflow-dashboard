# Frontend Gaps

## Open

### FE-15: Drop Log tab polling once backend pushes log events

Currently `_mediumTimer` polls `/api/log` every 30s on the Log tab. Once
BG-7 is resolved and the backend pushes `action_logged` SSE events, the
frontend can:
- Drop `refreshActionLog` from `_TAB_MEDIUM.log`
- Append incoming events to `actionLogEntries` in the SSE handler
- Keep manual Refresh button as a user-triggered fallback

**Blocked by:** BG-7
**Priority:** low

### FE-16: Drop `_heroTimer` once health fields are in `/api/status`

Currently a dedicated `_heroTimer` polls `/api/health` every 120s to keep
the disk chip fresh. Once BG-8 is resolved (health fields merged into
`/api/status`), the frontend can:
- Remove `_heroTimer` and `loadHealth()` entirely
- Read `lastStatus.health.disk_usage_percent` etc. directly
- Update `diskUsageText` / `diskOk` getters to read from `lastStatus.health`

**Blocked by:** BG-8
**Priority:** low

---

## Resolved

*(cleaned 2026-04-06 — see git log for FE-3 through FE-14 history)*
