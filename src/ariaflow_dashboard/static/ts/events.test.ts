import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStatusUrl,
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
