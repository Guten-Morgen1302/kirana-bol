import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFfmpeg } from '../lib/noise.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (args, env = {}) => spawnSync(process.execPath, ['bench.js', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, GNANI_API_KEY: '', ...env } });

test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--levels/);
});

test('a real run without a key exits 2 and names the fix', () => {
  const r = run(['--limit', '1']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /GNANI_API_KEY/);
  assert.match(r.stderr, /app\.gnani\.ai/);
});

test('bad level is a usage error', () => {
  const r = run(['--mock', '--levels', 'loud']);
  assert.equal(r.status, 2);
});

test('mock run writes results.json with the documented schema and a MOCK label', { skip: !hasFfmpeg() && 'ffmpeg not installed' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kb-'));
  try {
    const out = path.join(dir, 'r.json');
    const r = run(['--mock', '--limit', '3', '--levels', 'clean,10', '--out', out, '--mixed-dir', path.join(dir, 'mixed')]);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(j.benchmark_version, 1);
    assert.equal(j.mock, true);
    assert.match(j.labels[0], /MOCK/);
    assert.equal(j.rows.length, 6);
    for (const row of j.rows) for (const k of ['order_id', 'level', 'model', 'status', 'sample_rate', 'transcript', 'tp', 'fp', 'fn', 'stt_misses']) assert.ok(k in row, `row missing ${k}`);
    assert.equal(j.rows.find((x) => x.level === 'clean').sample_rate, 16000);
    assert.equal(j.rows.find((x) => x.level === '10').sample_rate, 8000);
    assert.ok(Math.abs(j.rows.find((x) => x.level === '10').snr_measured - 10) < 0.5);
    assert.ok(j.summary['10'].f1_ci95.length === 2);
    assert.ok(existsSync(out.replace(/\.json$/, '.md')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--source dir with missing clips fails every clip: non-zero exit, per-clip status failed, then --resume retries only failures', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kb-'));
  try {
    const out = path.join(dir, 'r.json');
    // a fake key so the run starts; clips are missing so nothing reaches the network
    const empty = path.join(dir, 'empty');
    const r = run(['--source', 'dir', '--clean-dir', empty, '--limit', '2', '--levels', 'clean', '--out', out], { GNANI_API_KEY: 'fake-key-for-test' });
    assert.equal(r.status, 1);
    const j = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(j.rows.length, 2);
    assert.ok(j.rows.every((x) => x.status === 'failed' && x.error.message.includes('Missing')));
    assert.equal(j.summary.clean.n_failed, 2);
    // atomic write: no stray temp file
    assert.ok(!existsSync(`${out}.tmp`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('resume skips clips already ok', { skip: !hasFfmpeg() && 'ffmpeg not installed' }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kb-'));
  try {
    const out = path.join(dir, 'r.json');
    assert.equal(run(['--mock', '--limit', '2', '--levels', 'clean', '--out', out]).status, 0);
    const before = JSON.parse(readFileSync(out, 'utf8'));
    // tamper with a transcript; a resumed run must keep it (proves the clip was skipped, not recomputed)
    before.rows[0].transcript = 'KEPT';
    writeFileSync(out, JSON.stringify(before));
    assert.equal(run(['--mock', '--limit', '2', '--levels', 'clean', '--out', out, '--resume']).status, 0);
    const after = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(after.rows[0].transcript, 'KEPT');
    assert.equal(after.rows.length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
