# Plan

Current work in `ariaflow-web` is a contract-governance migration, not a
feature sprint. The goal is to make the frontend's backend assumptions
explicit, machine-checked, and reviewable.

## Current migration

- Move BGS decision detail out of `BGS.md` into `docs/bgs-decision.yaml`.
- Treat `docs/ucc-declarations.yaml` as the canonical declaration for:
  endpoint coverage, action coverage, expected preferences, and known-unused
  backend fields.
- Add frontend-owned JSON schemas under `docs/schemas/` for the subset of
  backend response shapes the UI actually consumes.
- Add tests that verify:
  mock fixtures match the frontend schemas,
  frontend schemas are a subset of backend OpenAPI,
  the UCC declaration artifact is well-formed,
  the BGS claim passes the local validator.

## Next steps

- Run and stabilize the new test set:
  `tests/test_api_response_shapes.py`
  `tests/test_openapi_alignment.py`
  `tests/test_ucc_declarations_schema.py`
  `tests/test_bgs_compliance.py`
  `tests/test_bgs_sha_drift.py`
  plus the existing contract tests in `tests/test_api_params.py` and
  `tests/test_coverage_check.py`.
- Verify that the new docs and tests are internally consistent:
  `BGS.md`, `docs/bgs-decision.yaml`, `docs/ucc-declarations.yaml`,
  `docs/schemas/`, `.pre-commit-config.yaml`.
- Decide whether the migration lands as one commit series now or is dropped
  entirely. The partial state is the only bad state.

## Open items

- **No CI enforcement for BGS compliance.** The validator depends on the
  private `../BGSPrivate` sibling checkout, so this currently runs only
  locally and via pre-commit.
- **No schema oracle for `/api/events` yet.** SSE uses `text/event-stream`,
  so it needs a different test strategy than the JSON endpoints.
- **Pinned BGS SHAs must be maintained manually.** `tests/test_bgs_sha_drift.py`
  warns when `docs/bgs-decision.yaml` lags behind `../BGSPrivate/bgs`.

## Deferred

- **Mock fixtures (DEFAULT_STATUS etc.) → YAML.** Not worth the churn.
- **Generated `BGS.md`.** Too small to justify generation.
- **BGS Grade-2 style profiles/policies.** No clear value for this repo.
