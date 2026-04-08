# Frontend Gaps

## Open

### FE-17: No CI enforcement for BGS compliance

The new BGS validation flow works locally and via pre-commit, but not in
GitHub Actions, because the validator depends on the private sibling repo
`../BGSPrivate`.

Current state:
- `tests/test_bgs_compliance.py` validates the claim locally.
- `.pre-commit-config.yaml` can run the check before commit.
- CI cannot currently resolve the validator path or private repo dependency.

Impact:
- Contract/governance drift can still merge if contributors skip local checks.
- The repo claims BGS-Verified, but enforcement is only partial.

Needed:
- Either wire CI to reach the validator and private repo safely, or document
  local-only enforcement as a permanent limitation and stop treating CI parity
  as an expected next step.

### FE-18: No schema/test oracle for `/api/events`

The schema migration now covers JSON endpoints, but the SSE stream at
`/api/events` is still outside that contract layer.

Current state:
- JSON response shapes are covered by `docs/schemas/` plus validation tests.
- `/api/events` is only checked for existence/behavior, not for event payload
  structure.

Impact:
- SSE payload drift can break the live dashboard without being caught by the
  new schema-backed tests.

Needed:
- Add an event-stream test strategy only if SSE payload stability becomes a
  recurring source of regressions. Otherwise keep this explicitly deferred.

### FE-19: Manual BGS SHA maintenance

The pinned BGS refs in `docs/bgs-decision.yaml` are checked by
`tests/test_bgs_sha_drift.py`, but that test only warns.

Current state:
- Drift is visible locally.
- The pin is not auto-updated.
- Warning-only mode avoids blocking unrelated work.

Impact:
- The decision record can silently lag the actual BGSPrivate checkout for a
  while.

Needed:
- Keep the warning if low-friction maintenance is preferred, or promote the
  drift check to a stricter gate if the repo wants tighter provenance control.

## Resolved

- FE-15: Log tab no longer depends on polling once backend `action_logged`
  SSE events are available.
- FE-16: Hero/health data no longer depends on a dedicated `/api/health`
  polling timer; health now comes from `/api/status.health`.
- Legacy inline contract declarations are being migrated into
  `docs/ucc-declarations.yaml` and `docs/schemas/`.
