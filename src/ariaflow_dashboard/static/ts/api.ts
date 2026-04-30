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

// Join a backend base URL with an absolute API path. Strips any
// trailing slashes from the base so `joinUrl('http://h:8000/', '/api/x')`
// and `joinUrl('http://h:8000', '/api/x')` produce the same result.
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fetch a URL and parse the body as JSON, typed by the caller.
// Throws ApiError on non-2xx responses; the underlying network error
// is propagated unchanged (e.g. AbortError on timeout).
export async function getJson<T>(url: string, opts: ApiFetchOptions = {}): Promise<T> {
  const r = await apiFetch(url, opts);
  if (!r.ok) {
    throw new ApiError(`HTTP ${r.status} for ${url}`, r.status, url);
  }
  return (await r.json()) as T;
}

// POST a JSON body and parse the JSON response. Same error semantics
// as getJson; sets Content-Type unless the caller already did.
export async function postJson<TResp>(
  url: string,
  body: unknown,
  opts: ApiFetchOptions = {},
): Promise<TResp> {
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const r = await apiFetch(url, {
    ...opts,
    method: opts.method ?? 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new ApiError(`HTTP ${r.status} for ${url}`, r.status, url);
  }
  return (await r.json()) as TResp;
}

// POST with no body. Caller can decide whether to throw on non-2xx
// (see thrownOnError) or read the raw Response (default returns it
// without throwing so the caller can inspect data.ok / data.message).
export async function postEmpty(url: string, opts: ApiFetchOptions = {}): Promise<Response> {
  return apiFetch(url, { ...opts, method: opts.method ?? 'POST' });
}
