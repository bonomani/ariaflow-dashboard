import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bootstrapFreshnessRouter,
  wireHostVisibility,
  type BootstrapAdapters,
} from './freshness-bootstrap.js';

function makeAdapters(response: unknown, opts: { fail?: boolean } = {}): BootstrapAdapters {
  return {
    metaUrl: () => 'http://x/api/_meta',
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => {},
    fetchJson: async (m, p) => {
      if (opts.fail) throw new Error('boom');
      assert.equal(m, 'GET');
      assert.equal(p, '/api/_meta');
      return response;
    },
  };
}

test('bootstrap returns router with registered endpoints', async () => {
  const r = await bootstrapFreshnessRouter(
    makeAdapters({
      ok: true,
      endpoints: [
        { method: 'GET', path: '/api/status', freshness: 'live', transport: 'sse' },
        { method: 'GET', path: '/api/lifecycle', freshness: 'warm', ttl_s: 30 },
      ],
    }),
  );
  assert.ok(r);
  const endpoints = r!.status().map((s) => s.endpoint).sort();
  assert.deepEqual(endpoints, ['GET /api/lifecycle', 'GET /api/status']);
});

test('bootstrap returns null on fetch error (legacy backend, 404)', async () => {
  const r = await bootstrapFreshnessRouter(makeAdapters(null, { fail: true }));
  assert.equal(r, null);
});

test('bootstrap returns null when backend reports ok:false', async () => {
  const r = await bootstrapFreshnessRouter(makeAdapters({ ok: false }));
  assert.equal(r, null);
});

test('bootstrap skips entries missing required fields', async () => {
  const r = await bootstrapFreshnessRouter(
    makeAdapters({
      ok: true,
      endpoints: [
        { method: 'GET', path: '/api/foo', freshness: 'cold' },
        { method: '', path: '/api/bar', freshness: 'cold' }, // skip
        { method: 'GET', path: '', freshness: 'cold' }, // skip
      ],
    }),
  );
  assert.equal(r!.status().length, 1);
});

// ---------- wireHostVisibility ----------

class FakeDoc {
  hidden = false;
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  addEventListener(type: string, fn: (e: unknown) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  emit(type: string, ev: unknown = {}): void {
    for (const f of this.listeners[type] ?? []) f(ev);
  }
}

class FakeWin {
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  addEventListener(type: string, fn: (e: unknown) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  emit(type: string, ev: unknown = {}): void {
    for (const f of this.listeners[type] ?? []) f(ev);
  }
}

test('wireHostVisibility flips on document.visibilitychange', async () => {
  const doc = new FakeDoc();
  const win = new FakeWin();
  const r = await bootstrapFreshnessRouter(
    makeAdapters({ ok: true, endpoints: [{ method: 'GET', path: '/api/x', freshness: 'cold' }] }),
  );
  const w = wireHostVisibility(r!, win as unknown as Window, doc as unknown as Document);
  assert.equal(w.isVisible(), true);
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(w.isVisible(), false);
  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.equal(w.isVisible(), true);
});

test('wireHostVisibility flips on postMessage visibility from host', async () => {
  const doc = new FakeDoc();
  const win = new FakeWin();
  const r = await bootstrapFreshnessRouter(
    makeAdapters({ ok: true, endpoints: [{ method: 'GET', path: '/api/x', freshness: 'cold' }] }),
  );
  const w = wireHostVisibility(r!, win as unknown as Window, doc as unknown as Document);
  win.emit('message', { data: { type: 'visibility', visible: false } });
  assert.equal(w.isVisible(), false);
  win.emit('message', { data: { type: 'visibility', visible: true } });
  assert.equal(w.isVisible(), true);
});

test('wireHostVisibility ignores foreign postMessages', async () => {
  const doc = new FakeDoc();
  const win = new FakeWin();
  const r = await bootstrapFreshnessRouter(
    makeAdapters({ ok: true, endpoints: [{ method: 'GET', path: '/api/x', freshness: 'cold' }] }),
  );
  const w = wireHostVisibility(r!, win as unknown as Window, doc as unknown as Document);
  win.emit('message', { data: { type: 'something-else' } });
  win.emit('message', { data: 'string-not-object' });
  assert.equal(w.isVisible(), true);
});

test('wireHostVisibility dispose removes listeners', async () => {
  const doc = new FakeDoc();
  const win = new FakeWin();
  const r = await bootstrapFreshnessRouter(
    makeAdapters({ ok: true, endpoints: [{ method: 'GET', path: '/api/x', freshness: 'cold' }] }),
  );
  const w = wireHostVisibility(r!, win as unknown as Window, doc as unknown as Document);
  w.dispose();
  assert.equal(doc.listeners['visibilitychange']?.length ?? 0, 0);
  assert.equal(win.listeners['message']?.length ?? 0, 0);
});
