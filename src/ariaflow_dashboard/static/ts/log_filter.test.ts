import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  distinctActions,
  distinctTargets,
  filterActionLog,
  type ActionLogEntry,
} from './log_filter.js';

const sample: ActionLogEntry[] = [
  { action: 'add', target: 'queue', session_id: 's1', timestamp: 1 },
  { action: 'poll', target: 'aria2', session_id: 's1', timestamp: 2, detail: { gid: 'g1' } },
  { action: 'poll', target: 'aria2', session_id: 's1', timestamp: 3, detail: { gid: 'g1' } },
  { action: 'poll', target: 'aria2', session_id: 's1', timestamp: 4, detail: { gid: 'g2' } },
  { action: 'remove', target: 'queue', session_id: 's2', timestamp: 5 },
];

const ALL: {
  actionFilter: string;
  targetFilter: string;
  sessionFilter: string;
  currentSessionId: string | null;
} = {
  actionFilter: 'all',
  targetFilter: 'all',
  sessionFilter: 'all',
  currentSessionId: null,
};

// ---------- filterActionLog: ordering + collapse ----------

test('filterActionLog reverses order so newest is first', () => {
  const r = filterActionLog([{ action: 'a' }, { action: 'b' }, { action: 'c' }], ALL);
  assert.deepEqual(
    r.map((e) => e.action),
    ['c', 'b', 'a'],
  );
});

test('filterActionLog collapses consecutive poll entries with same gid', () => {
  const r = filterActionLog(sample, ALL);
  // newest first: remove, poll(g2), poll(g1×2 collapsed), add
  assert.equal(r.length, 4);
  assert.equal(r[0]!.action, 'remove');
  assert.equal(r[1]!.detail?.gid, 'g2');
  assert.equal(r[2]!.detail?.gid, 'g1');
  assert.equal(r[2]!._pollCount, 2);
  assert.equal(r[2]!.timestamp, 3); // last collapsed timestamp wins
  assert.equal(r[3]!.action, 'add');
});

test('filterActionLog does NOT collapse polls with different gids', () => {
  const entries: ActionLogEntry[] = [
    { action: 'poll', detail: { gid: 'a' } },
    { action: 'poll', detail: { gid: 'b' } },
  ];
  const r = filterActionLog(entries, ALL);
  assert.equal(r.length, 2);
  assert.equal(r[0]!._pollCount, undefined);
});

test('filterActionLog does not collapse non-poll actions', () => {
  const entries: ActionLogEntry[] = [
    { action: 'add', detail: { gid: 'a' } },
    { action: 'add', detail: { gid: 'a' } },
  ];
  const r = filterActionLog(entries, ALL);
  assert.equal(r.length, 2);
});

test('filterActionLog mutates only the cloned collapsed entry, not the input', () => {
  const original: ActionLogEntry[] = [
    { action: 'poll', detail: { gid: 'g' }, timestamp: 1 },
    { action: 'poll', detail: { gid: 'g' }, timestamp: 2 },
  ];
  filterActionLog(original, ALL);
  assert.equal(original[0]!._pollCount, undefined);
  assert.equal(original[0]!.timestamp, 1);
});

// ---------- filterActionLog: axis filters ----------

test('filterActionLog actionFilter rejects non-matching actions', () => {
  const r = filterActionLog(sample, { ...ALL, actionFilter: 'add' });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.action, 'add');
});

test('filterActionLog targetFilter rejects non-matching targets', () => {
  const r = filterActionLog(sample, { ...ALL, targetFilter: 'aria2' });
  assert.equal(r.length, 2); // 3 polls → collapsed into 2
});

test('filterActionLog sessionFilter=current with currentSessionId keeps matching session only', () => {
  const r = filterActionLog(sample, {
    ...ALL,
    sessionFilter: 'current',
    currentSessionId: 's1',
  });
  assert.deepEqual(
    r.map((e) => e.session_id),
    ['s1', 's1', 's1'],
  );
});

test('filterActionLog sessionFilter=current with no currentSessionId returns nothing', () => {
  const r = filterActionLog(sample, {
    ...ALL,
    sessionFilter: 'current',
    currentSessionId: null,
  });
  assert.equal(r.length, 0);
});

test('filterActionLog treats unknown sessionFilter values as pass-through', () => {
  const r = filterActionLog(sample, { ...ALL, sessionFilter: 'whatever' });
  assert.equal(r.length, 4); // identical to ALL
});

test('filterActionLog stacks all three axis filters', () => {
  const r = filterActionLog(sample, {
    actionFilter: 'poll',
    targetFilter: 'aria2',
    sessionFilter: 'current',
    currentSessionId: 's1',
  });
  assert.equal(r.length, 2);
  for (const e of r) {
    assert.equal(e.action, 'poll');
    assert.equal(e.target, 'aria2');
    assert.equal(e.session_id, 's1');
  }
});

test('filterActionLog treats missing action/target as "unknown"', () => {
  const entries: ActionLogEntry[] = [{ session_id: 's1' }];
  const r1 = filterActionLog(entries, { ...ALL, actionFilter: 'unknown' });
  const r2 = filterActionLog(entries, { ...ALL, targetFilter: 'unknown' });
  assert.equal(r1.length, 1);
  assert.equal(r2.length, 1);
});

// ---------- distinctActions / distinctTargets ----------

test('distinctActions returns sorted unique actions, mapping missing → "unknown"', () => {
  assert.deepEqual(distinctActions(sample), ['add', 'poll', 'remove']);
  assert.deepEqual(distinctActions([{ target: 't' }, { action: 'add' }]), ['add', 'unknown']);
});

test('distinctTargets returns sorted unique targets', () => {
  assert.deepEqual(distinctTargets(sample), ['aria2', 'queue']);
});
