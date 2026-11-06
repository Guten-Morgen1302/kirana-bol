# Posts, video and distribution

Rules from the contest page: post publicly on LinkedIn and/or X, tag Gnani AI's official account, include `#GnaniAI` and `#GreatIndianAIInternshipChallenge`, explain what you built and which Gnani models you used, and **nominate one post per platform in the submission**. No bought engagement, bots, paid promotion or engagement swaps. The shortlist depends on verified engagement recorded by the closing cutoff, so post early.

Do not publish any number you have not measured. Replace every `[ ]` below with the real value from `results.md`.

## Demo video

YouTube: https://youtu.be/3_k3QTzPp2w (put this link in both posts and in the submission form).

## The hook (first line decides everything)

Pick the one that matches your real result.

- If clean is strong and 10 dB drops: `I stress-tested an Indian speech model the way a phone line does. Clean audio: [F1 clean]. Same orders through street noise + an 8 kHz phone codec: [F1 10 dB]. Here is exactly where it breaks.`
- If you want the honest-comparison angle (true for the runs so far, re-check before posting): `I tested two Prisma models on TTS speech and on my own voice. On synthetic speech v3.0 looked better at 0 dB noise; on my real voice it did not (it sometimes answered with confident, unrelated sentences). Both break at 0 dB. n=10 for my voice, simulated noise.`
- If it holds up: `I put Hinglish grocery orders through simulated street noise and a phone codec. Item accuracy stayed at [F1 10 dB] (n=[items], simulated noise). Here is the receipt.`
- If it breaks badly (pitch rule): `Where does Indian speech AI break on a bad phone line? I measured it. [F1 10 dB] at 10 dB. Three failures, shown honestly.`

Always say **simulated** next to the number. Never say "best" or "beats".

## LinkedIn post (draft)

> [HOOK LINE]
>
> I built Kirana Bol for the Great Indian AI Internship Challenge by Gnani AI: you speak a grocery order in Hinglish ("bhaiya ek kilo chawal aur do packet maggi") and the bill builds on screen.
>
> The part I care about is the benchmark. 30 invented orders, run through simulated street noise and an 8 kHz telephone chain, scored item by item (item + quantity + unit must all match).
>
> What I used: Gnani Prisma (speech to text) for transcription and Timbre for the voice readback.
> What I found: [two honest sentences from results.md, including one failure].
> What it does not prove: the noise is simulated, not a real call, and 30 orders is a small sample ([F1 95% CI]).
>
> Try it: [demo URL]   Code + method: https://github.com/Guten-Morgen1302/kirana-bol
>
> @Gnani.ai #GnaniAI #GreatIndianAIInternshipChallenge

## X post (draft, keep under the limit)

> [HOOK LINE shortened]
> Built on @GnaniAI Prisma + Timbre. 30 Hinglish orders x simulated street noise + 8 kHz phone codec. Honest failures included.
> Demo: [URL]  Code: [URL]
> #GnaniAI #GreatIndianAIInternshipChallenge

Check the exact official handle on Gnani's pages before tagging; do not guess it.

## 60-second video (shot list)

1. **0-8 s, the hook.** Screen + audio: play a noisy order clip (fan/street) and let the viewer hear it. Caption: the headline number, marked "simulated".
2. **8-25 s, the live demo.** Hold the button, say an order, the bill builds. Show the transcript line.
3. **25-42 s, the benchmark.** Show `results.md` table: clean vs 10 dB. Read the number aloud.
4. **42-55 s, the failure gallery.** Show 1 or 2 real mistakes: expected vs got. Honesty is the shareable part.
5. **55-60 s, close.** "Built on Gnani Prisma and Timbre. Code and method in the repo." URL on screen.

Record in one take on your phone screen-recorder, with captions (many people watch muted). Keep your API key, dashboard and `.env` off screen.

## Distribution (do before building anything else)

Who should see this: people who care about Indian-language voice AI, kirana/retail tech, and students doing the same contest.

- Post from your own accounts. Message classmates, friends and mentors **individually** and say what it is; let them react if they want to. Do not ask for reactions in exchange for reactions.
- Share in communities you are already a member of (the Gnani Discord #showcase-style channel if one exists, college groups, voice-AI groups) following each group's rules.
- Reply to every comment in the first 24 hours; thoughtful replies count as genuine engagement.
- Keep a private list in `notes/outreach.md` (git-ignored). Do not put it in the public README.

## Engagement cutoff

The pages we read say engagement is recorded "by the closing cutoff" but do not state a time. Check your confirmation email and the programme page. If nothing is stated, assume **Nov 10, 11:59 PM IST** and post by **Nov 8 evening** so the post has about two days. Write what you found in `notes/schedule.md`.
