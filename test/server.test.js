import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, StartupError } from '../server.js';
import { encodeWav } from '../lib/wav.js';
import { defaultConfig } from '../lib/parser.js';

const FAKE_KEY = 'gn_test_SECRET_1234567890abcdef';

function tone(seconds = 1, sr = 16000, amp = 0.3) {
  const n = Math.round(seconds * sr);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin((2 * Math.PI * 220 * i) / sr);
  return encodeWav(s, sr);
}

/** Start the app on an ephemeral port with a scripted upstream. Returns {url, close, logs, upstreamCalls}. */
async function boot({ upstream, env = {}, config = defaultConfig, nowFn } = {}) {
  const logs = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return upstream(url, init, calls.length);
  };
  const app = createApp({
    config,
    env: { GNANI_API_KEY: FAKE_KEY, ...env },
    fetchImpl,
    log: (o) => logs.push(o),
    ...(nowFn ? { now: nowFn } : {})
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  return { url, logs, calls, app, close: () => new Promise((r) => app.server.close(r)) };
}

const okJson = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
const post = (url, body, headers = { 'Content-Type': 'audio/wav' }) => fetch(url, { method: 'POST', body, headers });
const fastCfg = { ...defaultConfig, retry: { ...defaultConfig.retry, backoffMs: [1, 1] } };

test('startup fails fast and names GNANI_API_KEY when the key is missing', () => {
  assert.throws(() => createApp({ env: {} }), (e) => e instanceof StartupError && /GNANI_API_KEY/.test(e.message));
});

test('POST /api/order returns transcript and a parsed bill', async () => {
  const s = await boot({ upstream: async () => okJson({ success: true, transcript: 'एक किलो चावल और दो पैकेट मैगी' }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.bill.lines.map((l) => `${l.itemId}:${l.qty}:${l.unit}`).join(','), 'chawal:1:kg,maggi:2:packet');
  assert.match(j.request_id, /^[0-9a-f]{8}$/);
  await s.close();
});

test('problem+json shape and codes: BAD_AUDIO (type, size, not wav, too long), EMPTY_AUDIO', async () => {
  const s = await boot({ upstream: async () => okJson({ transcript: 'x' }) });
  let r = await post(`${s.url}/api/order`, tone(), { 'Content-Type': 'text/plain' });
  assert.equal(r.status, 415);
  assert.match(r.headers.get('content-type'), /application\/problem\+json/);
  let j = await r.json();
  assert.equal(j.code, 'BAD_AUDIO');
  for (const k of ['type', 'title', 'status', 'code', 'detail', 'request_id']) assert.ok(k in j, `missing ${k}`);

  r = await post(`${s.url}/api/order`, Buffer.alloc(3 * 1024 * 1024, 1));
  assert.equal(r.status, 413);
  assert.equal((await r.json()).code, 'BAD_AUDIO');

  r = await post(`${s.url}/api/order`, Buffer.from('not a wav file at all, just text, long enough to pass the length check ....'));
  assert.equal(r.status, 400);

  r = await post(`${s.url}/api/order`, tone(31, 8000)); // 31 s at 8 kHz = 0.5 MB, over the 30 s limit
  assert.equal(r.status, 413);
  assert.match((await r.json()).detail, /30 seconds/);

  r = await post(`${s.url}/api/order`, encodeWav(new Float32Array(16000), 16000)); // 1 s of silence
  assert.equal(r.status, 422);
  assert.equal((await r.json()).code, 'EMPTY_AUDIO');
  assert.equal(s.calls.length, 0, 'invalid or silent audio must never reach the upstream');
  await s.close();
});

test('empty transcript from upstream becomes EMPTY_AUDIO', async () => {
  const s = await boot({ upstream: async () => okJson({ success: true, transcript: '   ' }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 422);
  assert.equal((await r.json()).code, 'EMPTY_AUDIO');
  await s.close();
});

test('upstream 5xx is retried twice with backoff, then UPSTREAM_ERROR 502', async () => {
  const s = await boot({ config: fastCfg, upstream: async () => new Response('boom', { status: 503 }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, 'UPSTREAM_ERROR');
  assert.equal(s.calls.length, 3, '1 try + 2 retries');
  await s.close();
});

test('upstream 429 is retried; success on the second try returns 200', async () => {
  const s = await boot({
    config: fastCfg,
    upstream: async (_u, _i, n) => (n === 1 ? new Response('slow down', { status: 429 }) : okJson({ transcript: 'ek kilo chawal' }))
  });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 200);
  assert.equal(s.calls.length, 2);
  await s.close();
});

test('upstream 400 is not retried', async () => {
  const s = await boot({ config: fastCfg, upstream: async () => new Response('bad', { status: 400 }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 502);
  assert.equal(s.calls.length, 1);
  await s.close();
});

test('upstream 401 maps to SERVER_MISCONFIGURED 500 without retry', async () => {
  const s = await boot({ config: fastCfg, upstream: async () => new Response('nope', { status: 401 }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 500);
  assert.equal((await r.json()).code, 'SERVER_MISCONFIGURED');
  assert.equal(s.calls.length, 1);
  await s.close();
});

test('malformed upstream JSON and missing transcript field are UPSTREAM_ERROR', async () => {
  let s = await boot({ config: fastCfg, upstream: async () => new Response('<html>', { status: 200 }) });
  let r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 502);
  await s.close();
  s = await boot({ config: fastCfg, upstream: async () => okJson({ success: true }) });
  r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 502);
  await s.close();
});

test('huge and Devanagari-only upstream transcripts do not crash the parser', async () => {
  const s = await boot({ upstream: async () => okJson({ transcript: 'चावल '.repeat(20000) }) });
  const r = await post(`${s.url}/api/order`, tone());
  assert.equal(r.status, 200);
  await s.close();
});

test('per-IP rate limit: call N+1 in a minute is refused with 429 and Retry-After', async () => {
  const s = await boot({ env: { RATE_LIMIT_PER_MIN: '30' }, upstream: async () => okJson({ transcript: 'ek kilo chawal' }) });
  let last;
  for (let i = 0; i < 31; i++) last = await post(`${s.url}/api/order`, tone(0.5));
  assert.equal(last.status, 429);
  const j = await last.json();
  assert.equal(j.code, 'RATE_LIMITED');
  assert.ok(Number(last.headers.get('retry-after')) >= 1);
  assert.equal(s.calls.length, 30, 'the refused call never reached the upstream');
  await s.close();
});

test('a spoofed X-Forwarded-For does not bypass the limit unless a trusted header is configured', async () => {
  const s = await boot({ env: { RATE_LIMIT_PER_MIN: '3' }, upstream: async () => okJson({ transcript: 'ek kilo chawal' }) });
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await post(`${s.url}/api/order`, tone(0.5), { 'Content-Type': 'audio/wav', 'X-Forwarded-For': `9.9.9.${i}` });
    codes.push(r.status);
  }
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  await s.close();
});

test('trusted header: the rightmost entry is used, earlier (client-controlled) entries are ignored', async () => {
  const s = await boot({ env: { RATE_LIMIT_PER_MIN: '2', TRUSTED_IP_HEADER: 'x-forwarded-for' }, upstream: async () => okJson({ transcript: 'ek kilo chawal' }) });
  const codes = [];
  for (let i = 0; i < 4; i++) {
    const r = await post(`${s.url}/api/order`, tone(0.5), { 'Content-Type': 'audio/wav', 'X-Forwarded-For': `1.2.3.${i}, 203.0.113.7` });
    codes.push(r.status);
  }
  assert.deepEqual(codes, [200, 200, 429, 429]);
  await s.close();
});

test('global daily cap refuses before the upstream call and resets the next IST day', async () => {
  let t = Date.parse('2026-11-08T10:00:00Z');
  const s = await boot({ env: { DAILY_CAP: '2', RATE_LIMIT_PER_MIN: '100' }, nowFn: () => t, upstream: async () => okJson({ transcript: 'ek kilo chawal' }) });
  assert.equal((await post(`${s.url}/api/order`, tone(0.5))).status, 200);
  assert.equal((await post(`${s.url}/api/order`, tone(0.5))).status, 200);
  const r = await post(`${s.url}/api/order`, tone(0.5));
  assert.equal(r.status, 429);
  assert.equal((await r.json()).code, 'DAILY_CAP');
  assert.equal(s.calls.length, 2);
  t += 24 * 3600 * 1000; // next day
  assert.equal((await post(`${s.url}/api/order`, tone(0.5))).status, 200);
  await s.close();
});

test('DEMO_DISABLED=1 refuses API routes without a key and without upstream calls', async () => {
  const logs = [];
  const app = createApp({ env: { DEMO_DISABLED: '1' }, fetchImpl: async () => { throw new Error('should not call'); }, log: (o) => logs.push(o) });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const r = await post(`http://127.0.0.1:${app.server.address().port}/api/order`, tone());
  assert.equal(r.status, 503);
  await new Promise((r2) => app.server.close(r2));
});

test('the API key never appears in any response body or log line, including error paths', async () => {
  const seen = [];
  const s = await boot({
    config: fastCfg,
    upstream: async (_u, init, n) => {
      seen.push(JSON.stringify(init?.headers || {}));
      return n % 2 ? new Response(`upstream echoed ${FAKE_KEY}`, { status: 500 }) : okJson({ transcript: 'ek kilo chawal' });
    }
  });
  const bodies = [];
  for (let i = 0; i < 4; i++) bodies.push(await (await post(`${s.url}/api/order`, tone(0.5))).text());
  bodies.push(await (await fetch(`${s.url}/api/health`)).text());
  bodies.push(await (await post(`${s.url}/api/order`, tone(), { 'Content-Type': 'text/plain' })).text());
  for (const b of bodies) assert.ok(!b.includes(FAKE_KEY), 'key leaked in a response');
  assert.ok(!JSON.stringify(s.logs).includes(FAKE_KEY), 'key leaked in logs');
  assert.ok(seen.some((h) => h.includes(FAKE_KEY)), 'sanity: the key IS sent upstream in the header');
  await s.close();
});

test('logs contain no transcripts', async () => {
  const s = await boot({ upstream: async () => okJson({ transcript: 'ek kilo chawal SECRETWORD' }) });
  await post(`${s.url}/api/order`, tone());
  assert.ok(!JSON.stringify(s.logs).includes('SECRETWORD'));
  await s.close();
});

test('the repository contains no key-shaped secrets and .env is git-ignored', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.match(readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.env$/m);
  const skip = new Set(['node_modules', '.git', '.gstack', 'data']);
  const hits = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|json|md|html|example)$/.test(name) || name === '.env.example') {
        const txt = readFileSync(p, 'utf8');
        if (/GNANI_API_KEY\s*=\s*\S{12,}/.test(txt) || /X-API-Key-ID['"]?\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/.test(txt)) hits.push(p);
      }
    }
  })(root);
  assert.deepEqual(hits, []);
  // the scanner itself works: it would flag a planted fake key
  assert.ok(/GNANI_API_KEY\s*=\s*\S{12,}/.test('GNANI_API_KEY' + '=abcdefghijklmnop'));
});

test('static page and 404 use the same problem shape', async () => {
  const s = await boot({ upstream: async () => okJson({ transcript: 'x' }) });
  const bad = await fetch(`${s.url}/../server.js`);
  assert.equal(bad.status, 404);
  assert.equal((await bad.json()).code, 'NOT_FOUND');
  await s.close();
});
