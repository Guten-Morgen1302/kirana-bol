# Runbook: do these in order

Everything is built and tested (57 tests). A first real benchmark run already happened on 2026-11-06 with your key (30 TTS calls, 91 STT calls, about 4 minutes of audio): `results.json` / `results.md`. **That run used TTS speech and simulated noise.** What is still unverified is a human voice on a real noisy recording, your credit price, and the deployed demo. Steps 1 to 4 below cover those.

Commands assume a terminal in the project folder. On Windows use Git Bash or PowerShell; `npm` works in both.

## Step 0: one-time setup (2 minutes)

1. `npm install`
2. Copy the example env file and add your key. Never paste the key into chat or commit it.
   - Git Bash: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
3. Open `.env` and set `GNANI_API_KEY=` to the key from https://app.gnani.ai/voice (API keys section). Keep `PRISMA_MODEL=prisma-v2.5`. It held up better than v3.0 at 0 dB with a human voice (see README); v3.0 was better only on TTS speech.
4. `npm test` (expect 57 passing).

You mentioned a Gemini key: this project does not need it (no LLM by design). Leave it out.

## Step 1: pilot, 10 minutes (decides the whole pitch)

Goal: does Prisma understand noisy Hinglish orders well enough?

1. `npm run dev`, open http://localhost:3000
2. Record 5 short orders on your phone or laptop in a noisy spot (fan, street, TV). 2 to 3 items each, for example "bhaiya ek kilo chawal aur do packet maggi". About 12 items in total.
3. Upload each clip with the upload box (any audio format works), or hold the button and speak.
4. Count how many of the 12 item-and-quantity pairs appear correctly on the bill. Write the transcripts down.
5. Pass = at least 9 of 12. If you pass, continue. If you fail, do not change the use case: lower the noise levels, report clean accuracy as the main number, and try `PRISMA_MODEL=prisma-v3.0` in `.env` (it may need access on your account).

If the server says `SERVER_MISCONFIGURED` or `UPSTREAM_ERROR` on the first call, the key or the model name is the likely cause; the log line in the terminal shows the request id and status (never the key).

## Step 2: credit price, 2 minutes

Open the dashboard, find the price per minute of speech-to-text and per text-to-speech call, and your balance. Fill the blanks in `docs/SPEC.md` section 9. Then run:

`npm run bench -- --dry-run --levels clean,10`

It prints how many minutes of audio a full run sends. Multiply by the price and add 25% reserve.

## Step 3: run the benchmark

`npm run bench -- --source tts --levels clean,10 --seed 42 --out results.json`

- First run generates 30 clean clips with Gnani Timbre (cached in `data/clean/`), mixes noise, applies the telephone chain, calls Prisma, scores.
- Add `0` to `--levels` if credits and time allow: `--levels clean,10,0`.
- If it stops half-way (network, credits), re-run the same command with `--resume`: it skips clips already done and retries only failures.
- Exit code 1 means some clips failed. The table shows `n failed`. Do not publish a partial table as complete.
- Results land in `results.json` and `results.md`. Read `results.md`; the failure gallery at the bottom is the part to put in your video.
- Prefer your own voice? Record the 30 orders (the `say` text in `data/orders.json`) and save them as `data/clean/o01.wav` ... `o30.wav`, then use `--source dir`. Human speech is a more credible test than TTS.

## Step 4: decide the pitch

Use the rule in `docs/SPEC.md` section 8. Write the chosen pitch and the actual numbers into `README.md` (section "Results").

## Step 5: deploy (Nov 7)

Follow `docs/DEPLOY.md`. One always-on Node process, not serverless. Test from your phone. Set `DAILY_CAP` from your credit budget.

## Step 6: video and post (Nov 8)

Follow `docs/POSTS.md`. Fill in the real numbers. Post by 8 PM IST.

## Step 7: submit (by Nov 10 noon)

Follow `docs/SUBMISSION.md`.

## Things I could not do for you

- I cannot sign in to your Gnani account, read your key or check your balance.
- The credit price per minute and your balance are unknown to me. Check the dashboard to see what the first run cost (about 4 minutes of STT audio plus 30 short TTS calls).
- Human voices on a real noisy recording are untested: the pilot (Step 1) is yours.
- I cannot record your voice, make the video or post for you.
- I cannot deploy to a host that needs your login. `docs/DEPLOY.md` has the exact steps.
