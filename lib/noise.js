// Noise bed generation, SNR mixing and telephony simulation.
//
// Method (documented in docs/BENCHMARK.md):
//   1. speech level = mean power over 20 ms frames of the CLEAN clip whose RMS is above -40 dBFS
//   2. noise is scaled so that speech power / noise power equals the target SNR
//   3. noise is added BEFORE the telephony chain (8 kHz, 300-3400 Hz band-pass, G.711 mu-law)
// The built-in beds are SYNTHETIC (seeded procedural noise), not recordings. Drop a real bed WAV
// into data/noise/ and pass --bed <file> to use it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mulberry32 } from './score.js';
import { parseWav, resample } from './wav.js';

const FRAME_MS = 20;
const ACTIVE_FLOOR = Math.pow(10, -40 / 20);

/** Mean power of speech-active frames (RMS above -40 dBFS). Falls back to whole-clip power. */
export function speechPower(samples, sampleRate) {
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  let sum = 0;
  let count = 0;
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let e = 0;
    for (let k = 0; k < frame; k++) e += samples[i + k] * samples[i + k];
    const frameRms = Math.sqrt(e / frame);
    if (frameRms > ACTIVE_FLOOR) { sum += e; count += frame; }
  }
  if (count === 0) {
    let e = 0;
    for (const s of samples) e += s * s;
    return e / Math.max(1, samples.length);
  }
  return sum / count;
}

function meanPower(x) {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  return e / Math.max(1, x.length);
}

/** Procedural bed: 'street' (pink-ish rumble, slow swell, horn bursts) or 'shop' (babble-like murmur). */
export function generateBed(kind, seconds, sampleRate, seed = 1) {
  const n = Math.round(seconds * sampleRate);
  const rnd = mulberry32(seed + (kind === 'shop' ? 7919 : 0));
  const out = new Float32Array(n);
  const white = () => rnd() * 2 - 1;
  if (kind === 'shop') {
    const voices = 6;
    for (let v = 0; v < voices; v++) {
      let lp1 = 0, lp2 = 0;
      const rate = 2.5 + rnd() * 3; // syllable rate in Hz
      const phase = rnd() * Math.PI * 2;
      const a = 0.12 + rnd() * 0.25; // low-pass coefficient: formant-ish colouring
      for (let i = 0; i < n; i++) {
        lp1 += a * (white() - lp1);
        lp2 += a * (lp1 - lp2);
        const t = i / sampleRate;
        const env = Math.max(0, Math.sin(2 * Math.PI * rate * t + phase));
        out[i] += lp2 * env * env * 3;
      }
    }
  } else {
    let b0 = 0, b1 = 0, b2 = 0; // Paul Kellet pink-noise filter
    const hornAt = [];
    for (let t = 1 + rnd() * 2; t < seconds; t += 2 + rnd() * 4) hornAt.push(t);
    for (let i = 0; i < n; i++) {
      const w = white();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      const t = i / sampleRate;
      const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.3 * t);
      let s = (b0 + b1 + b2 + w * 0.1848) * 0.2 * swell;
      for (const h of hornAt) {
        const dt = t - h;
        if (dt >= 0 && dt < 0.45) {
          s += 0.25 * Math.exp(-dt * 4) * (Math.sin(2 * Math.PI * 410 * t) + 0.6 * Math.sin(2 * Math.PI * 520 * t));
        }
      }
      out[i] = s;
    }
  }
  return out;
}

/** Loop or crop a bed to the requested length. */
export function fitBed(bed, length) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = bed[i % bed.length];
  return out;
}

/** Load a bed from a WAV file, resampled to the target rate. */
export function loadBedFile(file, sampleRate) {
  const { samples, sampleRate: sr } = parseWav(readFileSync(file));
  return resample(samples, sr, sampleRate);
}

/**
 * Mix noise into speech at a target SNR (dB). Returns {mixed, measuredSnr}.
 * measuredSnr is recomputed from the actual signals, so a test can assert it is within 0.5 dB.
 */
export function mixAtSnr(speech, noise, sampleRate, snrDb) {
  const bed = fitBed(noise, speech.length);
  const ps = speechPower(speech, sampleRate);
  const pn = meanPower(bed);
  const scale = pn > 0 ? Math.sqrt(ps / (pn * Math.pow(10, snrDb / 10))) : 0;
  const mixed = new Float32Array(speech.length);
  let peak = 0;
  for (let i = 0; i < speech.length; i++) {
    mixed[i] = speech[i] + bed[i] * scale;
    peak = Math.max(peak, Math.abs(mixed[i]));
  }
  if (peak > 0.98) for (let i = 0; i < mixed.length; i++) mixed[i] *= 0.98 / peak; // keeps the SNR
  const measuredSnr = 10 * Math.log10(ps / Math.max(1e-20, scale * scale * pn));
  return { mixed, measuredSnr };
}

export function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return r.status === 0;
}

export const FFMPEG_HINT =
  'ffmpeg not found. Install it (Windows: winget install Gyan.FFmpeg | macOS: brew install ffmpeg | Linux: apt install ffmpeg) and re-run.';

/** Telephony chain: 8 kHz mono, 300-3400 Hz band-pass, G.711 mu-law encode/decode. Returns a PCM16 WAV buffer. */
export function telephony(wavBuffer, sampleRate = 8000) {
  if (!hasFfmpeg()) throw new Error(FFMPEG_HINT);
  const dir = mkdtempSync(path.join(tmpdir(), 'kirana-tel-'));
  try {
    const inFile = path.join(dir, 'in.wav');
    const mid = path.join(dir, 'mid.wav');
    const out = path.join(dir, 'out.wav');
    writeFileSync(inFile, wavBuffer);
    const run = (args) => {
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().slice(0, 300)}`);
    };
    run(['-i', inFile, '-ar', String(sampleRate), '-ac', '1', '-af', 'highpass=f=300,lowpass=f=3400', '-c:a', 'pcm_mulaw', mid]);
    run(['-i', mid, '-c:a', 'pcm_s16le', out]);
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
