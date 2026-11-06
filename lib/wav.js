// Minimal WAV helpers: PCM16 read/write, mono mixdown, resampling, level measurement.

/** Cheap header check for the server: returns {ok, reason, sampleRate, channels, bits, durationSec}. */
export function peekWav(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return { ok: false, reason: 'too short to be a WAV file' };
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return { ok: false, reason: 'not a RIFF/WAVE file' };
  const fmt = findChunk(buf, 'fmt ');
  const data = findChunk(buf, 'data');
  if (!fmt || !data) return { ok: false, reason: 'missing fmt or data chunk' };
  const format = buf.readUInt16LE(fmt.offset);
  const channels = buf.readUInt16LE(fmt.offset + 2);
  const sampleRate = buf.readUInt32LE(fmt.offset + 4);
  const bits = buf.readUInt16LE(fmt.offset + 14);
  if (![1, 0xfffe].includes(format) || bits !== 16) return { ok: false, reason: 'only 16-bit PCM WAV is supported' };
  const dataSize = Math.min(data.size, buf.length - data.offset);
  const durationSec = dataSize / (sampleRate * channels * 2);
  return { ok: true, sampleRate, channels, bits, durationSec, dataOffset: data.offset, dataSize };
}

function findChunk(buf, id) {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const cid = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (cid === id) return { offset: pos + 8, size };
    pos += 8 + size + (size % 2);
  }
  return null;
}

/** Decode a PCM16 WAV into mono Float32 samples in [-1, 1]. */
export function parseWav(buf) {
  const h = peekWav(buf);
  if (!h.ok) throw new Error(`invalid WAV: ${h.reason}`);
  const frames = Math.floor(h.dataSize / (2 * h.channels));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < h.channels; c++) acc += buf.readInt16LE(h.dataOffset + (i * h.channels + c) * 2);
    out[i] = acc / h.channels / 32768;
  }
  return { samples: out, sampleRate: h.sampleRate, durationSec: frames / h.sampleRate };
}

/** Encode mono Float32 samples as a 16-bit PCM WAV buffer. */
export function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Linear resampler with a box pre-filter when downsampling. */
export function resample(samples, from, to) {
  if (from === to) return samples;
  let src = samples;
  const ratio = from / to;
  if (ratio > 1) {
    const w = Math.max(1, Math.round(ratio));
    const filtered = new Float32Array(src.length);
    let acc = 0;
    for (let i = 0; i < src.length; i++) {
      acc += src[i];
      if (i >= w) acc -= src[i - w];
      filtered[i] = acc / Math.min(w, i + 1);
    }
    src = filtered;
  }
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = src[i0] ?? 0;
    const b = src[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function rms(samples) {
  if (!samples.length) return 0;
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / samples.length);
}
