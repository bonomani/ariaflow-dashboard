# Agent Instructions — ariaflow-dashboard (frontend)

## General rule — external repos and directories
- On ANY repo or directory other than this one (ariaflow-dashboard), you MAY ONLY run read-only commands: `cat`, `head`, `grep`, `find`, `ls`, `git log`, `git show`, `git diff` (without write flags).
- NEVER run mutating commands outside this repo: `git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git reset`, `rm`, `mv`, `cp`, `sed`, `pip install`, or any command that modifies files, state, or history.

## Testing policy
- Run `make verify` before committing (check-drift + tests).
- Run `make ci` before pushing (verify + lint + format check).
- Use `pytest -k <name>` for targeted test runs.

## Cross-repo boundary — ariaflow-server (backend)
- The backend repo is at `/home/bc/repos/github/bonomani/ariaflow-server`.
- The backend is a separate project. All communication is through its API.
- You MAY read backend source files to stay in sync with contracts, types, and behavior.
- EXCEPTION: You MAY write/update `../ariaflow-server/docs/BACKEND_GAPS_REQUESTED_BY_FRONTEND.md` to report API gaps. No other writes allowed.
- If the user asks you to operate on the backend repo (beyond reading or the gaps file exception), remind them of this boundary and suggest they use a separate session from that repo.

## Gap reporting

### Files
- **Paired gaps file:** `../ariaflow-server/docs/BACKEND_GAPS_REQUESTED_BY_FRONTEND.md` — gaps about the backend. Single source of truth, no mirrors.
- **Local gaps file:** `FRONTEND_GAPS.md` — gaps about this repo only.
- **Paired gap IDs:** `BG-N` (next available number, never reuse).
- **Local gap IDs:** `FE-N` (next available number, never reuse).

### File structure — MANDATORY
Both gap files follow this layout:
1. `## Open (N)` — heading with count. Open gaps go here, newest first.
2. `_End of open gaps._` — sentinel line. Agents can stop reading here.
3. `## Resolved` — compact table: `| ID | Summary | Date |`. One line per entry.
4. Details for resolved entries live in git history, not in the file.

### When to file a backend gap
- Backend is missing a feature this repo needs.
- Its API returns inconsistent, malformed, or undocumented data.
- Its behavior contradicts its own documentation or spec.

### Before filing — mandatory checks
1. Read the CURRENT backend source to confirm the issue still exists.
2. Read the paired gaps file to avoid duplicates.
3. If unsure whether it's a frontend or backend problem, investigate both sides first.

### Gap entry format (for paired gaps file)
Each open gap must have:
- A stable ID: `BG-N` as the heading: `### BG-N: <summary>`
- A description with file:line references if relevant.
- **Desired:** what the backend should do.
- **Blocks frontend gap:** the corresponding `FE-N` or `(none)`.
- **Priority:** `critical` / `high` / `medium` / `low`.

### Pairing rule — MANDATORY
- When you file a backend gap, you MUST also file a corresponding `FE-N` entry in `FRONTEND_GAPS.md`, marked `Blocked by: BG-N`.
- Exception: pure infrastructure gaps (no user-visible frontend counterpart) — note `Blocks frontend gap: (none)` and skip the local gap.

### Lifecycle
- Open gaps live under `## Open (N)`. Update the count when adding/removing.
- When a gap is fixed, delete it from Open, add a row to the Resolved table, update the count.
- After any gap-related work, re-read both files and verify pairing consistency.

## BGS governance
- Entry file: `docs/governance/BGS.md`
- Decision record: `docs/governance/bgs-decision.yaml`
- Drift check: `python scripts/check_bgs_drift.py`
- BGS slice: `BGS-Verified` (BISS + UCC + TIC)
- When changing governed artifacts (schemas, declarations, tests), update evidence_refs if needed.
