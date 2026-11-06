"""Hinglish voice-over for the Kirana Bol demo via Gemini TTS, one clip per scene -> out/vo/NN.wav + timing.json.

  python make_vo.py            # all lines
  python make_vo.py 8 9        # only re-generate lines 8 and 9
  python make_vo.py --check    # transcribe every wav with Gemini and print it next to the intended text

Each line: (scene start seconds on the video timeline, max seconds it may take, text).
Hindi is written in Devanagari and English in Latin so the TTS pronounces both naturally.
No style prompt: this model reads style text aloud.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import wave
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
OUT = HERE / "out" / "vo"
MODEL = os.getenv("VO_MODEL", "gemini-3.8-flash-tts")
VOICE = os.getenv("VO_VOICE", "Fenrir")
CHECK_MODEL = os.getenv("VO_CHECK_MODEL", "gemini-3.8-flash")

# Scene starts (s): 0, 6, 10.5, 18.5, 32.5, 46.5, 60.5, 71.5, 85.5, 99.5, 110.5, 120.5   end 129.5
LINES: list[tuple[float, float, str]] = [
    (0.3, 5.4, "एक किलो चावल और दो पैकेट मैगी... शोर में ये order खो गया."),
    (6.3, 4.0, "Kirana Bol. शोर में भी order सुनो."),
    (10.8, 7.4, "Speech AI ज़्यादातर clean audio पर test होता है. पर दुकान का order... खराब phone line पर आता है."),
    (18.8, 13.4, "बस बोलो, या recorded clip upload करो. एक Hinglish sentence से bill बन जाता है. Item, quantity, unit, और price."),
    (32.8, 13.4, "अब मेरी अपनी recordings को upload करता हूँ. पहली में हर item और quantity सही. दूसरी में एक शब्द समझ नहीं आया, तो वो not understood में गया. Guess नहीं किया."),
    (46.8, 13.4, "Browser से एक server, फिर Gnani Prisma. Parser सिर्फ code है, कोई LLM नहीं. तो हर गलती trace हो सकती है."),
    (60.8, 10.4, "Test: तीस invented orders, तीन noise levels. Noise simulated है, और आठ kilohertz phone codec. Real call नहीं."),
    (71.8, 13.4, "TTS speech पर: clean में F1 एक. दस dB पर शून्य दशमलव नौ आठ. ज़ीरो dB पर शून्य दशमलव आठ तीन. v3.0 थोड़ा बेहतर दिखा."),
    (85.8, 13.4, "फिर मैंने अपनी असली आवाज़ में दस orders record किए. Twist: v3.0 यहाँ बेहतर नहीं निकला. Sample छोटा है, तो कोई winner नहीं."),
    (99.8, 10.4, "ये असली failures हैं. एक लीटर दूध की जगह सुना, एक मीटर दूर. और v3.0 ने तो पूरा अलग वाक्य बना दिया. फिर भी bill में कुछ गलत नहीं गया."),
    (110.8, 9.4, "सत्तावन tests पास. Real run ने दो parser bugs पकड़े, और वो fix हुए. और ईमानदारी से: noise simulated है, कोई best model का claim नहीं."),
    (120.8, 8.4, "Kirana Bol. Code और results GitHub पर. ज्ञानी Prisma से बना. Voice में Timbre."),
]


def write_wav(path: Path, pcm: bytes) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)


def tts(client: genai.Client, text: str) -> bytes:
    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))
        ),
    )
    for attempt in range(4):
        try:
            r = client.models.generate_content(model=MODEL, contents=text, config=cfg)
            return r.candidates[0].content.parts[0].inline_data.data
        except Exception as e:  # noqa: BLE001
            print(f"   retry {attempt + 1}: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(6 * (attempt + 1))
    raise SystemExit(f"TTS failed for: {text[:60]}")


def trim_and_fit(src: Path, dst: Path, max_s: float) -> float:
    """Trim silence at both ends; speed up (max 1.25x) if the line would overrun its slot."""
    tmp = dst.with_suffix(".trim.wav")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af",
         "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
         str(tmp)], check=True)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(tmp)]))
    tempo = max(1.0, dur / max_s)
    if tempo > 1.25:
        print(f"   WARNING {dst.name}: {dur:.1f}s for a {max_s}s slot, even 1.25x overruns; shorten the text")
        tempo = 1.25
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"atempo={tempo:.3f}", "-ar", "44100", str(dst)], check=True)
    tmp.unlink()
    return dur / tempo


def generate(only: set[int]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    timing_path = OUT / "timing.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else {}
    for i, (start, max_s, text) in enumerate(LINES, 1):
        if only and i not in only:
            continue
        raw = OUT / f"{i:02d}.raw.wav"
        final = OUT / f"{i:02d}.wav"
        print(f"{i:02d} @ {start:6.1f}s  {text[:70]}")
        write_wav(raw, tts(client, text))
        dur = trim_and_fit(raw, final, max_s)
        raw.unlink()
        timing[f"{i:02d}"] = {"start": start, "dur": round(dur, 2), "max": max_s}
        print(f"   -> {dur:.1f}s (slot {max_s}s)")
        timing_path.write_text(json.dumps(timing, indent=1))


def check() -> None:
    """Transcribe each generated wav with Gemini so a human can compare it with the intended line."""
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    for i, (_, _, text) in enumerate(LINES, 1):
        f = OUT / f"{i:02d}.wav"
        if not f.exists():
            continue
        r = client.models.generate_content(
            model=CHECK_MODEL,
            contents=[types.Part.from_bytes(data=f.read_bytes(), mime_type="audio/wav"),
                      "Transcribe this audio exactly. Hindi in Devanagari, English words in Latin. Output only the transcript."])
        print(f"{i:02d} WANT: {text}\n   GOT : {(r.text or '').strip()}\n")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if "--check" in args:
        check()
    else:
        generate({int(a) for a in args})
