import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStatusUrl,
  isStreamStale,
  nextReconnectDelayMs,
  parseActionLoggedEvent,
  parseStateChangedEvent,
  shouldShowOfflineStatus,
} from './events.js';

// ---------- parseStateChangedEvent ----------

test('parseStateChangedEvent returns invalid on empty / null', () => {
  assert.deepEqual(parseStateChangedEvent(null), { kind: 'invalid', reason: 'empty' });
  assert.deepEqual(parseStateChangedEvent(''), { kind: 'invalid', reason: 'empty' });
});

test('parseStateChangedEvent returns invalid on malformed JSON', () => {
  const r = parseStateChangedEvent('{not json');
  assert.equal(r.kind, 'invalid');
  if (r.kind === 'invalid') assert.equal(r.reason, 'parse-error');
});

test('parseStateChangedEvent returns full when items[] is present', () => {
  const r = parseStateChangedEvent(
    JSON.stringify({ items: [], _rev: 'r1', ok: true }),
  );
  assert.equal(r.kind, 'full');
  if (r.kind === 'full') {
    assert.equal(r.data._rev, 'r1');
    assert.equal(r.isOffline, false);
  }
});

test('parseStateChangedEvent flags isOffline when ok=false', () => {
  const r = parseStateChangedEvent(JSON.stringify({ items: [], ok: false }));
  assert.equal(r.kind, 'full');
  if (r.kind === 'full') assert.equal(r.isOffline, true);
});

test('parseStateChangedEvent flags isOffline via ariaflow-server.reachable', () => {
  const r = parseStateChangedEvent(
    JSON.stringify({ items: [], 'ariaflow-server': { reachable: false } }),
  );
  assert.equal(r.kind, 'full');
  if (r.kind === 'full') assert.equal(r.isOffline, true);
});

test('parseStateChangedEvent returns rev when only rev is present', () => {
  assert.deepEqual(parseStateChangedEvent(JSON.stringify({ rev: 'r2' })), {
    kind: 'rev',
    rev: 'r2',
  });
  assert.deepEqual(parseStateChangedEvent(JSON.stringify({ rev: 42 })), {
    kind: 'rev',
    rev: 42,
  });
});

test('parseStateChangedEvent returns invalid when payload has neither items nor rev', () => {
  const r = parseStateChangedEvent(JSON.stringify({ foo: 'bar' }));
  assert.equal(r.kind, 'invalid');
});

// ---------- parseActionLoggedEvent ----------

test('parseActionLoggedEvent returns the parsed object', () => {
  const r = parseActionLoggedEvent(JSON.stringify({ action: 'add', target: 'x' }));
  assert.deepEqual(r, { action: 'add', target: 'x' });
});

test('parseActionLoggedEvent returns null on bad input', () => {
  assert.equal(parseActionLoggedEvent(null), null);
  assert.equal(parseActionLoggedEvent(''), null);
  assert.equal(parseActionLoggedEvent('{nope'), null);
});

// ---------- shouldShowOfflineStatus ----------

test('shouldShowOfflineStatus shows immediately when no prior status', () => {
  assert.equal(shouldShowOfflineStatus(1, false), true);
});

test('shouldShowOfflineStatus debounces 1-2 failures when there is prior status', () => {
  assert.equal(shouldShowOfflineStatus(1, true), false);
  assert.equal(shouldShowOfflineStatus(2, true), false);
});

test('shouldShowOfflineStatus shows after 3+ failures', () => {
  assert.equal(shouldShowOfflineStatus(3, true), true);
  assert.equal(shouldShowOfflineStatus(10, true), true);
});

// ---------- buildStatusUrl ----------

test('buildStatusUrl returns the base when no filters apply', () => {
  assert.equal(buildStatusUrl('/api/status'), '/api/status');
  assert.equal(buildStatusUrl('/api/status', { queueFilter: 'all' }), '/api/status');
  assert.equal(
    buildStatusUrl('/api/status', { sessionFilter: 'historical' }),
    '/api/status',
  );
});

test('buildStatusUrl maps display filters to backend status names', () => {
  assert.equal(
    buildStatusUrl('/api/status', { queueFilter: 'downloading' }),
    '/api/status?status=active',
  );
  assert.equal(
    buildStatusUrl('/api/status', { queueFilter: 'done' }),
    '/api/status?status=complete',
  );
});

test('buildStatusUrl passes other filters through unchanged', () => {
  assert.equal(
    buildStatusUrl('/api/status', { queueFilter: 'paused' }),
    '/api/status?status=paused',
  );
});

test('buildStatusUrl combines status + session=current', () => {
  assert.equal(
    buildStatusUrl('/api/status', { queueFilter: 'error', sessionFilter: 'current' }),
    '/api/status?status=error&session=current',
  );
});

test('buildStatusUrl url-encodes filter values', () => {
  assert.equal(
    buildStatusUrl('/api/status', { queueFilter: 'a b' }),
    '/api/status?status=a%20b',
  );
});

// ---------- nextReconnectDelayMs ----------

// Use random=() => 0.5 → spread = exp * jitter * (0.5*2 - 1) = 0
// so the helper returns the exact base * 2^attempts (capped).
const NO_JITTER = { random: () => 0.5 };

test('nextReconnectDelayMs doubles per attempt up to the cap', () => {
  const opts = { ...NO_JITTER, baseMs: 1000, capMs: 10_000 };
  assert.equal(nextReconnectDelayMs(0, opts), 1_000);
  assert.equal(nextReconnectDelayMs(1, opts), 2_000);
  assert.equal(nextReconnectDelayMs(2, opts), 4_000);
  assert.equal(nextReconnectDelayMs(3, opts), 8_000);
  assert.equal(nextReconnectDelayMs(4, opts), 10_000); // capped
  assert.equal(nextReconnectDelayMs(99, opts), 10_000); // still capped
});

test('nextReconnectDelayMs treats negative / non-integer attempts safely', () => {
  const opts = { ...NO_JITTER, baseMs: 1000, capMs: 10_000 };
  assert.equal(nextReconnectDelayMs(-5, opts), 1_000);
  assert.equal(nextReconnectDelayMs(1.7, opts), 2_000);
});

test('nextReconnectDelayMs applies symmetric jitter around the exponential value', () => {
  const opts = { baseMs: 1000, capMs: 60_000, jitter: 0.25 };
  // random()=0 → spread = exp * 0.25 * -1 = -250 → 750
  assert.equal(nextReconnectDelayMs(0, { ...opts, random: () => 0 }), 750);
  // random()=1 → spread = exp * 0.25 * +1 = +250 → 1250
  assert.equal(nextReconnectDelayMs(0, { ...opts, random: () => 1 }), 1_250);
  // random()=0.5 → spread = 0 → exact base
  assert.equal(nextReconnectDelayMs(0, { ...opts, random: () => 0.5 }), 1_000);
});

test('nextReconnectDelayMs jitter never produces a negative delay', () => {
  // Even with random()=0 (max-negative jitter) and small base, result is clamped to >=0.
  const opts = { baseMs: 100, capMs: 60_000, jitter: 0.5, random: () => 0 };
  assert.ok(nextReconnectDelayMs(0, opts) >= 0);
});

test('nextReconnectDelayMs uses sensible production defaults', () => {
  // No opts: baseMs=5000, capMs=60000, jitter=0.25
  // attempt 0: 5000 ± 1250
  for (let i = 0; i < 50; i++) {
    const d = nextReconnectDelayMs(0);
    assert.ok(d >= 3_750 && d <= 6_250, `attempt 0 delay ${d} out of [3750, 6250]`);
  }
  // attempt 5: would be 5000*32 = 160_000 → capped at 60_000 ± 15_000
  for (let i = 0; i < 50; i++) {
    const d = nextReconnectDelayMs(5);
    assert.ok(d >= 45_000 && d <= 75_000, `attempt 5 delay ${d} out of [45000, 75000]`);
  }
});

// ---------- isStreamStale ----------

test('isStreamStale returns false within timeout window', () => {
  assert.equal(isStreamStale(1_000, 60_000, 60_000), false);
  assert.equal(isStreamStale(1_000, 60_999, 60_000), false);
});

test('isStreamStale returns true past the timeout', () => {
  assert.equal(isStreamStale(1_000, 61_001, 60_000), true);
});

test('isStreamStale honors a custom timeout', () => {
  assert.equal(isStreamStale(0, 5_000, 10_000), false);
  assert.equal(isStreamStale(0, 15_000, 10_000), true);
});
