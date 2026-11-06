# Recording your own voice (10 orders, about 10 minutes)

Goal: replace "TTS speech" in the claim with **a human voice in real noise**. This is the single biggest credibility upgrade left.

## How to record

1. Use your phone voice recorder (any format is fine).
2. Go somewhere genuinely noisy: fan on high, street-side window, TV on, kitchen with the mixer. Hold the phone about an arm's length away, like a customer on a call.
3. Read each line below **once**, naturally, the way you would order at a shop. Mixing Hinglish and Hindi is fine; read either column. Do not re-record because you stumbled: stumbles are the point.
4. Save each clip with the order id at the start of the name: `o01.m4a`, `o05_street.mp3`, `o12.wav` ...
5. Put all 10 files in one folder, for example `recordings/` (this folder is git-ignored, so it will not be committed).

| id | Hinglish (say this) | Devanagari (or this) |
|---|---|---|
| o01 | bhaiya ek kilo chawal aur do packet maggi | भैया एक किलो चावल और दो पैकेट मैगी |
| o03 | teen packet biscuit aur ek packet namak | तीन पैकेट बिस्किट और एक पैकेट नमक |
| o05 | ek litre doodh aur ek dozen ande | एक लीटर दूध और एक दर्जन अंडे |
| o10 | chai patti do sau gram aur cheeni ek kilo | चायपत्ती दो सौ ग्राम और चीनी एक किलो |
| o12 | ek kilo suji aur ek kilo poha | एक किलो सूजी और एक किलो पोहा |
| o13 | do packet chips aur ek packet namkeen | दो पैकेट चिप्स और एक पैकेट नमकीन |
| o20 | ek kilo cheeni do kilo chawal ek packet namak | एक किलो चीनी दो किलो चावल एक पैकेट नमक |
| o21 | teen sabun aur ek surf packet | तीन साबुन और एक सर्फ पैकेट |
| o26 | teen kilo chawal aur do kilo aata | तीन किलो चावल और दो किलो आटा |
| o29 | ek kilo moong dal aur ek kilo toor dal | एक किलो मूंग दाल और एक किलो तूर दाल |

## Convert and score (about 2 minutes)

```
npm run ingest -- recordings                    # converts to data/human/o01.wav ...
npm run bench -- --source dir --clean-dir data/human --orders o01,o03,o05,o10,o12,o13,o20,o21,o26,o29 --levels clean,10 --model prisma-v3.0 --out results.human.json
```

- `clean` here means "as recorded": your real noise, unprocessed. `10` adds the simulated noise + phone chain on top.
- Only 10 orders (about 20 items): the confidence interval will be wide. Report it honestly: "n=10 orders, human voice, real room noise".
- Each of these has a **ground truth** in `data/orders.json`, so the score is automatic.

## Consent and privacy

Only your own voice, reading the invented lines. No real names, numbers or addresses. If someone else speaks, get their OK in writing first (a chat message is enough) and keep their clips out of the public repo. Note it in `docs/DATA.md`.

## What to say in the post if it works

"Not just TTS: my own voice, real room noise, Hinglish, n=10 orders: [result]." If it does worse than the TTS run, say that too: it is more believable.
