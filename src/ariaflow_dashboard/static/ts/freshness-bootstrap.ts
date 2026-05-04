// FE-24 step 2: bootstrap the FreshnessRouter from /api/_meta.
//
// Fetches the backend's freshness index (BG-31), constructs a router,
// registers every endpoint. Returns null only on a transport / parse
// error or a malformed payload — the contract requires /api/_meta to
// always be present (BG-31).

import {
  FreshnessRouter,
  type EndpointHost,
  type EndpointMeta,
  type RouterAdapters,
  type FreshnessClass,
} from './freshness.js';

interface MetaResponse {
  ok?: boolean;
  endpoints?: Array<{
    method: string;
    path: string;
    freshness: FreshnessClass;
    ttl_s?: number;
    revalidate_on?: string[];
    transport?: 'sse';
    transport_topics?: string[];
  }>;
}

export interface BootstrapAdapters extends RouterAdapters {
  /** backendPath('/api/_meta') style — handles backend prefix / origin. */
  metaUrl: () => string;
  /** Same-origin '/api/_meta' on the dashboard server (FE-31). Optional;
   *  if omitted, dashboard endpoints (e.g. /api/web/log) must come from
   *  app-level synthetic registration. */
  dashboardMetaUrl?: () => string;
}

async function fetchMeta(
  adapters: BootstrapAdapters,
  url: string,
  host: EndpointHost,
): Promise<MetaResponse | null> {
  try {
    const raw = await adapters.fetchJson('GET', new URL(url, 'http://x').pathname, undefined, host);
    return raw as MetaResponse;
  } catch {
    return null;
  }
}

function registerEndpoints(
  router: FreshnessRouter,
  body: MetaResponse | null,
  host: EndpointHost,
): void {
  if (!body || body.ok === false || !Array.isArray(body.endpoints)) return;
  for (const m of body.endpoints) {
    if (!m.method || !m.path || !m.freshness) continue;
    const meta: EndpointMeta = {
      method: m.method,
      path: m.path,
      freshness: m.freshness,
      host,
    };
    if (m.ttl_s !== undefined) meta.ttl_s = m.ttl_s;
    if (m.revalidate_on !== undefined) meta.revalidate_on = m.revalidate_on;
    if (m.transport !== undefined) meta.transport = m.transport;
    if (m.transport_topics !== undefined) meta.transport_topics = m.transport_topics;
    router.registerMeta(meta);
  }
}

export async function bootstrapFreshnessRouter(
  adapters: BootstrapAdapters,
): Promise<FreshnessRouter | null> {
  const backendBody = await fetchMeta(adapters, adapters.metaUrl(), 'backend');
  if (!backendBody || backendBody.ok === false || !Array.isArray(backendBody.endpoints)) {
    return null;
  }
  const router = new FreshnessRouter(adapters);
  registerEndpoints(router, backendBody, 'backend');
  if (adapters.dashboardMetaUrl) {
    const dashboardBody = await fetchMeta(adapters, adapters.dashboardMetaUrl(), 'dashboard');
    registerEndpoints(router, dashboardBody, 'dashboard');
  }
  return router;
}

// ---------- visibility wiring ----------
//
// Two listeners feed one setHostVisible: document.visibilitychange
// (standalone tab) and postMessage from a host shell (embedded mode).
// First event wins; both call the same entry point.

export interface VisibilityWiring {
  dispose: () => void;
  isVisible: () => boolean;
}

export function wireHostVisibility(
  router: FreshnessRouter,
  win: Window | null = typeof window !== 'undefined' ? window : null,
  doc: Document | null = typeof document !== 'undefined' ? document : null,
): VisibilityWiring {
  let visible = doc ? !doc.hidden : true;
  router.setHostVisible(visible);

  const onDocChange = () => {
    if (!doc) return;
    const next = !doc.hidden;
    if (next !== visible) {
      visible = next;
      router.setHostVisible(visible);
    }
  };
  const onMessage = (ev: MessageEvent) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'visibility') return;
    const next = data.visible !== false;
    if (next !== visible) {
      visible = next;
      router.setHostVisible(visible);
    }
  };

  if (doc) doc.addEventListener('visibilitychange', onDocChange);
  if (win) win.addEventListener('message', onMessage);

  return {
    dispose: () => {
      if (doc) doc.removeEventListener('visibilitychange', onDocChange);
      if (win) win.removeEventListener('message', onMessage);
    },
    isVisible: () => visible,
  };
}
