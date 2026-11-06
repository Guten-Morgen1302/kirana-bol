// Scoring for the benchmark. Item-level F1 is the headline; WER is secondary and only valid when
// reference and hypothesis use the same script.
import { normalize, mentionedItems } from './parser.js';

const keyOf = (item, qty, unit) => `${item}|${Math.round(qty * 1000) / 1000}|${unit}`;

/**
 * Compare expected items [{item, qty, unit}] with parsed lines [{itemId, qty, unit}].
 * A line is correct only if item AND quantity AND unit all match (multiset match).
 * A "not understood" item is simply a missed expected item. A defaulted quantity of 1
 * is correct only if the truth is 1, because it is compared like any other quantity.
 */
export function scoreOrder(expected, lines) {
  const want = new Map();
  for (const e of expected) want.set(keyOf(e.item, e.qty, e.unit), (want.get(keyOf(e.item, e.qty, e.unit)) || 0) + 1);
  let tp = 0;
  const extra = [];
  for (const l of lines) {
    const k = keyOf(l.itemId, l.qty, l.unit);
    if ((want.get(k) || 0) > 0) { want.set(k, want.get(k) - 1); tp++; } else extra.push(k);
  }
  const missing = [];
  for (const [k, n] of want) for (let i = 0; i < n; i++) missing.push(k);
  return { tp, fp: extra.length, fn: missing.length, extra, missing };
}

export function aggregate(scores) {
  let tp = 0, fp = 0, fn = 0;
  for (const s of scores) { tp += s.tp; fp += s.fp; fn += s.fn; }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentile bootstrap (over orders) for micro-F1. Seeded, so reruns agree. */
export function bootstrapCI(scores, { seed = 42, iterations = 1000, alpha = 0.05 } = {}) {
  if (scores.length === 0) return [0, 0];
  const rnd = mulberry32(seed);
  const vals = [];
  for (let it = 0; it < iterations; it++) {
    const sample = [];
    for (let i = 0; i < scores.length; i++) sample.push(scores[Math.floor(rnd() * scores.length)]);
    vals.push(aggregate(sample).f1);
  }
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor((alpha / 2) * iterations)];
  const hi = vals[Math.min(iterations - 1, Math.floor((1 - alpha / 2) * iterations))];
  return [lo, hi];
}

export function dominantScript(text) {
  let dev = 0, lat = 0;
  for (const ch of String(text)) {
    if (/[ऀ-ॿ]/.test(ch)) dev++;
    else if (/[a-z]/i.test(ch)) lat++;
  }
  if (dev === 0 && lat === 0) return 'none';
  return dev >= lat ? 'devanagari' : 'latin';
}

/** Word error rate on normalized words. Returns null when the two texts use different dominant scripts. */
export function wer(reference, hypothesis) {
  if (dominantScript(reference) !== dominantScript(hypothesis)) return null;
  const r = normalize(reference).split(' ').filter(Boolean);
  const h = normalize(hypothesis).split(' ').filter(Boolean);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...new Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  return d[r.length][h.length] / r.length;
}

/**
 * Expected items whose alias does not appear in the transcript at all, so the miss belongs to the
 * speech model, not to the parser's quantity binding.
 */
export function sttAttributableMisses(expected, transcript) {
  const seen = mentionedItems(transcript);
  return expected.filter((e) => !seen.has(e.item)).length;
}
