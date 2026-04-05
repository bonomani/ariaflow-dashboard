# Directives Claude Code - ariaflow-web (frontend)

## General rule — external repos and directories
- On ANY repo or directory other than this one (ariaflow-web), you MAY ONLY run read-only commands: `cat`, `head`, `grep`, `find`, `ls`, `git log`, `git show`, `git diff` (without write flags).
- NEVER run mutating commands outside this repo: `git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git reset`, `rm`, `mv`, `cp`, `sed`, `pip install`, or any command that modifies files, state, or history.

## Cross-repo boundary — ariaflow (backend)
- The backend repo is at /home/bc/repos/github/bonomani/ariaflow
- The backend is a separate project. All communication is through the API.
- You MAY read backend source files (src/aria_queue/) to stay in sync with API contracts, action types, status values, etc.
- EXCEPTION: You MAY write/update `/home/bc/repos/github/bonomani/ariaflow/docs/BACKEND_GAPS.md` to report missing or inconsistent API behavior discovered during frontend development. No other writes allowed.
- If the user asks you to operate on the backend repo (beyond reading or the BACKEND_GAPS.md exception), remind them of this boundary and suggest they use a separate session from the backend repo.
