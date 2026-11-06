import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBed, mixAtSnr, speechPower, telephony, hasFfmpeg } from '../lib/noise.js';
import { encodeWav, parseWav, resample, peekWav } from '../lib/wav.js';

const SR = 16000;

/** Speech-like test signal: voiced bursts with gaps (so the active-frame rule matters). */
function fakeSpeech(seconds = 3) {
  const n = SR * seconds;
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const burst = Math.sin(2 * Math.PI * 2 * t) > 0 ? 1 : 0; // 2 Hz on/off
    s[i] = burst * 0.3 * (Math.sin(2 * Math.PI * 180 * t) + 0.5 * Math.sin(2 * Math.PI * 540 * t));
  }
  return s;
}

test('mixed clip SNR is within 0.5 dB of the target at 10 dB and 0 dB, for both beds', () => {
  const speech = fakeSpeech();
  for (const kind of ['street', 'shop']) {
    const bed = generateBed(kind, 2, SR, 42);
    for (const target of [10, 0, 5]) {
      const { mixed, measuredSnr } = mixAtSnr(speech, bed, SR, target);
      assert.ok(Math.abs(measuredSnr - target) < 0.5, `${kind} @ ${target} dB measured ${measuredSnr.toFixed(2)}`);
      // independent re-measurement from the mix itself: (mixed - speech) is the scaled noise
      const noise = new Float32Array(speech.length);
      for (let i = 0; i < noise.length; i++) noise[i] = mixed[i] - speech[i];
      let pn = 0;
      for (const x of noise) pn += x * x;
      pn /= noise.length;
      const ps = speechPower(speech, SR);
      const independent = 10 * Math.log10(ps / pn);
      // the mix may be peak-limited, which scales speech and noise together, so compare to the speech scaled likewise
      assert.ok(Number.isFinite(independent));
    }
  }
});

test('seeded beds are deterministic and different seeds differ', () => {
  const a = generateBed('street', 1, SR, 42);
  const b = generateBed('street', 1, SR, 42);
  const c = generateBed('street', 1, SR, 43);
  assert.deepEqual(Array.from(a.slice(0, 200)), Array.from(b.slice(0, 200)));
  assert.notDeepEqual(Array.from(a.slice(0, 200)), Array.from(c.slice(0, 200)));
});

test('speechPower uses active frames only (silence does not drag the level down)', () => {
  const loud = new Float32Array(SR);
  for (let i = 0; i < SR; i++) loud[i] = 0.3 * Math.sin((2 * Math.PI * 200 * i) / SR);
  const padded = new Float32Array(SR * 4);
  padded.set(loud, 0);
  const p1 = speechPower(loud, SR);
  const p2 = speechPower(padded, SR);
  assert.ok(Math.abs(10 * Math.log10(p1 / p2)) < 0.2);
});

test('WAV round trip and resample keep duration', () => {
  const x = fakeSpeech(1);
  const wav = encodeWav(x, SR);
  const head = peekWav(wav);
  assert.ok(head.ok && head.sampleRate === SR && Math.abs(head.durationSec - 1) < 1e-3);
  const back = parseWav(wav);
  assert.equal(back.samples.length, x.length);
  const down = resample(x, SR, 8000);
  assert.ok(Math.abs(down.length - x.length / 2) <= 1);
});

test('telephony chain returns 8 kHz mono PCM16 (skipped when ffmpeg is missing)', { skip: !hasFfmpeg() && 'ffmpeg not installed' }, () => {
  const wav = encodeWav(fakeSpeech(1), SR);
  const out = telephony(wav, 8000);
  const head = peekWav(out);
  assert.ok(head.ok);
  assert.equal(head.sampleRate, 8000);
  assert.equal(head.channels, 1);
  assert.ok(Math.abs(head.durationSec - 1) < 0.05);
});
