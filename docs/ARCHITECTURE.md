# Architecture

```
 Browser (public/)                          Server (server.js, ONE always-on process)               Gnani
 ---------------------------------          ----------------------------------------------          ---------------------------
 hold-to-speak / upload                     POST /api/order    ┐
 MediaRecorder                              POST /api/transcribe├─ size limit before buffering
 decodeAudioData                            POST /api/speak    ┘   content-type + WAV header checks
 OfflineAudioContext -> 16 kHz mono             |                  duration <= 30 s, silence check (no credits spent)
 encode WAV (client-side)  ------ audio/wav --> per-IP limiter + global daily cap  (BEFORE upstream)
                                                |
                                                +--> lib/gnani.js  --- multipart ---> POST /stt/v3   (Prisma)
                                                |       retry 429/5xx only: 500 ms, 1500 ms         POST /api/v1/tts/inference (Timbre)
                                                +--> lib/parser.js (deterministic, no LLM)
 bill table / not understood list <-- JSON {transcript, bill} or application/problem+json

 bench.js (runs on your laptop; never goes through the public server)
   data/orders.json -> clean clip (Timbre TTS or your recordings) -> lib/noise.js mix at SNR -> telephone chain (ffmpeg)
   -> lib/gnani.js transcribe -> lib/parser.js -> lib/score.js -> results.json + results.md (+ failure gallery)
```

## Modules

- `lib/parser.js` normalize, classify, item match (exact then fuzzy), quantity binding, bill. Exports `parseOrder`, `mentionedItems`, `createParser`.
- `lib/score.js` multiset item scoring, micro F1, seeded bootstrap CI, WER (script-aware), STT-attributable misses.
- `lib/noise.js` seeded synthetic beds, speech-power measurement, SNR mixing, telephone chain through ffmpeg.
- `lib/wav.js` PCM16 WAV read/write, header peek, resample.
- `lib/gnani.js` STT/TTS client, typed `GnaniError`, retry policy. Never includes the key or the raw upstream body in errors.
- `lib/env.js` minimal `.env` loader.
- `server.js` HTTP server, limiter, daily cap, error contract, static files. `createApp({config, env, fetchImpl, now, log})` is fully injectable, which is how the tests run without a network.
- `bench.js` benchmark CLI with resume, atomic writes and non-zero exit on failure.
- `catalog.json` 40 invented items with aliases in two scripts and invented prices. One catalog feeds the UI, server and bench.
- `config.json` model, language, endpoints, parser thresholds, limits, bench defaults.

## Key decisions (why)

- **One process, not serverless.** The limiter and the daily cap are in memory so the public demo cannot drain your credits. Serverless would reset them per instance.
- **Resample in the browser.** `MediaRecorder` gives webm/opus; Gnani lists WAV/MP3/OGG/FLAC/AAC. Converting client-side removes ffmpeg from the server and avoids the deprecated ScriptProcessor.
- **Mic constraints.** Echo cancellation on (so the readback is not re-recorded), noise suppression and auto gain off (so the live demo behaves like the benchmark).
- **Benchmark uses 8 kHz telephone audio, the live path uses 16 kHz.** They are different pipelines on purpose (the track is about telephony). The sample rate is recorded on every results row.
- **No LLM.** Deterministic parsing keeps the metric attributable: item F1 plus "STT-attributable misses" separate parser errors from speech-model errors.
- **Mock is clearly labelled.** `npm run bench:mock` uses an echo STT and synthetic clips to prove the plumbing. Its F1 of 1.0 says nothing about Gnani.

## Failure modes handled

Upstream 429/5xx/timeout, malformed upstream JSON, empty transcript, silent or too-short audio, oversize or non-WAV upload, rate limit, daily cap, missing key at startup, bad key (401), TTS failure (text bill stays), mic denied (upload fallback), double click / stale response (latest request wins), crash mid-benchmark (atomic writes + resume).

## Not handled (known)

Streaming STT, multi-instance limits, authentication of the demo, real phone-network audio, speakers other than the TTS voice (unless you supply recordings).
