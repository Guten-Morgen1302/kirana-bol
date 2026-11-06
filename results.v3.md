# Benchmark results (SIMULATED noise)

> Noise levels are SIMULATED: synthetic or recorded speech + seeded noise bed + 8 kHz G.711 telephony chain. Not real phone calls.

Model: `prisma-v3.0`, language: `hi-IN`, clips from: `tts`, seed: 42, bed: street

| Level | n orders | n failed | items | Precision | Recall | Item F1 | F1 95% CI | STT-attributable misses | WER (n) | Sample rate |
|---|---|---|---|---|---|---|---|---|---|---|
| clean (16 kHz, unprocessed) | 30 | 0 | 61 | 0.984 | 0.984 | **0.984** | 0.949 to 1 | 0 | 0.232 (28) | 16000 Hz |
| 10 dB SNR + telephony | 30 | 0 | 61 | 1 | 0.984 | **0.992** | 0.974 to 1 | 1 | 0.275 (25) | 8000 Hz |
| 0 dB SNR + telephony | 30 | 0 | 61 | 0.964 | 0.869 | **0.914** | 0.855 to 0.96 | 8 | 0.312 (22) | 8000 Hz |

Item F1 counts an item as correct only when item, quantity and unit all match. "Not understood" items count as missed. WER is secondary and shown only where reference and transcript use the same script.

## Failure gallery

- **o21** @ clean: said "teen sabun aur ek surf packet"
  - transcript: साबुन और एक surf packet।
  - expected: sabun 3 piece, surf 1 packet
  - got: sabun 1 piece, surf 1 packet
- **o12** @ 0: said "ek kilo suji aur ek kilo poha"
  - transcript: 1 किलो चीनी और 1 किलो पोहा।
  - expected: suji 1 kg, poha 1 kg
  - got: cheeni 1 kg, poha 1 kg
- **o26** @ 0: said "teen kilo chawal aur do kilo aata"
  - transcript: 3 किलो चावल और 2 किलो आलू।
  - expected: chawal 3 kg, atta 2 kg
  - got: chawal 3 kg, aloo 2 kg
