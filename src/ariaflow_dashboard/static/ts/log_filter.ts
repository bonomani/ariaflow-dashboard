// Action log filtering + poll-collapse for the Log tab.
//
// Three filter axes (action / target / session) plus a "collapse
// consecutive poll entries with the same gid into one row carrying a
// _pollCount" rule that keeps the live log readable when SSE pushes
// dozens of poll events per second. Result is reversed (newest first).

export interface ActionLogEntry {
  action?: string | null;
  target?: string | null;
  session_id?: string | null;
  timestamp?: string | number | null;
  detail?: { gid?: string | null; [k: string]: unknown } | null;
  /** Set by collapse — undefined for un-collapsed entries. */
  _pollCount?: number;
  [k: string]: unknown;
}

export interface LogFilterOptions {
  actionFilter: string;
  targetFilter: string;
  sessionFilter: string;
  /** Active session id used by sessionFilter='current'. */
  currentSessionId: string | null;
}

function passesAxis(value: string | null | undefined, filter: string): boolean {
  if (filter === 'all') return true;
  return (value ?? 'unknown') === filter;
}

function passesSession(
  entrySessionId: string | null | undefined,
  sessionFilter: string,
  currentSessionId: string | null,
): boolean {
  if (sessionFilter === 'all') return true;
  if (sessionFilter !== 'current') return true;
  if (!currentSessionId) return false;
  return entrySessionId === currentSessionId;
}

function shouldCollapse(prev: ActionLogEntry, entry: ActionLogEntry): boolean {
  return (
    prev.action === 'poll' && entry.action === 'poll' && prev.detail?.gid === entry.detail?.gid
  );
}

// Apply axis filters then poll-collapse. Output is in display order
// (newest first) — the input is assumed to be append-order
// (oldest first), as the SSE feed and /api/log return it.
export function filterActionLog(
  entries: readonly ActionLogEntry[],
  opts: LogFilterOptions,
): ActionLogEntry[] {
  const visible = entries.filter(
    (e) =>
      passesAxis(e.action, opts.actionFilter) &&
      passesAxis(e.target, opts.targetFilter) &&
      passesSession(e.session_id, opts.sessionFilter, opts.currentSessionId),
  );

  const collapsed: ActionLogEntry[] = [];
  for (const entry of visible) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && shouldCollapse(prev, entry)) {
      prev._pollCount = (prev._pollCount ?? 1) + 1;
      prev.detail = entry.detail;
      prev.timestamp = entry.timestamp ?? prev.timestamp;
      continue;
    }
    collapsed.push({ ...entry });
  }
  return collapsed.reverse();
}

// Distinct, sorted action names from a log slice. Used to populate
// the action filter dropdown.
export function distinctActions(entries: readonly ActionLogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.action ?? 'unknown'))].sort();
}

// Distinct, sorted target names from a log slice. Used to populate
// the target filter dropdown.
export function distinctTargets(entries: readonly ActionLogEntry[]): string[] {
  return [...new Set(entries.map((e) => e.target ?? 'unknown'))].sort();
}
