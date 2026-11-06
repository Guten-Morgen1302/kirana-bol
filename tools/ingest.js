#!/usr/bin/env node
// Convert your phone recordings (m4a, mp3, ogg, wav, anything ffmpeg reads) into 16 kHz mono PCM16 WAVs
// named by order id, ready for:  npm run bench -- --source dir --clean-dir data/human --orders ...
//
//   node tools/ingest.js <folder-with-recordings> [--out data/human]
// Each file must start with the order id: o05.m4a, o05_street.mp3, o12-final.wav ...
import { readdirSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = path.resolve(outIdx >= 0 ? args[outIdx + 1] : 'data/human');
const dir = args.find((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
if (!dir || !existsSync(dir)) { console.error('Usage: node tools/ingest.js <folder-with-recordings> [--out data/human]'); process.exit(2); }
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg not found. Windows: winget install Gyan.FFmpeg'); process.exit(2); }

const valid = new Set(JSON.parse(readFileSync(new URL('../data/orders.json', import.meta.url), 'utf8')).orders.map((o) => o.id));
mkdirSync(out, { recursive: true });
let ok = 0, bad = 0;
for (const f of readdirSync(dir)) {
  const m = f.match(/^(o\d{2})(?:[^0-9].*)?\.(\w+)$/i);
  if (!m) continue;
  const id = m[1].toLowerCase();
  if (!valid.has(id)) { console.error(`skip ${f}: ${id} is not one of the 30 orders`); bad++; continue; }
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, f), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', path.join(out, `${id}.wav`)], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`FAILED ${f}: ${(r.stderr || '').trim().slice(0, 150)}`); bad++; } else { console.log(`ok   ${f} -> ${path.relative(process.cwd(), path.join(out, id + '.wav'))}`); ok++; }
}
console.log(`\n${ok} converted, ${bad} skipped/failed. Next:\n  npm run bench -- --source dir --clean-dir ${path.relative(process.cwd(), out) || out} --orders ${[...new Set(readdirSync(out).filter((x) => x.endsWith('.wav')).map((x) => x.slice(0, 3)))].join(',')} --levels clean,10 --model prisma-v3.0 --out results.human.json`);
process.exit(bad ? 1 : 0);
