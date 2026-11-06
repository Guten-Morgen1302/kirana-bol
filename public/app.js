// Kirana Bol client. Records or uploads audio, resamples it to 16 kHz mono WAV in the browser
// (no ScriptProcessor, no server-side conversion), posts it to /api/order and renders the bill.
const $ = (id) => document.getElementById(id);
const els = {
  rec: $('rec'), status: $('status'), file: $('file'), reset: $('reset'),
  result: $('result'), transcript: $('transcript'), bill: $('bill').querySelector('tbody'), total: $('total'),
  nu: $('nu'), nuList: $('nu').querySelector('ul'), speak: $('speak'), speakNote: $('speakNote')
};
const TARGET_RATE = 16000;
const MAX_SECONDS = 30;
const MAX_BYTES = 2 * 1024 * 1024;
const UNIT_HI = { kg: 'किलो', gram: 'ग्राम', litre: 'लीटर', packet: 'पैकेट', dozen: 'दर्जन', bottle: 'बोतल', piece: 'नग' };

let requestCounter = 0; // latest request wins: stale responses are ignored
let busy = false;
let speaking = false;
let recorder = null;
let stream = null;
let chunks = [];
let startedAt = 0;
let lastBill = null;

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

function syncControls() {
  const locked = busy || speaking;
  els.rec.disabled = locked;
  els.file.disabled = locked;
  els.speak.disabled = busy || speaking || !lastBill || lastBill.lines.length === 0;
}

// ---- audio: decode anything the browser can play, resample to 16 kHz mono, write a PCM16 WAV ----
async function toWav16k(arrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try { decoded = await ctx.decodeAudioData(arrayBuffer.slice(0)); } finally { ctx.close?.(); }
  if (decoded.duration > MAX_SECONDS) throw new Error(`That clip is ${decoded.duration.toFixed(1)} s. The limit is ${MAX_SECONDS} s.`);
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const off = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ---- API ----
const MESSAGES = {
  RATE_LIMITED: (p) => `Too many tries. ${p.detail}`,
  DAILY_CAP: () => 'The public demo hit its daily limit to protect the contest credits. Watch the recorded demo or run it from the repo.',
  UPSTREAM_ERROR: () => 'The speech service had a hiccup. Please try again in a few seconds.',
  BAD_AUDIO: (p) => p.detail,
  EMPTY_AUDIO: () => 'kuch suna nahi, phir boliye. (I did not hear anything. Hold the button and speak.)',
  SERVER_MISCONFIGURED: () => 'The server is not set up correctly right now. The operator has been told by the logs.'
};

async function sendWav(blob) {
  if (blob.size > MAX_BYTES) { setStatus(`That clip is larger than ${MAX_BYTES / 1024 / 1024} MB.`, true); return; }
  const mine = ++requestCounter;
  busy = true; syncControls();
  setStatus('Listening to your recording...');
  try {
    const res = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: blob });
    const body = await res.json().catch(() => null);
    if (mine !== requestCounter) return; // a newer request replaced this one
    if (!res.ok) {
      const code = body?.code;
      setStatus((MESSAGES[code] ? MESSAGES[code](body) : `Something went wrong (${res.status}).`) + (body?.request_id ? ` [ref ${body.request_id}]` : ''), true);
      return;
    }
    render(body);
    setStatus(body.bill.lines.length ? 'Done. Check the bill below.' : 'I heard you but found no items. Try naming items like chawal, aata, maggi.');
  } catch {
    if (mine === requestCounter) setStatus('Could not reach the server. Check your connection and try again.', true);
  } finally {
    if (mine === requestCounter) { busy = false; syncControls(); }
  }
}

// ---- rendering (textContent only: transcripts are untrusted) ----
function render({ transcript, bill }) {
  lastBill = bill;
  els.result.classList.remove('hidden');
  els.transcript.textContent = transcript;
  els.bill.replaceChildren();
  for (const l of bill.lines) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = l.name;
    if (l.flags.length) {
      const f = document.createElement('div');
      f.className = 'flag';
      f.textContent = l.flags.map((x) => ({ 'defaulted-quantity': 'quantity assumed 1', 'unit-mismatch': 'unit did not fit; assumed 1', repeated: 'mentioned twice, added up' }[x] || x)).join('; ');
      name.appendChild(f);
    }
    const qty = document.createElement('td'); qty.textContent = String(l.qty);
    const unit = document.createElement('td'); unit.textContent = l.unit;
    const amt = document.createElement('td'); amt.className = 'num'; amt.textContent = l.lineTotal == null ? '-' : `₹${l.lineTotal}`;
    tr.append(name, qty, unit, amt);
    els.bill.appendChild(tr);
  }
  els.total.textContent = `₹${bill.total}`;
  els.nuList.replaceChildren();
  for (const n of bill.notUnderstood) {
    const li = document.createElement('li');
    li.textContent = n.candidates.length ? `"${n.text}" (${n.reason}): did you mean ${n.candidates.join(' / ')}?` : `"${n.text}" (${n.reason})`;
    els.nuList.appendChild(li);
  }
  els.nu.classList.toggle('hidden', bill.notUnderstood.length === 0);
  els.speakNote.textContent = '';
  syncControls();
}

// ---- recording (hold to speak) ----
async function startRecording() {
  if (busy || speaking || recorder) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  } catch {
    setStatus('Microphone blocked. Allow microphone access in the browser, or use the upload option below.', true);
    return;
  }
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    stream?.getTracks().forEach((t) => t.stop());
    const seconds = (performance.now() - startedAt) / 1000;
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    recorder = null; stream = null;
    els.rec.setAttribute('aria-pressed', 'false');
    els.rec.textContent = 'Hold to speak';
    if (seconds < 0.4) { setStatus('Too short. Hold the button while you speak.', true); return; }
    try { await sendWav(await toWav16k(await blob.arrayBuffer())); } catch (e) { setStatus(e.message || 'Could not read that recording.', true); }
  };
  startedAt = performance.now();
  recorder.start();
  els.rec.setAttribute('aria-pressed', 'true');
  els.rec.textContent = 'Listening... release to send';
  setStatus('Speak now.');
  setTimeout(() => { if (recorder?.state === 'recording') stopRecording(); }, MAX_SECONDS * 1000 - 500);
}
function stopRecording() { if (recorder?.state === 'recording') recorder.stop(); }

els.rec.addEventListener('pointerdown', (e) => { e.preventDefault(); startRecording(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => els.rec.addEventListener(ev, stopRecording));
els.rec.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startRecording(); } });
els.rec.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stopRecording(); });

els.file.addEventListener('change', async () => {
  const f = els.file.files?.[0];
  els.file.value = '';
  if (!f) return;
  try { await sendWav(await toWav16k(await f.arrayBuffer())); } catch (e) { setStatus(e.message || 'Could not read that audio file.', true); }
});

els.reset.addEventListener('click', () => {
  requestCounter++; busy = false; lastBill = null;
  els.result.classList.add('hidden');
  setStatus('Ready.');
  syncControls();
});

// ---- readback: starts from a click, mic locked while audio plays, text fallback on failure ----
function speechText(bill) {
  const parts = bill.lines.map((l) => `${l.qty} ${UNIT_HI[l.unit] || l.unit} ${l.name}`);
  return `आपका ऑर्डर: ${parts.join(', ')}। कुल ${Math.round(bill.total)} रुपये।`.slice(0, 300);
}
els.speak.addEventListener('click', async () => {
  if (!lastBill?.lines.length || speaking) return;
  speaking = true; syncControls();
  els.speakNote.textContent = 'Reading the bill...';
  try {
    const res = await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: speechText(lastBill) }) });
    if (!res.ok) throw new Error('tts');
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    await new Promise((resolve, reject) => { audio.onended = resolve; audio.onerror = reject; audio.play().catch(reject); });
    URL.revokeObjectURL(url);
    els.speakNote.textContent = '';
  } catch {
    els.speakNote.textContent = 'Voice readback is unavailable right now. The bill above is still correct.';
  } finally {
    speaking = false; syncControls();
  }
});

syncControls();
