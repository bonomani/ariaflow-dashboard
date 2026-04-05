# Plan

## Phase 1: Dynamic action log filters

Replace hardcoded `<option>` lists in Action History filter dropdowns with
dynamically generated options from actual log entries.

### 1a: Add computed getters in app.js

- `availableActions` — distinct `action` values from `actionLogEntries`, sorted
- `availableTargets` — distinct `target` values from `actionLogEntries`, sorted

### 1b: Replace hardcoded `<select>` options in index.html

Use `x-for` over the computed getters instead of static `<option>` elements.

### 1c: Reset stale filter

If selected filter value disappears from available options (e.g. log limit change),
fall back to `"all"`.

### Scope

~15 lines app.js, ~15 lines index.html. No backend changes. No logic changes
to `filteredActionLog` getter.
