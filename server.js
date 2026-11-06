// Kirana Bol server: one always-on Node process (static page + proxy routes).
// The rate limiter and daily cap are in-memory, which is why this must run as a single process
// (not serverless). The Gnani API key only ever lives in this process.
import http from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultConfig, parseOrder } from './lib/parser.js';
import { transcribe, synthesize, GnaniError } from './lib/gnani.js';
import { peekWav, parseWav, rms } from './lib/wav.js';
import { loadDotEnv } from './lib/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export class StartupError extends Error {}

const istDay = (ms) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** Build the app. Dependencies (fetch, clock, logger, env) are injectable so tests never touch the network. */
export function createApp({ config = defaultConfig, env = process.env, fetchImpl = fetch, now = () => Date.now(), log = (o) => console.log(JSON.stringify(o)) } = {}) {
  const apiKey = env.GNANI_API_KEY || '';
  const demoDisabled = env.DEMO_DISABLED === '1';
  if (!apiKey && !demoDisabled) {
    throw new StartupError('GNANI_API_KEY is not set. Get a key at https://app.gnani.ai/voice, copy .env.example to .env and set GNANI_API_KEY. (Set DEMO_DISABLED=1 to run without a key.)');
  }
  const cfg = {
    ...config,
    model: env.PRISMA_MODEL || config.model,
    limits: {
      ...config.limits,
      perMinute: Number(env.RATE_LIMIT_PER_MIN) || config.limits.perMinute,
      dailyCap: Number(env.DAILY_CAP) || config.limits.dailyCap
    }
  };
  const trustedHeader = (env.TRUSTED_IP_HEADER || '').toLowerCase();
  const hits = new Map(); // ip -> [timestamps]
  const daily = { day: istDay(now()), count: 0 };

  function clientIp(req) {
    if (trustedHeader && req.headers[trustedHeader]) {
      const parts = String(req.headers[trustedHeader]).split(',').map((s) => s.trim()).filter(Boolean);
      // rightmost entry: the one our trusted proxy appended; earlier entries are client-controlled
      if (parts.length) return parts[parts.length - 1];
    }
    return req.socket.remoteAddress || 'unknown';
  }

  function problem(res, rid, status, code, title, detail, extra = {}) {
    const body = JSON.stringify({ type: 'about:blank', title, status, code, detail, request_id: rid });
    res.writeHead(status, { 'Content-Type': 'application/problem+json', 'Content-Length': Buffer.byteLength(body), ...extra });
    res.end(body);
    return { status, code };
  }

  function json(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }

  async function readBody(req, maxBytes) {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) { req.resume(); return { tooLarge: true }; }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) { req.destroy(); return { tooLarge: true }; }
      chunks.push(chunk);
    }
    return { body: Buffer.concat(chunks) };
  }

  /** Per-IP limiter and global daily cap, both checked BEFORE any upstream call. */
  function admit(ip, res, rid) {
    const t = now();
    const arr = (hits.get(ip) || []).filter((x) => t - x < 60000);
    if (arr.length >= cfg.limits.perMinute) {
      const retry = Math.max(1, Math.ceil((60000 - (t - arr[0])) / 1000));
      hits.set(ip, arr);
      return problem(res, rid, 429, 'RATE_LIMITED', 'Too many requests', `Limit is ${cfg.limits.perMinute} calls per minute per client. Retry in ${retry} seconds.`, { 'Retry-After': String(retry) });
    }
    const day = istDay(t);
    if (daily.day !== day) { daily.day = day; daily.count = 0; }
    if (daily.count >= cfg.limits.dailyCap) {
      return problem(res, rid, 429, 'DAILY_CAP', 'Demo quota reached', 'The public demo has reached its daily call limit to protect the contest credits. Watch the recorded demo or run it yourself from the repo.', { 'Retry-After': '3600' });
    }
    arr.push(t);
    hits.set(ip, arr);
    daily.count += 1;
    return null;
  }

  function mapUpstream(res, rid, err) {
    if (err instanceof GnaniError) {
      if (err.code === 'SERVER_MISCONFIGURED') return problem(res, rid, 500, 'SERVER_MISCONFIGURED', 'Server misconfigured', 'The server API key was rejected. The operator must check GNANI_API_KEY.');
      return problem(res, rid, 502, 'UPSTREAM_ERROR', 'Speech service error', 'The speech service did not answer correctly. No credits are charged for failed calls that return no transcript. Retry in a few seconds (at most 2 times).', { 'Retry-After': '5' });
    }
    return problem(res, rid, 500, 'SERVER_MISCONFIGURED', 'Unexpected server error', `Unexpected failure. Quote request_id ${rid} when reporting.`);
  }

  async function handleAudioRoute(req, res, rid, kind) {
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'].includes(ct)) {
      return problem(res, rid, 415, 'BAD_AUDIO', 'Unsupported media type', 'Send a 16-bit PCM WAV body with Content-Type audio/wav.');
    }
    const r = await readBody(req, cfg.limits.maxBytes);
    if (r.tooLarge) return problem(res, rid, 413, 'BAD_AUDIO', 'Audio too large', `Maximum upload is ${Math.round(cfg.limits.maxBytes / 1024 / 1024)} MB.`);
    const head = peekWav(r.body);
    if (!head.ok) return problem(res, rid, 400, 'BAD_AUDIO', 'Invalid audio', `Could not read the WAV file: ${head.reason}.`);
    if (head.durationSec > cfg.limits.maxSeconds) return problem(res, rid, 413, 'BAD_AUDIO', 'Audio too long', `Maximum length is ${cfg.limits.maxSeconds} seconds; this clip is ${head.durationSec.toFixed(1)} s.`);
    if (head.durationSec < 0.3) return problem(res, rid, 422, 'EMPTY_AUDIO', 'No speech heard', 'The recording is shorter than 0.3 seconds. Hold the button and speak, then try again.');
    if (rms(parseWav(r.body).samples) < 0.002) return problem(res, rid, 422, 'EMPTY_AUDIO', 'No speech heard', 'The recording is silent. Check the microphone and try again.');
    const blocked = admit(clientIp(req), res, rid);
    if (blocked) return blocked;
    try {
      const { transcript } = await transcribe({ wav: r.body, apiKey, config: cfg, fetchImpl });
      if (!transcript) return problem(res, rid, 422, 'EMPTY_AUDIO', 'No speech heard', 'The speech service returned an empty transcript. Speak closer to the microphone and try again.');
      if (kind === 'transcribe') json(res, 200, { transcript, model: cfg.model, request_id: rid });
      else json(res, 200, { transcript, bill: parseOrder(transcript.slice(0, 2000)), model: cfg.model, request_id: rid });
      return { status: 200 };
    } catch (err) {
      return mapUpstream(res, rid, err);
    }
  }

  async function handleSpeak(req, res, rid) {
    const r = await readBody(req, 4096);
    if (r.tooLarge) return problem(res, rid, 413, 'BAD_AUDIO', 'Text too large', 'Readback text is limited to 300 characters.');
    let text;
    try { text = JSON.parse(r.body.toString('utf8')).text; } catch { text = null; }
    if (typeof text !== 'string' || !text.trim() || text.length > 300) return problem(res, rid, 400, 'BAD_AUDIO', 'Invalid text', 'Send JSON {"text": "..."} with 1 to 300 characters.');
    const blocked = admit(clientIp(req), res, rid);
    if (blocked) return blocked;
    try {
      const wav = await synthesize({ text: text.trim(), apiKey, config: cfg, fetchImpl });
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
      res.end(wav);
      return { status: 200 };
    } catch (err) {
      return mapUpstream(res, rid, err);
    }
  }

  function serveStatic(req, res, rid) {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
      return problem(res, rid, 404, 'NOT_FOUND', 'Not found', 'No such page.');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(res);
    return { status: 200 };
  }

  async function handler(req, res) {
    const rid = randomBytes(4).toString('hex');
    const started = now();
    const url = new URL(req.url, 'http://x');
    let outcome = { status: 500 };
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        json(res, 200, { ok: true, model: cfg.model, demo_enabled: !demoDisabled, daily_remaining: Math.max(0, cfg.limits.dailyCap - (daily.day === istDay(now()) ? daily.count : 0)) });
        outcome = { status: 200 };
      } else if (req.method === 'POST' && ['/api/transcribe', '/api/order', '/api/speak'].includes(url.pathname)) {
        if (demoDisabled) outcome = problem(res, rid, 503, 'SERVER_MISCONFIGURED', 'Demo disabled', 'The operator disabled the API routes (DEMO_DISABLED=1). Watch the recorded demo instead.');
        else if (url.pathname === '/api/speak') outcome = await handleSpeak(req, res, rid);
        else outcome = await handleAudioRoute(req, res, rid, url.pathname === '/api/order' ? 'order' : 'transcribe');
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        outcome = serveStatic(req, res, rid);
      } else {
        outcome = problem(res, rid, 405, 'NOT_FOUND', 'Method not allowed', 'Use GET for pages and POST for /api routes.');
      }
    } catch (err) {
      outcome = problem(res, rid, 500, 'SERVER_MISCONFIGURED', 'Unexpected server error', `Unexpected failure. Quote request_id ${rid} when reporting.`);
    }
    // structured log: no transcripts, no audio, no headers, no key
    log({ ts: new Date(now()).toISOString(), request_id: rid, method: req.method, path: url.pathname, status: outcome?.status, code: outcome?.code, ms: now() - started });
  }

  const server = http.createServer((req, res) => { handler(req, res); });
  return { server, handler, state: { hits, daily }, config: cfg };
}

// Run directly: node server.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = { ...loadDotEnv(), ...process.env };
  try {
    const app = createApp({ env });
    const port = Number(env.PORT) || 3000;
    app.server.listen(port, () => console.log(JSON.stringify({ msg: 'listening', port, model: app.config.model, demo_enabled: env.DEMO_DISABLED !== '1' })));
  } catch (e) {
    if (e instanceof StartupError) { console.error(`Startup failed: ${e.message}`); process.exit(1); }
    throw e;
  }
}
