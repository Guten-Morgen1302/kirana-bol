# Benchmark: method, how to run, how to read it

## Question

How well does Gnani's Prisma speech-to-text keep the *items and quantities* of a Hinglish grocery order when the audio is degraded the way a phone line degrades it?

## What is measured

For each of the 30 orders in `data/orders.json`:

1. A clean clip (16 kHz) is made with Gnani Timbre TTS from the Devanagari `say` text, or loaded from `data/clean/<id>.wav` if you recorded your own.
2. For each noise level:
   - `clean`: the clean clip, unprocessed, 16 kHz.
   - `N` (for example `10`): noise is mixed at N dB SNR, then the telephone chain (8 kHz, 300-3400 Hz, G.711 mu-law) is applied. Sent as 8 kHz WAV.
3. The clip goes to Prisma. The transcript goes to `lib/parser.js`. The parsed bill is compared with the ground truth.

## Metrics

- **Item F1 (headline).** An item is correct only when item, quantity and unit all match. "Not understood" is a miss. A defaulted quantity of 1 is correct only if the truth is 1. Micro-averaged over all items at a level.
- **95% CI.** Seeded percentile bootstrap over orders (1000 resamples). With 30 orders it is wide: report it.
- **STT-attributable misses.** Expected items whose alias never appears in the transcript. These are the speech model's misses, not the parser's quantity binding.
- **WER (secondary).** Only computed when the reference and transcript use the same dominant script; otherwise `n/a`. Prisma often returns Devanagari, the reference is Devanagari, so it usually works, but spelling variants make WER noisy. Trust F1 more.

## What it does NOT prove

- The noise is **simulated**: a procedural bed mixed into speech, then a telephone codec. It is not a recorded street, shop or phone call. Say "simulated telephonic noise" next to every number.
- TTS speech is cleaner and more regular than a person. Use your own recordings (`--source dir`) for a more credible run.
- 30 orders and about 60 items give wide intervals. Differences of a few points between levels are inside the noise.
- No claim of "best performer": there is no comparison model in this run.

## Running it

```
npm run bench -- --dry-run --levels clean,10          # plan: how many minutes of audio
npm run bench -- --source tts --levels clean,10       # real run (needs .env key)
npm run bench -- --source tts --levels clean,10,0 --resume
npm run bench -- --source dir --levels clean,10       # your own recordings
npm run bench:mock                                    # plumbing only, no key, results labelled MOCK
```

Options: `--model prisma-v2.5|prisma-v3.0`, `--seed 42`, `--bed street|shop|path/to.wav`, `--out file.json`, `--limit n`, `--only-level L`, `--resume`.

Exit codes: `0` all clips scored, `1` some clips failed (table shows `n failed`), `2` usage problem (no key, bad level, ffmpeg missing).

## Files it writes

- `results.json` (schema below) and `results.md` (table + failure gallery).
- `data/clean/*.wav` cached clean clips, `data/mixed/snr<N>/*.wav` the exact audio sent (git-ignored; regenerate with the same seed).

```
{ benchmark_version, created, mock, labels[], config{model,language,source,seed,bed,levels,parser},
  summary{ <level>{ n_orders, n_failed, items_expected, tp, fp, fn, precision, recall, f1, f1_ci95[2],
                    stt_attributable_misses, wer_mean, wer_n, sample_rate } },
  gallery[ {order_id, level, said, transcript, expected, got} x up to 3 ],
  rows[ {order_id, level, model, source, status, sample_rate, snr_measured, transcript, expected, got,
         parsed[], not_understood[], tp, fp, fn, stt_misses, wer} ] }
```

## Reproducibility

Same seed, same bed, same clean clips give the same mixed audio. The tests check that the measured SNR of a mix is within 0.5 dB of the target and that beds are deterministic. API responses are not deterministic, so numbers can move slightly between runs.

## Using real noise

Drop a recorded WAV (street, shop, TV) into `data/noise/` and pass `--bed data/noise/street.wav`. Record where it came from and its licence in `docs/DATA.md`.

## First real run (2026-11-06) and what it taught us

Run: `npm run bench -- --source tts --levels clean,10,0 --seed 42 --out results.json`. Model `prisma-v2.5`, 90 clips, about 3.7 minutes of audio, no failed clips.

Item F1 (95% CI): clean 1.000 (1.000 to 1.000), 10 dB 0.983 (0.957 to 1.000), 0 dB 0.827 (0.737 to 0.899). Recall at 0 dB 0.705, precision 1.000. STT-attributable misses: 0, 2, 18. Secondary WER: 0.142, 0.162, 0.261 (clean WER is not 0 because Prisma writes "2" where the reference says "दो"; trust F1).

Two parser bugs were found by looking at real Prisma output and fixed (each has a regression test in `test/parser.test.js`):

1. `fuzzball` strips every non-ASCII letter by default, so unrelated Devanagari words scored as near-identical ("मीटर" matched "टमाटर" at 0.89 and put tomatoes on the bill). Fixed with `full_process: false`; the true ratio is 0.67.
2. A stray trailing unit ("पैकेट") could attach to the previous item and turn a correct "3 soaps" into "1 soap" through the unit-mismatch rule. Fixed: a trailing unit only completes an item it fits.

Honest note: those fixes were made after seeing the benchmark transcripts. They are general rules, not alias tweaks for these clips, but treat the final numbers as "after one round of fixing on the same set". A fresh set (or your own recordings) is the clean check. `node bench.js --rescore --out results.json` re-scores stored transcripts with the current parser without any API calls.

## Prisma v3.0 on the same clips (2026-11-06)

`npm run bench -- --source tts --model prisma-v3.0 --levels clean,10,0 --seed 42 --out results.v3.json`

Item F1 (95% CI): clean 0.984 (0.949 to 1.000), 10 dB 0.992 (0.974 to 1.000), 0 dB 0.914 (0.855 to 0.960). STT-attributable misses: 0, 1, 8 (v2.5: 0, 2, 18). The intervals overlap with v2.5 at 0 dB, so this is suggestive, not significant. The one clean-level miss is "तीन साबुन" heard as "साबुन" (quantity dropped).

Windows note found during this run: renaming the results file over an existing one can fail with EPERM when something briefly locks it. `bench.js` now retries and falls back to a direct write.

## Human voice, real room noise (2026-11-06, n=10 orders, 21 items)

Recorded by the project owner on a phone (mp3), converted with `npm run ingest`, scored with `npm run bench -- --source dir --clean-dir data/human --orders ... --levels clean,10,0`.

Item F1 (95% CI), v2.5 / v3.0: as recorded 1.000 / 1.000; +10 dB 0.976 (0.919 to 1.000) / 0.950 (0.865 to 1.000); +0 dB 0.533 (0.308 to 0.722) / 0.357 (0.095 to 0.545). STT-attributable misses at 0 dB: 12 / 16.

Findings: (1) A real voice in a real room is read perfectly by both models. (2) At 0 dB both collapse. (3) With a human voice v3.0 did worse than v2.5 at 0 dB, the opposite of the TTS run. v3.0 also produced confident unrelated text (hallucination) and empty transcripts under heavy noise; v2.5 mostly produced garbled or partial text that the parser rejected. With n=10 the intervals overlap, so do not claim either model is better. The TTS and human results disagree: that is itself a finding about benchmarking speech models on synthetic speech.

Unknown: how noisy the recording room really was. "As recorded" is only as hard as that room.

A v3.0 run showed 6 transient failures at 10 dB the first time; `--resume` retried only those and they succeeded (the cause was not recorded; it did not recur).
