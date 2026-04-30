import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apiFetch, joinUrl, getJson, postJson, postEmpty, ApiError } from './api.js';

test('apiFetch resolves with the fetch response', async () => {
  const fakeResponse = { ok: true, status: 200 } as Response;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return fakeResponse;
  };
  const r = await apiFetch('/api/status');
  assert.equal(r, fakeResponse);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/api/status');
  assert.ok(calls[0]!.init?.signal instanceof AbortSignal);
});

test('apiFetch aborts when the timeout elapses', async () => {
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  await assert.rejects(apiFetch('/slow', { timeoutMs: 10 }), /aborted/);
});

test('apiFetch forwards method, headers, body', async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = init;
    return { ok: true } as Response;
  };
  await apiFetch('/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"a":1}',
  });
  assert.equal(captured?.method, 'POST');
  assert.deepEqual(captured?.headers, { 'Content-Type': 'application/json' });
  assert.equal(captured?.body, '{"a":1}');
});

test('joinUrl strips trailing slashes from base', () => {
  assert.equal(joinUrl('http://h:8000', '/api/x'), 'http://h:8000/api/x');
  assert.equal(joinUrl('http://h:8000/', '/api/x'), 'http://h:8000/api/x');
  assert.equal(joinUrl('http://h:8000///', '/api/x'), 'http://h:8000/api/x');
});

test('getJson resolves with parsed body on 2xx', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, n: 42 }), { status: 200 });
  const body = await getJson<{ ok: boolean; n: number }>('/api/x');
  assert.equal(body.ok, true);
  assert.equal(body.n, 42);
});

test('getJson throws ApiError with status on non-2xx', async () => {
  globalThis.fetch = async () => new Response('boom', { status: 503 });
  await assert.rejects(getJson('/api/x'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal((err as ApiError).status, 503);
    assert.equal((err as ApiError).url, '/api/x');
    return true;
  });
});

test('postJson sends JSON body with default Content-Type', async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const r = await postJson<{ ok: boolean }>('/api/x', { a: 1 });
  assert.equal(r.ok, true);
  assert.equal(captured?.method, 'POST');
  assert.equal(captured?.body, '{"a":1}');
  const headers = new Headers(captured?.headers);
  assert.equal(headers.get('Content-Type'), 'application/json');
});

test('postJson preserves a caller-supplied Content-Type', async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = init;
    return new Response('{}', { status: 200 });
  };
  await postJson('/api/x', { a: 1 }, { headers: { 'Content-Type': 'application/x-foo' } });
  const headers = new Headers(captured?.headers);
  assert.equal(headers.get('Content-Type'), 'application/x-foo');
});

test('postJson throws ApiError on non-2xx', async () => {
  globalThis.fetch = async () => new Response('boom', { status: 422 });
  await assert.rejects(postJson('/api/x', {}), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal((err as ApiError).status, 422);
    return true;
  });
});

test('postEmpty issues POST with no body and returns raw Response', async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = init;
    return new Response('{}', { status: 503 });
  };
  const r = await postEmpty('/api/scheduler/pause');
  assert.equal(captured?.method, 'POST');
  assert.equal(captured?.body, undefined);
  // postEmpty does NOT throw on non-2xx — caller inspects response.
  assert.equal(r.status, 503);
});
