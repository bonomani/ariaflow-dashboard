// SSE event-payload parsers + small predicates supporting the
// dashboard's real-time push pipeline. The connection state machine
// (EventSource lifecycle, fallback timers) stays in app.ts because
// it's tightly coupled to Alpine state; these are the pure shaping
// helpers around it.

// ---------- state_changed ----------

export interface StateChangedFull {
  kind: 'full';
  /** The full /api/status payload pushed inline by the backend. */
  data: Record<string, unknown> & { items?: unknown[]; _rev?: string | null };
  /** True when the embedded data signals the backend is unreachable. */
  isOffline: boolean;
}

export interface StateChangedRev {
  kind: 'rev';
  rev: string | number;
}

export interface StateChangedInvalid {
  kind: 'invalid';
  reason: 'parse-error' | 'empty';
}

export type StateChangedEvent = StateChangedFull | StateChangedRev | StateChangedInvalid;

function isOfflinePayload(data: Record<string, unknown>): boolean {
  if (data?.ok === false) return true;
  const aria = data['ariaflow-server'] as { reachable?: unknown } | undefined;
  return aria?.reachable === false;
}

export function parseStateChangedEvent(raw: string | null | undefined): StateChangedEvent {
  if (!raw) return { kind: 'invalid', reason: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'invalid', reason: 'parse-error' };
  }
  if (!data || typeof data !== 'object') {
    return { kind: 'invalid', reason: 'parse-error' };
  }
  const obj = data as Record<string, unknown>;
  // Full payload: backend pushed status inline (has items[]).
  if (Array.isArray(obj.items)) {
    return {
      kind: 'full',
      data: obj as StateChangedFull['data'],
      isOffline: isOfflinePayload(obj),
    };
  }
  // Lightweight tick: just a revision number, client should fetch.
  if (obj.rev != null && (typeof obj.rev === 'string' || typeof obj.rev === 'number')) {
    return { kind: 'rev', rev: obj.rev };
  }
  return { kind: 'invalid', reason: 'parse-error' };
}

// ---------- action_logged ----------

export interface ActionLogEntry {
  [k: string]: unknown;
}

export function parseActionLoggedEvent(raw: string | null | undefined): ActionLogEntry | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') return data as ActionLogEntry;
  } catch {
    /* ignore malformed events */
  }
  return null;
}

// ---------- offline display gate ----------
//
// The dashboard only flips to the offline state after 3 consecutive
// failures (avoids transient flicker), unless there's no prior data
// at all — in which case the very first failure is shown immediately
// so the user sees something rather than a blank page.
export function shouldShowOfflineStatus(
  consecutiveFailures: number,
  hasPriorStatus: boolean,
): boolean {
  return !hasPriorStatus || consecutiveFailures >= 3;
}

// ---------- status URL composition ----------
//
// Maps the dashboard's display filter ("downloading", "done") back to
// backend status names and folds the optional session=current filter
// into the query string.
const FILTER_TO_BACKEND_STATUS: Record<string, string> = {
  downloading: 'active',
  done: 'complete',
};

export interface StatusUrlOptions {
  queueFilter?: string | null;
  sessionFilter?: string | null;
}

export function buildStatusUrl(basePath: string, opts: StatusUrlOptions = {}): string {
  const params: string[] = [];
  const qf = opts.queueFilter;
  if (qf && qf !== 'all') {
    const backendStatus = FILTER_TO_BACKEND_STATUS[qf] ?? qf;
    params.push(`status=${encodeURIComponent(backendStatus)}`);
  }
  if (opts.sessionFilter === 'current') {
    params.push('session=current');
  }
  return params.length ? `${basePath}?${params.join('&')}` : basePath;
}

// ---------- SSE reconnect backoff ----------
//
// Exponential backoff with ±25% jitter, capped. Used by the SSE
// reconnect path so a single backend outage doesn't pin every client
// in a tight 5-second loop, and so when the backend comes back up the
// reconnect storm spreads out instead of all hitting at once.

export interface BackoffOptions {
  /** First retry delay in ms. Default 5_000. */
  baseMs?: number;
  /** Maximum delay in ms; backoff caps here. Default 60_000. */
  capMs?: number;
  /** Multiplicative jitter spread (0..1). Default 0.25 (±25%). */
  jitter?: number;
  /** Random source — override in tests. Default Math.random. */
  random?: () => number;
}

export function nextReconnectDelayMs(attempts: number, opts: BackoffOptions = {}): number {
  const baseMs = opts.baseMs ?? 5_000;
  const capMs = opts.capMs ?? 60_000;
  const jitter = opts.jitter ?? 0.25;
  const random = opts.random ?? Math.random;
  const safeAttempts = Math.max(0, Math.floor(attempts));
  const exp = Math.min(baseMs * 2 ** safeAttempts, capMs);
  // (random()*2 - 1) ∈ [-1, 1) → spread = exp * jitter * that
  const spread = exp * jitter * (random() * 2 - 1);
  return Math.max(0, Math.round(exp + spread));
}

// ---------- SSE liveness predicate ----------
//
// True when no event has arrived from the server in `timeoutMs`. Used
// to detect "TCP open, no data" zombie connections that EventSource
// won't surface on its own.

export function isStreamStale(
  lastActivityAt: number,
  now: number,
  timeoutMs = 60_000,
): boolean {
  return now - lastActivityAt > timeoutMs;
}
