import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOrder, aggregate, bootstrapCI, wer, dominantScript, sttAttributableMisses } from '../lib/score.js';

const E = (item, qty, unit) => ({ item, qty, unit });
const L = (itemId, qty, unit) => ({ itemId, qty, unit });

test('exact match scores tp only', () => {
  const s = scoreOrder([E('chawal', 1, 'kg'), E('maggi', 2, 'packet')], [L('chawal', 1, 'kg'), L('maggi', 2, 'packet')]);
  assert.deepEqual([s.tp, s.fp, s.fn], [2, 0, 0]);
});

test('right item with wrong quantity or wrong unit is both a miss and an extra', () => {
  const s = scoreOrder([E('chawal', 1, 'kg')], [L('chawal', 2, 'kg')]);
  assert.deepEqual([s.tp, s.fp, s.fn], [0, 1, 1]);
  const u = scoreOrder([E('chawal', 1, 'kg')], [L('chawal', 1, 'gram')]);
  assert.deepEqual([u.tp, u.fp, u.fn], [0, 1, 1]);
});

test('a not-understood item is a miss (fn) and adds no extra', () => {
  const s = scoreOrder([E('chawal', 1, 'kg'), E('maggi', 2, 'packet')], [L('chawal', 1, 'kg')]);
  assert.deepEqual([s.tp, s.fp, s.fn], [1, 0, 1]);
});

test('a defaulted quantity of 1 is correct only when the truth is 1', () => {
  assert.equal(scoreOrder([E('chawal', 1, 'kg')], [L('chawal', 1, 'kg')]).tp, 1);
  assert.equal(scoreOrder([E('chawal', 3, 'kg')], [L('chawal', 1, 'kg')]).tp, 0);
});

test('duplicate expected items match as a multiset', () => {
  const s = scoreOrder([E('maggi', 2, 'packet'), E('maggi', 2, 'packet')], [L('maggi', 2, 'packet')]);
  assert.deepEqual([s.tp, s.fp, s.fn], [1, 0, 1]);
});

test('micro-averaged F1 over orders', () => {
  const a = aggregate([{ tp: 2, fp: 0, fn: 0 }, { tp: 1, fp: 1, fn: 1 }]);
  assert.equal(a.tp, 3);
  assert.ok(Math.abs(a.precision - 0.75) < 1e-9);
  assert.ok(Math.abs(a.recall - 0.75) < 1e-9);
  assert.ok(Math.abs(a.f1 - 0.75) < 1e-9);
});

test('bootstrap CI is seeded (same seed, same interval) and brackets the point estimate', () => {
  const scores = Array.from({ length: 30 }, (_, i) => ({ tp: i % 5 === 0 ? 1 : 2, fp: 0, fn: i % 5 === 0 ? 1 : 0 }));
  const a = bootstrapCI(scores, { seed: 7 });
  const b = bootstrapCI(scores, { seed: 7 });
  assert.deepEqual(a, b);
  const f1 = aggregate(scores).f1;
  assert.ok(a[0] <= f1 && f1 <= a[1]);
  assert.deepEqual(bootstrapCI([]), [0, 0]);
});

test('WER: identical text gives 0; script mismatch gives null (not a misleading number)', () => {
  assert.equal(wer('ek kilo chawal', 'ek kilo chawal'), 0);
  assert.equal(wer('एक किलो चावल', 'एक किलो चावल'), 0);
  assert.equal(wer('ek kilo chawal', 'एक किलो चावल'), null);
  assert.ok(Math.abs(wer('ek kilo chawal', 'ek kilo atta') - 1 / 3) < 1e-9);
  assert.equal(dominantScript('abc'), 'latin');
  assert.equal(dominantScript('चावल'), 'devanagari');
});

test('STT-attributable misses: only expected items absent from the transcript', () => {
  const exp = [E('chawal', 1, 'kg'), E('maggi', 2, 'packet')];
  assert.equal(sttAttributableMisses(exp, 'एक किलो चावल दो पैकेट मैगी'), 0);
  assert.equal(sttAttributableMisses(exp, 'एक किलो चावल'), 1);
  // present in the transcript but with the wrong quantity -> not an STT miss
  assert.equal(sttAttributableMisses(exp, 'पांच किलो चावल तीन पैकेट मैगी'), 0);
});
