// FE-27 (mirror of BG-33's negative-snapshot tests in server.test.ts):
// the dashboard must never read legacy /api/status payload keys that the
// backend has dropped. Scans the .ts source files for forbidden patterns.
//
// Forbidden:
//   - top-level `dispatch_paused` (canonical: `state.dispatch_paused`)
//   - `state.paused` (removed by BG-33)
//   - `summary.stopped` (removed by BG-33; canonical: `summary.removed`)
//   - any `'filtered'` key on the status payload (BG-35 dropped it)
//
// Allowed: `state.dispatch_paused`, `summary.removed`, `state.dispatch_paused ?? <fallback>`
// where the fallback is itself canonical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function readSources(): Array<{ name: string; text: string }> {
  return readdirSync(here)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => ({ name: f, text: readFileSync(join(here, f), 'utf8') }));
}

test('FE-27: no top-level data.dispatch_paused reads (canonical: state.dispatch_paused)', () => {
  const offenders: string[] = [];
  for (const { name, text } of readSources()) {
    // Top-level pattern: an identifier followed by .dispatch_paused that
    // is NOT preceded by ".state" / ".lastStatus.state" etc. We allow
    // `state.dispatch_paused` and `state?.dispatch_paused`.
    const re = /\b([A-Za-z_][A-Za-z0-9_]*)\??\.(dispatch_paused)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const ident = m[1];
      if (ident !== 'state') {
        // Examine ~30 chars of context for human-readable reporting.
        const ctx = text.slice(Math.max(0, m.index - 20), m.index + 30).replace(/\n/g, ' ');
        offenders.push(`${name}: …${ctx}…`);
      }
    }
  }
  assert.equal(offenders.length, 0, `top-level dispatch_paused reads found:\n  ${offenders.join('\n  ')}`);
});

test('FE-27: no state.paused reads (BG-33 removed; canonical: state.dispatch_paused)', () => {
  const offenders: string[] = [];
  for (const { name, text } of readSources()) {
    // `state.paused` or `state?.paused` (but not `dispatch_paused`).
    const re = /\bstate\??\.paused\b/g;
    if (re.test(text)) offenders.push(name);
  }
  assert.equal(offenders.length, 0, `legacy state.paused reads found in: ${offenders.join(', ')}`);
});

test('FE-27: no summary.stopped reads (BG-33 removed; canonical: summary.removed)', () => {
  const offenders: string[] = [];
  for (const { name, text } of readSources()) {
    const re = /\bsummary\??\.stopped\b/g;
    if (re.test(text)) offenders.push(name);
  }
  assert.equal(offenders.length, 0, `legacy summary.stopped reads found in: ${offenders.join(', ')}`);
});

test('FE-27: no filtered key reads on /api/status payload (BG-35 dropped)', () => {
  const offenders: string[] = [];
  for (const { name, text } of readSources()) {
    // `lastStatus?.filtered`, `data.filtered`, `status.filtered`, etc.
    // The narrow pattern targets identifiers that look like a status
    // payload variable accessing `.filtered`.
    const re = /\b(lastStatus|status|data)\??\.filtered\b/g;
    if (re.test(text)) offenders.push(name);
  }
  assert.equal(offenders.length, 0, `legacy .filtered reads found in: ${offenders.join(', ')}`);
});
