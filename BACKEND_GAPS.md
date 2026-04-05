# Backend Gaps

> **AI Agent Directive:** This file documents features the **backend** (`ariaflow`)
> must implement. The frontend repo (`ariaflow-web`) must **never** implement
> backend logic — only consume APIs. If you are an AI agent working on
> `ariaflow-web`, treat every item below as **blocked/out-of-scope**. If you are
> an AI agent working on `ariaflow`, treat each item as an actionable task.

---

*No open gaps — all previously identified gaps have been resolved.*

---

## Resolved

| ID | What | Resolution |
|----|------|------------|
| BG-1 | SSE pushed rev-only | SSE now pushes full payload (items, state, summary) |
| BG-2 | No PATCH for preferences | `PATCH /api/declaration/preferences` added |
