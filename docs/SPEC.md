# SPEC: Kirana Bol (single source of truth)

This is the one spec to build and judge against. It folds the approved design doc and every autoplan decision into one non-layered page. Where this file and `docs/review/` disagree, **this file wins**. (Autoplan record: `docs/review/autoplan-review-record.md`, summary: `docs/DECISIONS.md`.)

Status: lean core, approved 2026-11-06 (UC1). Deadline: **2026-11-10, 11:59 PM IST**.

## 1. What it is

A Hinglish voice order desk for kirana shops, plus a reproducible noise benchmark for Gnani's Prisma speech-to-text model.

- Speak (or upload) an order such as "bhaiya ek kilo chawal aur do packet maggi". The bill builds on screen.
- A benchmark runs 30 invented orders at clean audio and at 10 dB noise through an 8 kHz telephone chain, scores item-level F1, and publishes the table with its limits.
- Target award track: **Noise Canceller**. The headline claim is about *simulated* telephonic noise, labelled as such everywhere.

## 2. In scope (lean core)

1. Web page: hold-to-speak, upload fallback, bill, "not understood" list, Hindi readback (text fallback), start over.
2. One Node process: static page + `POST /api/order`, `POST /api/transcribe`, `POST /api/speak`, `GET /api/health`.
3. Deterministic parser (no LLM) with the precedence rules in section 5.
4. Benchmark: `bench.js`, 30 orders, levels `clean` and `10` (add `0` if time allows), one model, item F1 + 95% bootstrap CI, secondary WER, STT-attributable misses.
5. Failure gallery: the 3 worst distinct orders.
6. Demo video (60 s), one main post with a benchmark-first hook, submission.

## 3. Out of scope (see `TODOS.md`)

prisma-v2.5 vs v3.0 comparison, real-channel (phone speaker) sample, second-speaker clips, schema-check test, Verify-to-test table, CONTRIBUTING, teaser post, clarification turn (ambiguous items are listed as "not understood" with candidates), LLM fallback, Whisper baseline, second language, streaming/WebSocket, serverless hosting.

## 4. Architecture (one process)

```
Browser: MediaRecorder -> decodeAudioData -> OfflineAudioContext (16 kHz mono) -> WAV   (public/app.js)
   | POST audio/wav (<= 2 MB, <= 30 s)
   v
server.js (single always-on Node process)
   size limit before buffering -> content checks -> silence check
   -> per-IP limiter (30/min) + global daily cap (100/day IST), both BEFORE the upstream call
   -> lib/gnani.js STT (retry 429/5xx: 500 ms, 1500 ms; no retry on other 4xx)
   -> lib/parser.js -> JSON { transcript, bill }  |  problem+json on any failure

bench.js (local; calls Gnani directly, never the public proxy)
   clean clip (TTS or your recording) -> lib/noise.js mix at SNR (noise BEFORE telephony)
   -> 8 kHz band-limit + G.711 (ffmpeg) -> STT -> parser -> lib/score.js -> results.json / results.md
```

Why one process: the rate limiter and daily cap are in memory. On serverless they would silently not work.

## 5. Parser rules (each row has a unit test in `test/parser.test.js`)

1. Normalize: NFD, drop nukta, chandrabindu -> bindu, NFC, Devanagari digits -> ASCII, strip punctuation, lowercase.
2. Classify tokens: number words (`ek do teen ... aadha dedh dhai`, Devanagari too), `sau`/`सौ` = 100 (`do sau` = 200, `sau` alone = 100), units (`kilo kg gram litre packet dozen bottle piece`), fillers (`bhaiya wala ka ... de dena`), separators (`aur and और`).
3. `de do` / `दे दो` means "give", not the number two.
4. Item match: exact alias first. Fuzzy only for strings of 4 or more characters: accept at ratio >= 0.80, "low-confidence" at 0.65 to <0.80 (listed as not understood with a "did you mean"), below 0.65 ignored. Longest n-gram (3,2,1 tokens) wins. An alias shared by several items (for example `dal`) is **ambiguous**: listed as not understood with all candidates.
5. Quantity binding:
   - A quantity group (number, optional unit) binds to the item that **follows** it within 3 tokens, unless a separator sits between them.
   - Otherwise it binds to the nearest **preceding** item (trailing quantity).
   - A group can supply a missing quantity or unit to an item; it never overwrites one.
6. Defaults: no quantity -> 1 (flagged); unit missing -> item's default unit; unit not allowed for the item (for example `kilo maggi`) -> 1 default unit, flagged `unit-mismatch`.
7. Repeats: same item and same unit are summed (flagged `repeated`).

Worked examples

- `ek kilo chawal do maggi` -> chawal 1 kg, maggi 2 packet
- `chawal ek kilo aur maggi do packet` -> chawal 1 kg, maggi 2 packet (separator stops forward binding)
- `woh maggi wala packet, do` -> maggi 2 packet (trailing quantity)
- `teen sabun aur ek surf packet` -> sabun 3 piece, surf 1 packet
- `ek kilo dal` -> not understood, ambiguous: toor / moong / chana dal

Gate: at least 18 of 20 written utterances parse exactly (`test/parser.test.js`), and all 30 benchmark orders parse perfectly from both romanized text and Devanagari.

## 6. API contract

All failures are non-2xx `application/problem+json`: `{ type, title, status, code, detail, request_id }`.

- `RATE_LIMITED` 429 (+ `Retry-After`), `DAILY_CAP` 429, `UPSTREAM_ERROR` 502, `BAD_AUDIO` 400/413/415, `EMPTY_AUDIO` 422, `SERVER_MISCONFIGURED` 500/503, `NOT_FOUND` 404/405.
- The API key is never returned, logged or echoed. Logs never contain transcripts or audio. Startup fails fast naming `GNANI_API_KEY` if it is missing. `DEMO_DISABLED=1` turns the API routes off (restart to apply).
- Client IP comes from the socket, or the **rightmost** entry of `TRUSTED_IP_HEADER` if you configured one.

## 7. Benchmark method

- 30 invented orders (`data/orders.json`), no ambiguous aliases, single turn, ground truth = (item, quantity, unit).
- Clean clips: Gnani Timbre TTS (default) or your own recordings in `data/clean/<id>.wav`. TTS speech is cleaner than humans: say so when reporting.
- Mix: speech level = mean power over 20 ms frames above -40 dBFS; noise scaled to the target SNR; noise added **before** the telephone chain; measured SNR must be within 0.5 dB of target (tested).
- Telephone chain: 8 kHz, 300-3400 Hz band-pass, G.711 mu-law (ffmpeg). Clean row stays 16 kHz unprocessed. Sample rate is recorded on every row.
- Beds: built-in beds are **synthetic**, seeded. You can pass a real bed WAV with `--bed`.
- Metrics: item-level micro F1 (headline) with a seeded 95% bootstrap CI and `n`; precision/recall; STT-attributable misses (expected item never appears in the transcript); WER only when reference and transcript share a script.
- Claims: no "best performer" claim from simulated noise. The Nov 6 pilot is about 12 item pairs: treat it as a heuristic, not a measurement.

## 8. Pitch rule (decide after the Nov 6 pilot)

If item F1 at 10 dB on the pilot is **below 0.5**, the pitch becomes "where Indian speech models break and by how much" (still Noise Canceller), with Mixed Vibes as the fallback track if clean Hinglish accuracy is the only strong result. Write the chosen pitch and the pilot numbers in the README.

## 9. Credit budget (fill from your dashboard; formula is fixed)

You have a one-time pool of programme credits (the email says Rs 5000). The per-minute price is not published on the pages we read: read it from the dashboard, then fill the blank.

- Price per minute of STT audio: `______` (not published on any page; derive it below). Price for TTS: `______`.
- **How to get the price in 2 minutes:** the dashboard shows your balance. Before any new run, note the balance. Run `npm run bench -- --source tts --model prisma-v3.0 --levels clean --limit 5 --out results.price.json` (about 0.2 min of audio), note the balance again, then price per minute = (balance drop) / (minutes printed at the end). Already spent so far in this project: about 8 minutes of STT audio and 30 short TTS calls (about 90 s of speech); compare that with how far your balance has fallen from Rs 5000 to get an upper bound.
- Minutes of audio = `npm run bench -- --dry-run --levels clean,10` (60 clips, about 4 minutes).
- Budget lines: pilot (5 clips, about 0.5 min) + TTS generation of 30 clean clips (once, cached) + bench at clean and 10 dB (about 4 min) + 25% reserve for reruns + demo cap (100 calls/day at about 5 s each is about 8 min/day at full cap; raise or lower `DAILY_CAP` once you know the price).
- Rule: set `DAILY_CAP` so that (cap x 5 s x days live) fits inside what remains after the benchmark and the reserve.

## 10. Day plan (IST)

- **Nov 6:** pilot (5 noisy clips through the upload box), credit price, `.env`, repo, post hook and community list, run the 30 TTS clips + bench at clean and 10 dB.
- **Nov 7:** deploy (single process), warm-up, test on your phone browser, record 30-second raw footage.
- **Nov 8:** finish results + failure gallery, record the 60-second video, publish the main post by 8 PM.
- **Nov 9:** buffer, reply to comments, fresh-clone dry run (clone to first transcription under 5 minutes), confirm post links.
- **Nov 10:** submit before noon.

Cut order if time runs short: sample/extras first, then 0 dB, then the readback, then the gallery image in the video (keep it in the README). **Never cut:** parser tests, the benchmark table, the demo video.

## 11. Acceptance checklist

- [ ] `npm test` passes on a fresh clone.
- [ ] `.env` is git-ignored; no key anywhere in the repo or history.
- [ ] README table shows `n` and the CI, and says SIMULATED next to every headline number.
- [ ] 31st call in a minute from one client is refused on the deployed URL.
- [ ] Demo URL transcribes one clip from your phone.
- [ ] Post is live with `#GnaniAI` and `#GreatIndianAIInternshipChallenge`, and you nominate it in the submission.
