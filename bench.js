#!/usr/bin/env node
// Noise benchmark runner. Calls the Gnani API DIRECTLY (never through the public proxy).
//
//   npm run bench -- --source tts --levels clean,10,0 --model prisma-v2.5 --seed 42 --out results.json --resume
//   npm run bench -- --source dir                      # use your own recordings in data/clean/<id>.wav
//   npm run bench:mock                                 # plumbing check, no key, no credits, NOT model performance
//
// Exit code is non-zero when any clip failed, so a partial run cannot be mistaken for a complete one.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseOrder } from './lib/parser.js';
import { transcribe, synthesize } from './lib/gnani.js';
import { parseWav, encodeWav, resample } from './lib/wav.js';
import { generateBed, loadBedFile, mixAtSnr, telephony, hasFfmpeg, FFMPEG_HINT } from './lib/noise.js';
import { scoreOrder, aggregate, bootstrapCI, wer, sttAttributableMisses, mulberry32 } from './lib/score.js';
import { loadEnv } from './lib/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { a._.push(t); continue; }
    const k = t.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[k] = true;
    else { a[k] = next; i++; }
  }
  return a;
}

function usage() {
  console.log(`Usage: node bench.js [options]
  --source tts|dir      where clean clips come from (default tts: Gnani Timbre voice; dir: your recordings in data/clean/<id>.wav)
  --levels clean,10,0   noise levels: "clean" or SNR in dB (default from config.json: ${defaultConfig.bench.levels.join(',')})
  --model <id>          prisma-v2.5 | prisma-v3.0 (default from config / PRISMA_MODEL)
  --seed <n>            noise seed (default ${defaultConfig.bench.seed})
  --bed street|shop|<wav>  noise bed; built-ins are SYNTHETIC (default street)
  --out <file>          results file (default results.json); a .md summary is written next to it
  --resume              skip clips already recorded as ok in --out; retry the failed ones
  --mixed-dir <dir>     folder where the exact audio sent is saved (default data/mixed)
  --clean-dir <dir>     folder for clean clips (default data/clean)
  --only-level <L>      run just one level
  --rescore             re-parse the transcripts already stored in --out with the current parser and recompute every score (no API calls, no credits)
  --orders o05,o12      only these order ids (for a small set of your own recordings)
  --limit <n>           only the first n orders (use for a cheap pilot)
  --dry-run             build every clip, call no API, print the audio and credit plan
  --mock                echo STT + synthetic clean clips: plumbing check only, results are labelled MOCK
  --help`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { usage(); process.exit(0); }

const env = loadEnv();
const config = defaultConfig;
let model = args.model || env.PRISMA_MODEL || config.model;
let seed = Number(args.seed ?? config.bench.seed);
const outFile = path.resolve(args.out || 'results.json');
let mock = !!args.mock;
const dry = !!args['dry-run'];
let source = mock ? 'synthetic' : (args.source || 'tts');
let levelsArg = String(args['only-level'] ?? args.levels ?? config.bench.levels.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
let bedName = String(args.bed || 'street');
const allOrders = JSON.parse(readFileSync(path.join(here, 'data/orders.json'), 'utf8')).orders;
const only = args.orders ? new Set(String(args.orders).split(',').map((s) => s.trim())) : null;
const orders = allOrders.filter((o) => !only || only.has(o.id)).slice(0, Number(args.limit) || allOrders.length);

if (args.rescore) {
  if (!existsSync(outFile)) { console.error(`--rescore needs an existing results file: ${outFile}`); process.exit(2); }
  const prev = JSON.parse(readFileSync(outFile, 'utf8'));
  ({ model, source, seed } = prev.config);
  bedName = prev.config.bed; mock = !!prev.mock; levelsArg = prev.config.levels;
}
for (const l of levelsArg) if (l !== 'clean' && !Number.isFinite(Number(l))) { console.error(`Bad level "${l}". Use "clean" or a number of dB.`); process.exit(2); }
if (!args.rescore && levelsArg.some((l) => l !== 'clean') && !hasFfmpeg()) { console.error(FFMPEG_HINT); process.exit(2); }
if (!mock && !dry && !args.rescore && !env.GNANI_API_KEY) {
  console.error('GNANI_API_KEY is not set. Get a key at https://app.gnani.ai/voice and put it in .env (see .env.example).\nTip: `npm run bench:mock` runs the whole pipeline without a key; `--dry-run` builds the clips and prints the credit plan.');
  process.exit(2);
}

const dirs = { clean: path.resolve(args['clean-dir'] || path.join(here, 'data/clean')), mixed: path.resolve(args['mixed-dir'] || path.join(here, 'data/mixed')) };
mkdirSync(dirs.clean, { recursive: true });

// ---- clean clips ----
function syntheticClean(id) {
  // speech-like placeholder for the mock run only: voiced bursts at a per-order pitch
  const rnd = mulberry32([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const sr = config.bench.cleanSampleRate;
  const n = sr * 3;
  const f0 = 110 + rnd() * 100;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const on = Math.sin(2 * Math.PI * (2 + rnd() * 0.001) * t) > -0.2 ? 1 : 0;
    s[i] = on * 0.3 * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f0 * 3 * t) + 0.25 * Math.sin(2 * Math.PI * f0 * 5 * t)) * 0.6;
  }
  return s;
}

async function loadClean(order) {
  const file = path.join(dirs.clean, `${order.id}.wav`);
  const sr = config.bench.cleanSampleRate;
  if (source === 'synthetic') return syntheticClean(order.id);
  if (!existsSync(file)) {
    if (source === 'dir') throw new Error(`Missing ${path.relative(here, file)}. Record the order "${order.text}" (or run with --source tts).`);
    if (dry) return null;
    const tts = await synthesize({ text: order.say, apiKey: env.GNANI_API_KEY, config });
    const { samples, sampleRate } = parseWav(tts);
    writeFileSync(file, encodeWav(resample(samples, sampleRate, sr), sr));
  }
  if (!existsSync(file)) return null;
  const { samples, sampleRate } = parseWav(readFileSync(file));
  return resample(samples, sampleRate, sr);
}

// ---- results file (atomic writes) ----
function loadPrev() {
  if ((!args.resume && !args.rescore) || !existsSync(outFile)) return [];
  try { return JSON.parse(readFileSync(outFile, 'utf8')).rows || []; } catch { return []; }
}
function atomicWrite(file, text) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text);
  // Windows can briefly lock the destination (antivirus, indexer, an open editor): retry, then fall back to a direct write
  for (let i = 0; i < 6; i++) {
    try { renameSync(tmp, file); return; } catch (e) {
      if (![EPERM, EBUSY, EACCES].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
    }
  }
  writeFileSync(file, text);
  try { unlinkSync(tmp); } catch {}
}

const rows = loadPrev().filter((r) => r.model === model && r.source === source);
const rowKey = (level, id) => `${level}|${id}`;
const done = new Map(rows.filter((r) => r.status === 'ok').map((r) => [rowKey(r.level, r.order_id), r]));

function summarize() {
  const out = {};
  for (const level of levelsArg) {
    const lv = rows.filter((r) => r.level === level);
    const ok = lv.filter((r) => r.status === 'ok');
    const scores = ok.map((r) => ({ tp: r.tp, fp: r.fp, fn: r.fn }));
    const agg = aggregate(scores);
    const ci = bootstrapCI(scores, { seed });
    const wers = ok.map((r) => r.wer).filter((w) => w !== null && w !== undefined);
    out[level] = {
      n_orders: ok.length,
      n_failed: lv.length - ok.length,
      items_expected: agg.tp + agg.fn,
      tp: agg.tp, fp: agg.fp, fn: agg.fn,
      precision: round(agg.precision), recall: round(agg.recall), f1: round(agg.f1),
      f1_ci95: ci.map(round),
      stt_attributable_misses: ok.reduce((s, r) => s + r.stt_misses, 0),
      wer_mean: wers.length ? round(wers.reduce((a, b) => a + b, 0) / wers.length) : null,
      wer_n: wers.length,
      sample_rate: lv[0]?.sample_rate ?? null
    };
  }
  return out;
}
const round = (x) => Math.round(x * 1000) / 1000;

function gallery() {
  const bad = rows.filter((r) => r.status === 'ok' && r.fp + r.fn > 0).sort((a, b) => b.fp + b.fn - (a.fp + a.fn));
  const seen = new Set();
  const picks = [];
  for (const r of bad) { if (!seen.has(r.order_id)) { seen.add(r.order_id); picks.push(r); } if (picks.length === 3) break; }
  return picks.map((r) => ({ order_id: r.order_id, level: r.level, said: r.said, transcript: r.transcript, expected: r.expected, got: r.got }));
}

function save() {
  const summary = summarize();
  const doc = {
    benchmark_version: config.bench.benchmarkVersion,
    created: new Date().toISOString(),
    mock,
    labels: mock ? ['MOCK: echo STT and synthetic clips. This file tests the plumbing and says nothing about Gnani model quality.'] : ['Noise levels are SIMULATED: synthetic or recorded speech + seeded noise bed + 8 kHz G.711 telephony chain. Not real phone calls.'],
    config: { model, language: config.language, source, seed, bed: bedName, levels: levelsArg, parser: config.parser },
    summary,
    gallery: gallery(),
    rows
  };
  atomicWrite(outFile, JSON.stringify(doc, null, 2));
  atomicWrite(outFile.replace(/\.json$/, '') + '.md', markdown(doc));
  return doc;
}

function markdown(doc) {
  const L = [];
  L.push(`# Benchmark results (${doc.mock ? 'MOCK - plumbing only' : 'SIMULATED noise'})`, '');
  L.push(...doc.labels.map((x) => `> ${x}`), '');
  L.push(`Model: \`${doc.config.model}\`, language: \`${doc.config.language}\`, clips from: \`${doc.config.source}\`, seed: ${doc.config.seed}, bed: ${doc.config.bed}`, '');
  L.push('| Level | n orders | n failed | items | Precision | Recall | Item F1 | F1 95% CI | STT-attributable misses | WER (n) | Sample rate |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const lv of doc.config.levels) {
    const s = doc.summary[lv];
    L.push(`| ${lv === 'clean' ? 'clean (16 kHz, unprocessed)' : `${lv} dB SNR + telephony`} | ${s.n_orders} | ${s.n_failed} | ${s.items_expected} | ${s.precision} | ${s.recall} | **${s.f1}** | ${s.f1_ci95[0]} to ${s.f1_ci95[1]} | ${s.stt_attributable_misses} | ${s.wer_mean ?? 'n/a'} (${s.wer_n}) | ${s.sample_rate ?? '-'} Hz |`);
  }
  L.push('', 'Item F1 counts an item as correct only when item, quantity and unit all match. "Not understood" items count as missed. WER is secondary and shown only where reference and transcript use the same script.');
  L.push('', '## Failure gallery', '');
  if (!doc.gallery.length) L.push('No failures in this run.');
  for (const g of doc.gallery) {
    L.push(`- **${g.order_id}** @ ${g.level}: said "${g.said}"`, `  - transcript: ${g.transcript}`, `  - expected: ${g.expected}`, `  - got: ${g.got}`);
  }
  return L.join('\n') + '\n';
}

// ---- rescore: no audio, no API ----
if (args.rescore) {
  const byId = new Map(allOrders.map((o) => [o.id, o]));
  let changed = 0;
  for (const r of rows) {
    if (r.status !== 'ok') continue;
    const o = byId.get(r.order_id);
    const parsed = parseOrder(r.transcript.slice(0, 2000));
    const s = scoreOrder(o.expected, parsed.lines);
    const got = parsed.lines.length ? parsed.lines.map((l) => `${l.itemId} ${l.qty} ${l.unit}`).join(', ') : '(nothing understood)';
    if (s.tp !== r.tp || s.fp !== r.fp || s.fn !== r.fn) changed++;
    Object.assign(r, { got, parsed: parsed.lines.map((l) => ({ item: l.itemId, qty: l.qty, unit: l.unit, flags: l.flags })), not_understood: parsed.notUnderstood.map((n) => n.text), tp: s.tp, fp: s.fp, fn: s.fn, stt_misses: sttAttributableMisses(o.expected, r.transcript), wer: wer(o.say, r.transcript) });
  }
  const doc = save();
  console.log(markdown(doc));
  console.log(`Rescored ${rows.length} rows with the current parser (${changed} changed). No API calls were made.`);
  process.exit(0);
}

// ---- main ----
const bedLen = 12;
const bed = bedName === 'street' || bedName === 'shop'
  ? generateBed(bedName, bedLen, config.bench.cleanSampleRate, seed)
  : loadBedFile(path.resolve(bedName), config.bench.cleanSampleRate);

const fmtItems = (xs) => xs.map((e) => `${e.item ?? e.itemId} ${e.qty} ${e.unit}`).join(', ');
let failed = 0;
let secondsSent = 0;
const plan = { clips: orders.length * levelsArg.length };
console.log(`Kirana Bol benchmark: ${orders.length} orders x ${levelsArg.length} levels (${levelsArg.join(', ')}) = ${plan.clips} clips, model ${model}, source ${source}${mock ? ' [MOCK]' : ''}${dry ? ' [DRY RUN]' : ''}`);

for (const level of levelsArg) {
  for (const order of orders) {
    if (done.has(rowKey(level, order.id))) continue;
    const base = { order_id: order.id, level, model, source, said: order.text };
    try {
      const clean = await loadClean(order);
      if (!clean) { if (dry) { secondsSent += 4; continue; } throw new Error('no clean clip available'); }
      let wav, sampleRate, snr = null;
      if (level === 'clean') {
        sampleRate = config.bench.cleanSampleRate;
        wav = encodeWav(clean, sampleRate);
      } else {
        const m = mixAtSnr(clean, bed, config.bench.cleanSampleRate, Number(level));
        snr = Math.round(m.measuredSnr * 100) / 100;
        wav = telephony(encodeWav(m.mixed, config.bench.cleanSampleRate), config.bench.telephonySampleRate);
        sampleRate = config.bench.telephonySampleRate;
        const d = path.join(dirs.mixed, `snr${level}`);
        mkdirSync(d, { recursive: true });
        writeFileSync(path.join(d, `${order.id}.wav`), wav);
      }
      secondsSent += parseWav(wav).durationSec;
      if (dry) continue;
      const transcript = mock ? order.say : (await transcribe({ wav, apiKey: env.GNANI_API_KEY, config, model })).transcript;
      const parsed = parseOrder(transcript.slice(0, 2000));
      const s = scoreOrder(order.expected, parsed.lines);
      rows.push({
        ...base, status: 'ok', sample_rate: sampleRate, snr_measured: snr, transcript,
        expected: fmtItems(order.expected), got: parsed.lines.length ? fmtItems(parsed.lines) : '(nothing understood)',
        parsed: parsed.lines.map((l) => ({ item: l.itemId, qty: l.qty, unit: l.unit, flags: l.flags })),
        not_understood: parsed.notUnderstood.map((n) => n.text),
        tp: s.tp, fp: s.fp, fn: s.fn, stt_misses: sttAttributableMisses(order.expected, transcript), wer: wer(order.say, transcript)
      });
      process.stdout.write('.');
    } catch (err) {
      failed++;
      rows.push({ ...base, status: 'failed', sample_rate: null, error: { code: err.code || 'ERROR', message: String(err.message).slice(0, 200) } });
      process.stdout.write('x');
    }
    if (!dry) save();
  }
}
console.log('');

if (dry) {
  console.log(`Dry run: ${plan.clips} clips, about ${(secondsSent / 60).toFixed(1)} minutes of audio would be sent (clips not yet generated are estimated at 4 s each). Multiply by your per-minute price (dashboard) and add a 25% reserve before a real run.`);
  process.exit(0);
}
const doc = save();
console.log(markdown(doc));
console.log(`Wrote ${path.relative(process.cwd(), outFile)} and ${path.relative(process.cwd(), outFile.replace(/\.json$/, '') + '.md')}. Audio sent: about ${(secondsSent / 60).toFixed(1)} minutes.`);
if (failed) { console.error(`${failed} clip(s) failed. Re-run with --resume to retry only those.`); process.exit(1); }
