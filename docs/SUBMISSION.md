# Submission pack

The registration/submission flow asks for these (from gnani.ai/internship, read Nov 6, 2026). The form is emailed to you after registration; copy from here.

## Before you submit

- [ ] Registered on https://www.gnani.ai/great-indian-ai-internship-registration-form (solo; add a teammate only if they accept the terms independently).
- [ ] Demo post is **live** on LinkedIn and/or X with `#GnaniAI` and `#GreatIndianAIInternshipChallenge` and a tag to Gnani AI. The post must be live before you submit.
- [ ] You have the post URL(s). Nominate exactly one post per platform.
- [ ] Demo video link (the post itself, or a public link).
- [ ] `results.md` has real numbers, the SIMULATED label, `n` and the CI.
- [ ] No real phone numbers, account numbers, Aadhaar, PAN or recorded calls in the demo or the repo.

## Demo video

https://youtu.be/3_k3QTzPp2w

## Fields (edit the numbers)

**Project title**
Kirana Bol: a noise-tested Hinglish voice order desk on Gnani Prisma and Timbre

**The problem you are solving**
Small shops take orders over noisy phone lines in Hinglish. Speech systems are usually evaluated on clean audio, so shop owners cannot tell whether an order desk will survive a bad line. Kirana Bol turns a spoken order into a bill and publishes a reproducible, item-level noise test that shows where the speech model holds and where it breaks.

**Who will use it**
Kirana and neighbourhood-store owners and their customers (the order desk), and builders of Indian voice agents who need a noise-robustness test they can rerun (the benchmark).

**Gnani AI models or APIs used**
- Prisma speech-to-text (`prisma-v2.5` [or v3.0: edit]) for every transcription, in the live demo and in the benchmark.
- Timbre text-to-speech (`timbre-v2.5`, voice Nalini) for the spoken bill readback and to generate the clean benchmark clips [delete if you used your own voice].

**Your contribution (solo)**
Everything: parser, server, browser audio pipeline, noise and telephone simulation, scoring, benchmark, demo, video and post. (Built with AI coding assistance; say so if the form asks.)

**Written project explanation (paste and edit)**
Kirana Bol has two parts. The order desk records or accepts an audio clip, sends it through a rate-limited server to Gnani Prisma, and a deterministic parser turns the Hinglish transcript into an itemised bill (item, quantity, unit, price). The benchmark takes 30 invented orders, mixes simulated street noise at a fixed SNR, applies an 8 kHz G.711 telephone chain, transcribes each clip with Prisma and scores item-level F1 (item, quantity and unit must all match). Results at clean and 10 dB: [fill from results.md] with 95% intervals. Limits: the noise and the speech are simulated, 30 orders is small, and there is no comparison model. Code and method: https://github.com/Guten-Morgen1302/kirana-bol. Demo link: [add after deploy].

**Post link(s) to nominate**
- LinkedIn: [url]
- X: [url or none]

## After submitting

- Reply to comments for 24 hours.
- Do not edit the nominated post's text in a way that removes the hashtags or tags.
- Keep the demo up until the closing cutoff, then retire it and rotate the API key.
