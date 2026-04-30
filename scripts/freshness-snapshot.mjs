#!/usr/bin/env node
// FE-24 step 8: build-time snapshot of the freshness map.
//
// Hits a running backend's /api/_meta and writes
// docs/FRESHNESS_SNAPSHOT.md. Generated artifact — never hand-edit.
//
// Usage:
//   BACKEND=http://localhost:9001 npm run freshness:snapshot
//   (defaults to http://127.0.0.1:9001)

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = process.env.BACKEND ?? 'http://127.0.0.1:9001';
const url = `${backend.replace(/\/+$/, '')}/api/_meta`;

let res;
try {
  res = await fetch(url);
} catch (e) {
  console.error(`fetch ${url} failed: ${e.message}`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const body = await res.json();
const endpoints = Array.isArray(body?.endpoints) ? body.endpoints : [];
if (endpoints.length === 0) {
  console.error(`no endpoints returned by ${url}`);
  process.exit(1);
}

endpoints.sort((a, b) => {
  const fa = String(a.freshness ?? '');
  const fb = String(b.freshness ?? '');
  if (fa !== fb) return fa.localeCompare(fb);
  return `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`);
});

const lines = [];
lines.push('# Freshness snapshot');
lines.push('');
lines.push(`Generated from \`${url}\` at ${new Date().toISOString()}.`);
lines.push('Do not edit by hand — run `npm run freshness:snapshot` to refresh.');
lines.push('');
lines.push('| Class | Method | Path | TTL (s) | Transport | Topics | Revalidate on |');
lines.push('|---|---|---|---|---|---|---|');
for (const e of endpoints) {
  const topics = Array.isArray(e.transport_topics) ? e.transport_topics.join(', ') : '';
  const revalidate = Array.isArray(e.revalidate_on) ? e.revalidate_on.join('<br>') : '';
  lines.push(
    `| ${e.freshness ?? ''} | ${e.method ?? ''} | \`${e.path ?? ''}\` | ${e.ttl_s ?? ''} | ${e.transport ?? ''} | ${topics} | ${revalidate} |`,
  );
}
lines.push('');

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'docs', 'FRESHNESS_SNAPSHOT.md');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`wrote ${out} (${endpoints.length} endpoints)`);
