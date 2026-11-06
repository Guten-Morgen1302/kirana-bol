# TODOS

## Second-language variant (Tamil or Kannada) of the noise benchmark
- **What:** Re-run the order desk and noise benchmark in Tamil or Kannada.
- **Why:** Main Character track and wider reach; shows the harness is language-agnostic.
- **Pros:** Strong story for regional-language builders; reuses the harness.
- **Cons:** Needs a fluent judge for ground truth; new catalog aliases; outside the Nov 10 time budget.
- **Context:** Deferred by /autoplan CEO review on 2026-11-06 (proposal S4). Prisma lists 10+ Indian languages; Timbre has multiple Indic voices. Start from the benchmark manifest format.
- **Effort:** human L / CC M
- **Priority:** P3
- **Depends on:** Hindi benchmark finished and published.

## LLM fallback for low-confidence utterances
- **What:** Route utterances the deterministic parser scores below 0.65 to an LLM (Gnani's or other) for order extraction.
- **Why:** Open Hinglish phrasing is brittle for rule parsers; both CEO-review voices flagged it.
- **Pros:** Higher robustness, less rule maintenance. **Cons:** Cost, nondeterminism, muddier STT-vs-parser attribution.
- **Context:** Deferred by /autoplan CEO review 2026-11-06; contest terms were checked and impose no restriction, so the reason is build time.
- **Effort:** human M / CC S. **Priority:** P2. **Depends on:** parser v1 and benchmark done.

## Whisper (or other open) baseline column
- **What:** Run the same 90 clips through an open STT model for a comparison column.
- **Why:** "Performs best" needs a comparison. **Pros:** stronger claim. **Cons:** setup time.
- **Context:** Do on Nov 8 only if it takes under 1 hour; otherwise later.
- **Effort:** human S / CC S. **Priority:** P2. **Depends on:** results.json format.

## Extras moved out of the lean core (UC1, approved 2026-11-06)
- **What:** prisma-v2.5 vs v3.0 comparison; real-channel n=10 sample row; second-speaker clips; schema-check test; README Verify-to-test mapping table; CONTRIBUTING note; teaser post; clarification turn; sample-audio demo button.
- **Why:** the lean core fits a solo build by Nov 10; these make the headline more credible and the repo easier to review.
- **Pros:** stronger evidence, better reviewability. **Cons:** each adds hours; together they exceeded the budget.
- **Context:** dropped from scope by the user's approval of UC1 at the /autoplan final gate; details in the plan's Review record (CEO dual-voice and DX groups). Add back in this order if time remains: real-channel row, second speaker, v2.5 vs v3.0 comparison, clarification turn.
- **Effort:** human L / CC M. **Priority:** P2. **Depends on:** lean core shipped and credits remaining.
