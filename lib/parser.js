// Deterministic Hinglish order parser. No LLM.
//
// Pipeline: normalize -> classify tokens -> find item mentions (exact first, fuzzy for long tokens)
//           -> group quantities -> bind quantities to items -> bill.
//
// Quantity precedence (see docs/SPEC.md):
//   1. A quantity group binds to the item that FOLLOWS it within `quantityWindow` tokens,
//      unless a separator word (aur / and / और) sits between them.
//   2. Otherwise it binds to the nearest PRECEDING item (trailing quantity, "maggi wala packet, do").
//   3. A group can supply a missing quantity or a missing unit to an item, never overwrite one.
import * as fuzz from 'fuzzball';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
export const defaultCatalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
export const defaultConfig = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8'));

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Normalize text: NFD, drop nukta, chandrabindu -> bindu, ASCII digits, strip punctuation, lowercase. */
export function normalize(input) {
  let s = String(input ?? '');
  s = s.normalize('NFD').replace(/़/g, '').replace(/ँ/g, 'ं').normalize('NFC');
  s = s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  s = s.toLowerCase();
  s = s.replace(/[^\p{L}\p{M}\p{N}\s.]/gu, ' ');
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const NUMBERS = {
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, paach: 5, chhe: 6, che: 6, chhah: 6,
  saat: 7, aath: 8, nau: 9, das: 10, aadha: 0.5, adha: 0.5, aadhi: 0.5, dedh: 1.5, dhai: 2.5, dhaai: 2.5, sava: 1.25,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, छह: 6, छे: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  आधा: 0.5, आधी: 0.5, डेढ: 1.5, ढाई: 2.5, सवा: 1.25
};
const HUNDRED = new Set(['sau', 'सौ']);
const UNITS = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', kilogram: 'kg', किलो: 'kg', केजी: 'kg', किलोग्राम: 'kg',
  gram: 'gram', grams: 'gram', gm: 'gram', gms: 'gram', ग्राम: 'gram',
  litre: 'litre', liter: 'litre', litres: 'litre', lit: 'litre', ltr: 'litre', लीटर: 'litre', लिटर: 'litre',
  packet: 'packet', packets: 'packet', pkt: 'packet', पैकेट: 'packet', पैकट: 'packet',
  dozen: 'dozen', darjan: 'dozen', दर्जन: 'dozen',
  bottle: 'bottle', bottles: 'bottle', botal: 'bottle', बोतल: 'bottle',
  piece: 'piece', pieces: 'piece', pcs: 'piece', pc: 'piece', nag: 'piece', नग: 'piece', पीस: 'piece'
};
const FILLERS = new Set([
  'bhaiya', 'bhai', 'bhaisahab', 'ji', 'woh', 'wo', 'wala', 'wali', 'wale', 'ka', 'ki', 'ke', 'ko', 'de', 'dena',
  'dijiye', 'dijie', 'chahiye', 'chahie', 'please', 'plz', 'mujhe', 'hume', 'humein', 'bas', 'ya', 'bhi', 'toh',
  'भैया', 'भाई', 'जी', 'वो', 'वह', 'वाला', 'वाली', 'वाले', 'का', 'की', 'के', 'को', 'दे', 'देना', 'दीजिए', 'दीजिये',
  'चाहिए', 'मुझे', 'हमें', 'बस', 'या', 'भी', 'कृपया', 'तो'
]);
const GIVE_WORDS = new Set(['de', 'dena', 'dijiye', 'dijie', 'दे', 'देना', 'दीजिए', 'दीजिये']);
const SEPARATORS = new Set(['aur', 'and', 'और']);

/** Build a parser around a catalog and a config. */
export function createParser(catalog = defaultCatalog, config = defaultConfig) {
  const p = config.parser;
  const items = catalog.items;
  const itemById = new Map(items.map((i) => [i.id, i]));

  // alias table: normalized alias -> Set(itemId)
  const aliasToItems = new Map();
  const aliasList = [];
  for (const item of items) {
    for (const raw of item.aliases) {
      const a = normalize(raw);
      if (!a) continue;
      if (!aliasToItems.has(a)) aliasToItems.set(a, new Set());
      aliasToItems.get(a).add(item.id);
    }
  }
  for (const a of aliasToItems.keys()) aliasList.push(a);

  /** Look up an n-gram string. Returns {status, score, ids}. */
  function lookup(text) {
    const exact = aliasToItems.get(text);
    if (exact) return { status: exact.size > 1 ? 'ambiguous' : 'matched', score: 1, ids: [...exact], how: 'exact' };
    if (text.length < p.minFuzzyLength) return null;
    let best = 0;
    let bestAliases = [];
    for (const a of aliasList) {
      if (Math.abs(a.length - text.length) > 3) continue;
      // full_process:false is essential: fuzzball strips every non-ASCII letter by default, which makes
      // unrelated Devanagari words look nearly identical (found by the first real benchmark run).
      const r = fuzz.ratio(text, a, { full_process: false }) / 100;
      if (r > best + 1e-9) { best = r; bestAliases = [a]; }
      else if (Math.abs(r - best) < 1e-9) bestAliases.push(a);
    }
    if (best < p.clarifyThreshold) return null;
    const ids = new Set();
    for (const a of bestAliases) for (const id of aliasToItems.get(a)) ids.add(id);
    if (best >= p.acceptThreshold) return { status: ids.size > 1 ? 'ambiguous' : 'matched', score: best, ids: [...ids], how: 'fuzzy' };
    return { status: 'uncertain', score: best, ids: [...ids], how: 'fuzzy' };
  }

  function classify(tokens) {
    return tokens.map((t, i) => {
      if (/^\d+(\.\d+)?$/.test(t)) return { t, kind: 'NUM', value: parseFloat(t) };
      if (t in NUMBERS) {
        // "de do" / "दे दो" means "give", not the number two
        if ((t === 'do' || t === 'दो') && i > 0 && GIVE_WORDS.has(tokens[i - 1])) return { t, kind: 'FILLER' };
        return { t, kind: 'NUM', value: NUMBERS[t] };
      }
      if (HUNDRED.has(t)) return { t, kind: 'HUNDRED' };
      if (t in UNITS) return { t, kind: 'UNIT', unit: UNITS[t] };
      if (SEPARATORS.has(t)) return { t, kind: 'SEP' };
      if (FILLERS.has(t)) return { t, kind: 'FILLER' };
      return { t, kind: 'WORD' };
    });
  }

  /** Find item mentions among WORD tokens. Longest n-gram first, non-overlapping. */
  function findMentions(cls) {
    const out = [];
    const used = new Array(cls.length).fill(false);
    for (let i = 0; i < cls.length; i++) {
      if (used[i] || cls[i].kind !== 'WORD') continue;
      let chosen = null;
      for (let n = 3; n >= 1; n--) {
        if (i + n > cls.length) continue;
        let ok = true;
        for (let k = i; k < i + n; k++) if (cls[k].kind !== 'WORD' || used[k]) { ok = false; break; }
        if (!ok) continue;
        const text = cls.slice(i, i + n).map((c) => c.t).join(' ');
        const hit = lookup(text);
        if (hit && hit.status !== 'uncertain') { chosen = { ...hit, start: i, end: i + n - 1, text }; break; }
        if (hit && hit.status === 'uncertain' && n === 1 && !chosen) chosen = { ...hit, start: i, end: i, text, weak: true };
      }
      if (chosen) {
        for (let k = chosen.start; k <= chosen.end; k++) used[k] = true;
        out.push(chosen);
      }
    }
    return { mentions: out, used };
  }

  function buildGroups(cls) {
    const groups = [];
    let i = 0;
    while (i < cls.length) {
      const k = cls[i].kind;
      if (k === 'NUM' || k === 'HUNDRED' || k === 'UNIT') {
        const start = i;
        let qty = null;
        let unit = null;
        while (i < cls.length && ['NUM', 'HUNDRED', 'UNIT'].includes(cls[i].kind)) {
          const c = cls[i];
          if (c.kind === 'NUM' && qty === null) qty = c.value;
          else if (c.kind === 'HUNDRED') qty = qty === null ? 100 : qty * 100;
          else if (c.kind === 'UNIT' && unit === null) unit = c.unit;
          i++;
        }
        groups.push({ start, end: i - 1, qty, unit });
      } else i++;
    }
    return groups;
  }

  function priceFor(item, qty, unit) {
    if (item.price == null) return null;
    const d = item.defaultUnit;
    if (unit === d) return round2(item.price * qty);
    if (d === 'kg' && unit === 'gram') return round2((item.price / 1000) * qty);
    if (d === 'gram' && unit === 'kg') return round2(item.price * 1000 * qty);
    if (d === 'dozen' && unit === 'piece') return round2((item.price / 12) * qty);
    if (d === 'piece' && unit === 'dozen') return round2(item.price * 12 * qty);
    return null;
  }
  const round2 = (n) => Math.round(n * 100) / 100;

  function parse(text) {
    const norm = normalize(text);
    const tokens = norm ? norm.split(' ') : [];
    const cls = classify(tokens);
    const { mentions, used } = findMentions(cls);
    const groups = buildGroups(cls);

    // targets in token order
    const targets = mentions.map((m) => ({ m, qty: null, unit: null }));
    const window = p.quantityWindow;
    const notes = [];

    for (const g of groups) {
      // 1. forward: first target starting after the group, within the window, no separator between
      let bound = null;
      for (const t of targets) {
        if (t.m.start <= g.end) continue;
        const gap = t.m.start - g.end - 1;
        if (gap > window) break;
        let sepBetween = false;
        for (let k = g.end + 1; k < t.m.start; k++) if (cls[k].kind === 'SEP') sepBetween = true;
        if (!sepBetween) bound = t;
        break;
      }
      // 2. backward: nearest preceding target that can still take something from this group
      if (!bound) {
        for (let idx = targets.length - 1; idx >= 0; idx--) {
          const t = targets[idx];
          if (t.m.end >= g.start) continue;
          const canQty = g.qty !== null && t.qty === null;
          // a stray trailing unit may only complete an item if the unit actually fits that item;
          // otherwise it would turn a correct quantity into a unit-mismatch (found in real Prisma output)
          const fits = t.m.status !== 'matched' || itemById.get(t.m.ids[0]).units.includes(g.unit);
          const canUnit = g.unit !== null && t.unit === null && fits;
          if (canQty || canUnit) bound = t;
          break;
        }
      }
      if (!bound) { notes.push(`unbound quantity near token ${g.start}`); continue; }
      if (g.qty !== null && bound.qty === null) bound.qty = g.qty;
      if (g.unit !== null && bound.unit === null) bound.unit = g.unit;
    }

    const lines = [];
    const notUnderstood = [];
    for (const t of targets) {
      const m = t.m;
      if (m.status === 'ambiguous') {
        notUnderstood.push({ text: m.text, reason: 'ambiguous', candidates: m.ids.map((id) => itemById.get(id).name) });
        continue;
      }
      if (m.status === 'uncertain') {
        notUnderstood.push({ text: m.text, reason: 'low-confidence', candidates: m.ids.map((id) => itemById.get(id).name) });
        continue;
      }
      const item = itemById.get(m.ids[0]);
      const flags = [];
      let qty = t.qty;
      let unit = t.unit;
      if (qty === null) { qty = 1; flags.push('defaulted-quantity'); }
      if (unit === null) unit = item.defaultUnit;
      else if (!item.units.includes(unit)) {
        flags.push('unit-mismatch');
        qty = 1;
        unit = item.defaultUnit;
      }
      lines.push({ itemId: item.id, name: item.name, qty, unit, flags, match: m.how, score: round2(m.score), heard: m.text });
    }

    // merge repeated items with the same unit (sum quantities)
    const merged = [];
    for (const l of lines) {
      const prev = merged.find((x) => x.itemId === l.itemId && x.unit === l.unit);
      if (prev) { prev.qty = round2(prev.qty + l.qty); prev.flags = [...new Set([...prev.flags, ...l.flags, 'repeated'])]; }
      else merged.push({ ...l });
    }
    let total = 0;
    for (const l of merged) {
      const item = itemById.get(l.itemId);
      l.lineTotal = priceFor(item, l.qty, l.unit);
      if (l.lineTotal != null) total += l.lineTotal;
    }

    // leftover content words that matched nothing (cap at 5)
    const leftovers = [];
    cls.forEach((c, i) => { if (c.kind === 'WORD' && !used[i] && c.t.length >= 3) leftovers.push(c.t); });
    for (const w of [...new Set(leftovers)].slice(0, 5)) notUnderstood.push({ text: w, reason: 'unknown-word', candidates: [] });

    return { normalized: norm, lines: merged, notUnderstood, total: round2(total), notes };
  }

  /** Item ids the transcript mentions at all, including ambiguous and low-confidence candidates. */
  function mentionedItems(text) {
    const cls = classify(normalize(text).split(' ').filter(Boolean));
    const { mentions } = findMentions(cls);
    const ids = new Set();
    for (const m of mentions) if (m.status !== 'uncertain') for (const id of m.ids) ids.add(id);
    return ids;
  }

  return { parse, mentionedItems, itemById };
}

const instance = createParser();
export const parseOrder = instance.parse;
export const mentionedItems = instance.mentionedItems;
export const itemById = instance.itemById;
