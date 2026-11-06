# Decisions and review summary

The plan went through three review phases (CEO, DX, Eng; Design was skipped because there is no UI scope) using gstack `/office-hours` and `/autoplan`. The raw records are in `docs/review/`.

## Important honesty notes about the reviews

- **No external model reviewed this.** The Claude CLI runner failed to start and Codex is barred by your CLAUDE.md, so every "outside voice" was a second Claude subagent. Treat the reviews as one model family's opinion.
- DX scores (4.3 -> 7.5 out of 10) are plan-stage projections, not measurements.
- The CEO spec review ran 3 rounds; the last round's 9 fixes were applied but not re-verified by a reviewer.
- The reviews were written before any code ran. The first real Gnani run happened afterwards and found two parser bugs the reviews missed (see `docs/BENCHMARK.md`).

## The decision you made

**UC1, lean core (approved).** Both Eng reviewers said the extras added during review exceed what one person can finish by Nov 10. You approved cutting back. In scope: parser, proxy with one error shape, one model, benchmark at clean and 10 dB (0 dB if time allows), failure gallery, demo video, one main post, SPEC.md with a credit budget. Out of scope (moved to `TODOS.md`): two-model comparison, real-channel sample, second speaker, schema-check test, Verify-to-test table, CONTRIBUTING, teaser, clarification turn, sample-audio button.

## Auto-decided choices (taken by recommendation)

- d1 Lead the post and video with the measured noise result; the order desk is the proof.
- d2 Keep the kirana use case even though it matches the organizers' own example idea; differentiate with the benchmark.
- d3 v2.5 vs v3.0 comparison: out of the lean core, but it turned out cheap (about 3 minutes of audio), so it was run anyway (see `README.md`).
- d4 Drop the checksum test; keep fixed seed.
- d5 Deterministic parser; LLM fallback deferred.
- d6 Whisper baseline deferred.
- d7 Node 20, single language.
- d8 Schedule/outreach notes live in git-ignored `notes/`, not the public README.
- d9 One always-on Node process, not serverless (in-memory limits need one process).
- d10 Mic: echo cancellation on, noise suppression off, auto gain off.

## Biggest risks the reviews found (still open)

1. Human voice tested (n=10, mp3): perfect as recorded, fine at 10 dB, breaks at 0 dB for both models; v3.0 is not better than v2.5 with a human voice. Larger and noisier real recordings would still strengthen it.
2. The headline rests on **simulated** noise; a skeptical reader can discount it. Keep the labels, show failures, consider a real-channel clip later (`TODOS.md`).
3. The kirana idea is the organizers' own example; many entrants will build it. The benchmark and honest failure gallery are the differentiator.
4. Engagement drives the shortlist and the cutoff time is unconfirmed. Post early.
5. Credit price per minute is unknown; fill `docs/SPEC.md` section 9 before running anything big.

## Superseded wording

The review record is layered (rounds 1 to 3, then dual-voice, DX and Eng groups, then UC1). `docs/SPEC.md` folds all of it into one page. Use SPEC.md, not the layers.
