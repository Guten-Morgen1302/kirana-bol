# Kirana Bol

A Hinglish voice order desk for neighbourhood shops, plus a reproducible noise benchmark for Gnani AI's Prisma speech-to-text model. Built for the Great Indian AI Internship Challenge.

Speak or upload an order like **"bhaiya ek kilo chawal aur do packet maggi"** and the bill builds on screen.

## Results

First real run on 2026-11-06: model `prisma-v2.5`, language `hi-IN`, 30 invented orders (61 items), clean clips made with Gnani Timbre TTS, **SIMULATED** street noise (seeded synthetic bed) + 8 kHz G.711 telephone chain. Raw data: `results.json`, table: `results.md`.

| Level | n orders | Item F1 | 95% CI | Precision | Recall | STT-attributable misses |
|---|---|---|---|---|---|---|
| clean (16 kHz) | 30 | 1.000 | 1.000 to 1.000 | 1.000 | 1.000 | 0 |
| 10 dB SNR + telephone chain (SIMULATED) | 30 | 0.983 | 0.957 to 1.000 | 1.000 | 0.967 | 2 |
| 0 dB SNR + telephone chain (SIMULATED) | 30 | 0.827 | 0.737 to 0.899 | 1.000 | 0.705 | 18 |

Same 90 clips through Prisma v3.0 (`results.v3.json`):

| Level | v2.5 Item F1 (95% CI) | v3.0 Item F1 (95% CI) | v2.5 STT-attributable misses | v3.0 STT-attributable misses |
|---|---|---|---|---|
| clean (16 kHz) | 1.000 (1.000 to 1.000) | 0.984 (0.949 to 1.000) | 0 | 0 |
| 10 dB + telephone chain (SIMULATED) | 0.983 (0.957 to 1.000) | 0.992 (0.974 to 1.000) | 2 | 1 |
| 0 dB + telephone chain (SIMULATED) | 0.827 (0.737 to 0.899) | 0.914 (0.855 to 0.960) | 18 | 8 |

Reading it: at 10 dB both models keep the order almost intact. At 0 dB v3.0 misses fewer items outright (8 vs 18 of 61), but the two intervals overlap, so with 30 orders this is a **promising difference, not a proven one**. v3.0 also changes how it writes numbers (digits) and sometimes keeps English words in Latin script, so its WER is higher; item F1 is the metric to trust. Parser precision stays near 1.000 because unknown words are listed as "not understood", not guessed.

Pitch (rule in `docs/SPEC.md` section 8): both models hold up at 10 dB and break at 0 dB, and the order of the two models at 0 dB depends on whether the speech is TTS or a human. See the human-voice table below.

### Human voice, real room noise (n=10 orders, 21 items, my own recordings)

I recorded 10 of the orders myself (mp3) and ran them as recorded ("clean" = my room noise, unprocessed), then with simulated noise + phone chain on top. Raw: `results.human.v2.json`, `results.human.v3.json`.

| Level | v2.5 Item F1 (95% CI) | v3.0 Item F1 (95% CI) |
|---|---|---|
| as recorded (real room noise) | 1.000 (1.000 to 1.000) | 1.000 (1.000 to 1.000) |
| + 10 dB simulated noise + phone chain | 0.976 (0.919 to 1.000) | 0.950 (0.865 to 1.000) |
| + 0 dB simulated noise + phone chain | 0.533 (0.308 to 0.722) | 0.357 (0.095 to 0.545) |

What this changes: the v3.0 advantage seen with TTS speech **does not hold for a human voice**. At 0 dB with a real voice v2.5 held more of the order, and v3.0 sometimes returned fluent but unrelated sentences instead of the order (for example "वो काफ़ी खुश और एक achievement थी" for "do packet chips aur ek packet namkeen", or an empty transcript). Treat the model comparison as inconclusive at this sample size and say so. Both models read a real voice in a real room perfectly; both break at 0 dB. The honest headline is the breaking point, not "model X beats model Y".

What this does **not** show: the noise is simulated (procedural bed + 8 kHz G.711 codec), not a real phone call; the TTS tables use TTS speech (the human-voice table is only n=10); 30 orders is a small sample (see the intervals); there is no comparison model, so no "best" claim. The parser was fixed twice after the first real run exposed two bugs (both have regression tests); numbers above are after those fixes. See `docs/BENCHMARK.md`.

## Quickstart (about 3 minutes with a key)

Needs Node 20+ and, for the benchmark noise levels, ffmpeg.

```
git clone <this repo>
cd kirana-bol
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env: set GNANI_API_KEY (get one at https://app.gnani.ai/voice)
npm test                    # 57 tests, no network, no key needed
npm run dev                 # http://localhost:3000
```

No key yet? `npm test` and `npm run bench:mock` run without one (the mock run proves the plumbing; its numbers are labelled MOCK and say nothing about Gnani).

Try the parser alone, no key:

```
node -e "import('./lib/parser.js').then(m=>console.log(JSON.stringify(m.parseOrder('ek kilo chawal aur do packet maggi').lines.map(l=>[l.name,l.qty,l.unit]))))"
```

Expected: `[["Rice",1,"kg"],["Maggi noodles",2,"packet"]]`.

Call the API:

```
curl -s -X POST -H "Content-Type: audio/wav" --data-binary @clip.wav http://localhost:3000/api/order
```

## Run the benchmark

```
npm run bench -- --dry-run --levels clean,10      # how many minutes of audio will be sent
npm run bench -- --source tts --levels clean,10   # real run, writes results.json and results.md
```

Add `--resume` to continue after an interruption. Exit code 1 means some clips failed. Options and the results schema are in `docs/BENCHMARK.md`.

## How it works

Browser records, resamples to 16 kHz mono WAV, posts to a single Node process that checks the audio, applies a per-IP limit and a daily cap, calls Gnani Prisma, then a deterministic parser (no LLM) turns the transcript into a bill. Errors are always `application/problem+json` with a stable `code`. Details: `docs/ARCHITECTURE.md`. The parser rules and every other decision are in `docs/SPEC.md`.

## Docs

- `docs/SPEC.md` the one spec (start here)
- `docs/RUNBOOK.md` do-this-in-order checklist
- `docs/ARCHITECTURE.md`, `docs/BENCHMARK.md`, `docs/DATA.md`, `docs/DEPLOY.md`
- `docs/POSTS.md`, `docs/SUBMISSION.md` contest posting and submission
- `docs/DECISIONS.md` what the reviews decided and why; `docs/review/` the raw review records
- `TODOS.md` what was deliberately left out

## Demo posts

_Add the LinkedIn and X post links here after posting._

## Help

Gnani AI Discord: https://discord.gg/aECcvtABpq. API docs: https://docs.gnani.ai/. License: MIT (`LICENSE`).
