# Deploy (one always-on Node process)

Do **not** use Vercel/Netlify functions. The rate limiter and daily cap live in memory, so the app must run as a single long-lived process. Free tiers of Render, Fly.io or Railway work. Pick one; all three need your login, so I could not do this for you.

## Before you deploy

1. `npm test` passes locally and `npm run dev` works with your key.
2. Decide `DAILY_CAP` from your credit budget (`docs/SPEC.md` section 9). Start low (100 to 300).
3. Push the repo to GitHub **after** checking `git status` shows no `.env` (it is git-ignored) and `npm test` passes (it scans for key-shaped strings).

Local git setup if you have not done it:

```
git init
git add .
git status        # confirm .env, notes/, data/clean, data/mixed are NOT listed
git commit -m "Kirana Bol"
```

## Render (example)

1. New > Web Service > connect the GitHub repo.
2. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
3. Environment variables (Dashboard > Environment):
   - `GNANI_API_KEY` = your key (secret)
   - `PRISMA_MODEL` = `prisma-v2.5` (or the model that passed your pilot)
   - `DAILY_CAP` = e.g. `200`
   - `RATE_LIMIT_PER_MIN` = `30`
   - `TRUSTED_IP_HEADER` = `x-forwarded-for` (Render appends the real client IP as the **last** entry; the server uses the rightmost entry)
4. Deploy. Open `https://<your-app>.onrender.com/api/health`: you should see `"ok":true`.

Fly.io and Railway: same variables; set the start command to `npm start`. If the platform does not append the client IP to `x-forwarded-for`, leave `TRUSTED_IP_HEADER` empty (then all users share one limiter bucket, which is safe but strict).

## After you deploy (5 minutes)

1. Open the URL on your phone. Hold the button and say an order. Confirm the bill appears.
2. Free tiers sleep when idle. The first request after a sleep can take tens of seconds. Open the URL once before recording the video and before you submit.
3. Call the health endpoint twice and watch `daily_remaining` drop after real calls.
4. Hit the limit on purpose once (31 quick taps) to see the friendly message.
5. Put the URL in `README.md`.

## Kill switch

Set `DEMO_DISABLED=1` and restart: the API routes return a clear message and spend nothing. Restart is required for env changes.

## After the contest

Rotate the API key in the Gnani dashboard, delete or disable the service, and note in the README that the demo is retired.
