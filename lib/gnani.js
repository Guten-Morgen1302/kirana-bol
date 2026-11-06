// Thin client for Gnani's REST speech APIs (docs.gnani.ai quick start, read 2026-11-06).
// Retries only 429 and 5xx, with the configured backoff. Errors never include the key or the raw upstream body.

export class GnaniError extends Error {
  constructor(code, message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = 'GnaniError';
    this.code = code;
    this.upstreamStatus = status;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(config, fn) {
  const { max, backoffMs } = config.retry;
  let last;
  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!(err instanceof GnaniError) || !err.retryable || attempt === max) throw err;
      await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)]);
    }
  }
  throw last;
}

function classify(status) {
  if (status === 401 || status === 403) return new GnaniError('SERVER_MISCONFIGURED', 'Gnani rejected the API key.', { status });
  if (status === 429) return new GnaniError('UPSTREAM_RATE_LIMITED', 'Gnani rate limit hit.', { status, retryable: true });
  if (status >= 500) return new GnaniError('UPSTREAM_ERROR', `Gnani returned ${status}.`, { status, retryable: true });
  return new GnaniError('UPSTREAM_REJECTED', `Gnani rejected the request (${status}).`, { status });
}

async function call(config, fetchImpl, url, init) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(config.retry.timeoutMs) });
  } catch (e) {
    throw new GnaniError('UPSTREAM_ERROR', e?.name === 'TimeoutError' ? 'Gnani request timed out.' : 'Could not reach Gnani.', { retryable: true });
  }
  if (!res.ok) throw classify(res.status);
  return res;
}

/** Speech to text. `wav` is a Buffer. Returns {transcript, raw}. */
export async function transcribe({ wav, apiKey, config, model = config.model, language = config.language, fetchImpl = fetch }) {
  return withRetry(config, async () => {
    const form = new FormData();
    form.append('audio_file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
    // prisma-v2.5 is the documented default and is sent without a model field
    if (model && model !== 'prisma-v2.5') form.append('model', model);
    form.append('language_code', language);
    const res = await call(config, fetchImpl, config.sttUrl, { method: 'POST', headers: { 'X-API-Key-ID': apiKey }, body: form });
    let json;
    try { json = await res.json(); } catch { throw new GnaniError('UPSTREAM_ERROR', 'Gnani returned malformed JSON.', { status: res.status, retryable: true }); }
    const transcript = typeof json.transcript === 'string' ? json.transcript : typeof json.text === 'string' ? json.text : null;
    if (json.success === false || transcript === null) throw new GnaniError('UPSTREAM_ERROR', 'Gnani returned no transcript field.', { status: res.status });
    return { transcript: transcript.trim(), model: json.model ?? model };
  });
}

/** Text to speech. Returns a WAV Buffer. */
export async function synthesize({ text, apiKey, config, fetchImpl = fetch }) {
  return withRetry(config, async () => {
    const body = {
      text,
      voice: config.ttsVoice,
      model: config.ttsModel,
      language: config.language,
      speed: 1.0,
      audio_config: { sample_rate: config.ttsSampleRate ?? 48000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' }
    };
    const res = await call(config, fetchImpl, config.ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': apiKey },
      body: JSON.stringify(body)
    });
    return Buffer.from(await res.arrayBuffer());
  });
}
