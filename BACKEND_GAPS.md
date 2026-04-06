# Backend Gaps

> **AI Agent Directive:** This file documents features the **backend** (`ariaflow`)
> must implement. The frontend repo (`ariaflow-web`) must **never** implement
> backend logic — only consume APIs. If you are an AI agent working on
> `ariaflow-web`, treat every item below as **blocked/out-of-scope**. If you are
> an AI agent working on `ariaflow`, treat each item as an actionable task.

---

### BG-3: openapi.yaml lacks response field schemas

`openapi.yaml` declares endpoints but most responses are typed as just
`{type: object}` with no `properties`. This forces the frontend to
hand-maintain a list of expected fields per endpoint, which is fragile
(we missed `/api/health` disk fields entirely).

**Desired:** Each GET endpoint's `responses.200.content.application/json.schema`
should have explicit `properties` listing every field returned, with types.

**Frontend impact:** With proper schemas, `tests/test_api_params.py::TestBackendFieldCoverage`
could auto-discover expected fields from the YAML instead of using a
hand-maintained `EXPECTED_FIELDS` dict. New backend fields would fail the
frontend test until wired — no silent gaps.

**Priority:** Low. Current manual approach works with a guard test that
catches missing endpoint entries (but not missing fields within an entry).

---

## Resolved

| ID | What | Resolution |
|----|------|------------|
| BG-1 | SSE pushed rev-only | SSE now pushes full payload (items, state, summary) |
| BG-2 | No PATCH for preferences | `PATCH /api/declaration/preferences` added |
