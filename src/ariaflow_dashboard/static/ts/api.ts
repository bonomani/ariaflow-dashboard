// HTTP layer: typed fetch wrapper with timeout via AbortController.
// Used by the Alpine component in app.ts; will absorb the per-endpoint
// helpers (status, lifecycle, declaration, downloads, ...) as the
// typed split progresses.

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function apiFetch(url: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(timer));
}
