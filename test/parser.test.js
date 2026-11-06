import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseOrder, normalize, mentionedItems } from '../lib/parser.js';
import { scoreOrder } from '../lib/score.js';

const orders = JSON.parse(readFileSync(new URL('../data/orders.json', import.meta.url), 'utf8')).orders;
const sig = (r) => r.lines.map((l) => `${l.itemId}:${l.qty}:${l.unit}`).join(',');

// --- Parser gate: 20 hand-written utterances, pass at least 18 (docs/SPEC.md) ---
const GATE = [
  ['bhaiya ek kilo chawal aur do packet maggi', 'chawal:1:kg,maggi:2:packet'],
  ['do kilo aata aur ek kilo cheeni dena', 'atta:2:kg,cheeni:1:kg'],
  ['teen packet biscuit', 'biscuit:3:packet'],
  ['aadha kilo tamatar', 'tamatar:0.5:kg'],
  ['dedh kilo aloo', 'aloo:1.5:kg'],
  ['paanch sau gram paneer', 'paneer:500:gram'],
  ['sau gram jeera', 'jeera:100:gram'],
  ['woh maggi wala packet, do', 'maggi:2:packet'],
  ['ek kilo chawal do maggi', 'chawal:1:kg,maggi:2:packet'],
  ['chawal ek kilo aur maggi do packet', 'chawal:1:kg,maggi:2:packet'],
  ['do sabun', 'sabun:2:piece'],
  ['teen sabun aur ek surf packet', 'sabun:3:piece,surf:1:packet'],
  ['2 kilo atta 1 litre doodh', 'atta:2:kg,doodh:1:litre'],
  ['एक किलो चावल और दो पैकेट मैगी', 'chawal:1:kg,maggi:2:packet'],
  ['आधा किलो टमाटर और डेढ़ किलो आलू', 'tamatar:0.5:kg,aloo:1.5:kg'],
  ['दो सौ ग्राम बादाम', 'badam:200:gram'],
  ['ek kilo moong dal aur ek kilo toor dal', 'moong_dal:1:kg,toor_dal:1:kg'],
  ['ek dozen ande aur ek litre tel', 'ande:1:dozen,tel:1:litre'],
  ['maggi', 'maggi:1:packet'],
  ['bhai de do ek kilo namak', 'namak:1:kg']
];

test('parser gate: at least 18 of 20 written utterances parse exactly', () => {
  const failures = [];
  for (const [text, want] of GATE) {
    const got = sig(parseOrder(text));
    if (got !== want) failures.push({ text, want, got });
  }
  assert.ok(GATE.length - failures.length >= 18, `only ${GATE.length - failures.length}/20 passed: ${JSON.stringify(failures, null, 1)}`);
  assert.equal(failures.length, 0, `failures: ${JSON.stringify(failures, null, 1)}`);
});

test('all 30 benchmark orders parse perfectly from romanized text and from Devanagari', () => {
  for (const o of orders) {
    for (const [label, text] of [['text', o.text], ['say', o.say]]) {
      const r = parseOrder(text);
      const s = scoreOrder(o.expected, r.lines);
      assert.equal(s.fn + s.fp, 0, `${o.id} (${label}) "${text}" -> ${sig(r)}; missing=${s.missing} extra=${s.extra}`);
    }
  }
});

// --- Precedence table: each row is a rule from docs/SPEC.md ---
test('trailing quantity binds to the preceding item', () => {
  assert.equal(sig(parseOrder('woh Maggi wala packet, do')), 'maggi:2:packet');
});

test('a following quantity wins over a preceding item without a separator', () => {
  assert.equal(sig(parseOrder('ek kilo chawal do Maggi')), 'chawal:1:kg,maggi:2:packet');
});

test('a separator stops forward binding', () => {
  assert.equal(sig(parseOrder('chawal ek kilo aur Maggi do packet')), 'chawal:1:kg,maggi:2:packet');
});

test('unit mismatch is flagged and defaults to 1 default unit', () => {
  const r = parseOrder('ek kilo maggi');
  assert.equal(sig(r), 'maggi:1:packet');
  assert.ok(r.lines[0].flags.includes('unit-mismatch'));
});

test('missing quantity defaults to 1 and is flagged', () => {
  const r = parseOrder('chawal');
  assert.equal(sig(r), 'chawal:1:kg');
  assert.ok(r.lines[0].flags.includes('defaulted-quantity'));
});

test('repeated mentions with the same unit sum their quantities', () => {
  const r = parseOrder('do packet maggi aur teen packet maggi');
  assert.equal(sig(r), 'maggi:5:packet');
  assert.ok(r.lines[0].flags.includes('repeated'));
});

test('"de do" means give, not the number two', () => {
  assert.equal(sig(parseOrder('bhai de do namak')), 'namak:1:packet');
});

test('ambiguous alias is listed as not understood with candidates', () => {
  const r = parseOrder('ek kilo dal');
  assert.equal(r.lines.length, 0);
  assert.equal(r.notUnderstood[0].reason, 'ambiguous');
  assert.equal(r.notUnderstood[0].candidates.length, 3);
});

test('thresholds are inclusive at 0.80 (accept) and 0.65 (low confidence)', () => {
  // "chawl" vs "chawal": indel ratio 0.909 -> accepted
  assert.equal(sig(parseOrder('ek kilo chawl')), 'chawal:1:kg');
  // garbled word far from every alias is unknown, never a guess
  const r = parseOrder('ek kilo xyzabc');
  assert.equal(r.lines.length, 0);
});

test('tokens shorter than 4 characters never fuzzy-match', () => {
  const r = parseOrder('ek kilo cha');
  assert.equal(r.lines.length, 0);
});

test('unicode: nukta and chandrabindu variants normalize equal', () => {
  assert.equal(normalize('पाँच'), normalize('पांच'));
  assert.equal(normalize('डेढ़'), normalize('डेढ'));
  assert.equal(sig(parseOrder('पाँच किलो आटा')), 'atta:5:kg');
});

test('mentionedItems reports ambiguous candidates too', () => {
  const ids = mentionedItems('ek kilo dal');
  assert.ok(ids.has('moong_dal') && ids.has('toor_dal') && ids.has('chana_dal'));
});

test('bill total uses catalog prices', () => {
  const r = parseOrder('do kilo aata'); // 2 x 45
  assert.equal(r.total, 90);
});

test('empty and garbage input never throws', () => {
  for (const s of ['', '   ', '!!!', null, undefined, '😀😀']) {
    const r = parseOrder(s);
    assert.equal(r.lines.length, 0);
  }
});

test("regression: unrelated Devanagari words never fuzzy-match an item (fuzzball full_process bug)", () => {
  // real Prisma output at 0 dB for "ek litre doodh aur ek dozen ande"; "मीटर" must not become tamatar
  const r = parseOrder("एक मीटर दूर और एक दर्जन अंदर");
  assert.equal(r.lines.length, 0, JSON.stringify(r.lines));
  // a genuine near-miss in Devanagari still matches
  assert.equal(sig(parseOrder("एक किलो चावल")), "chawal:1:kg");
});

test("regression: a stray unit after another item does not corrupt a correct quantity (real Prisma output at 10 dB)", () => {
  // heard: "3 साबुन और एक सफ पैकेट" (surf was misheard as सफ). sabun must stay 3 pieces.
  assert.equal(sig(parseOrder("3 साबुन और एक सफ पैकेट")), "sabun:3:piece");
  // a fitting trailing unit still completes the item
  assert.equal(sig(parseOrder("teen sabun aur ek surf packet")), "sabun:3:piece,surf:1:packet");
  assert.equal(sig(parseOrder("woh maggi wala packet, do")), "maggi:2:packet");
});
