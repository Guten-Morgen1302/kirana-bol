# YouTube / LinkedIn text

## Title (pick one)
- Hear Indian speech AI break: Hinglish orders on a bad phone line (Gnani Prisma)
- I stress-tested Gnani Prisma with noisy Hinglish orders. Here is where it breaks.

## Description

I built Kirana Bol for the Great Indian AI Internship Challenge by Gnani AI: speak a Hinglish grocery order and the bill builds on screen. Then I measured how Gnani's Prisma speech-to-text model holds up when the audio degrades like a bad phone line.

What I tested: 30 invented orders (61 items) x clean / 10 dB / 0 dB noise, through an 8 kHz telephone codec, on Prisma v2.5 and v3.0. Then 10 orders in my own voice. An item counts only if item + quantity + unit all match.

What I found (the noise is SIMULATED, not real phone calls):
- Both models are fine at 10 dB and break at 0 dB.
- On TTS speech v3.0 looked better at 0 dB; with my real voice it did not (n=10, wide intervals, no winner).
- The parser refuses to guess: wrong transcript, but no wrong bill.

Code, data and method: https://github.com/Guten-Morgen1302/kirana-bol

Chapters
0:00 A real order gets buried
0:06 Kirana Bol
0:10 The gap: clean demos vs a bad line
0:18 Live mic order, bill, readback
0:32 Uploading my own recordings
0:46 How it works
1:00 The test
1:11 Results on TTS speech
1:25 My own voice
1:39 Real failures
1:50 Honest limits
2:00 Links

Built on Gnani AI Prisma (speech to text) and Timbre (text to speech).
#GnaniAI #GreatIndianAIInternshipChallenge
