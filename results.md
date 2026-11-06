# Benchmark results (SIMULATED noise)

> Noise levels are SIMULATED: synthetic or recorded speech + seeded noise bed + 8 kHz G.711 telephony chain. Not real phone calls.

Model: `prisma-v2.5`, language: `hi-IN`, clips from: `tts`, seed: 42, bed: street

| Level | n orders | n failed | items | Precision | Recall | Item F1 | F1 95% CI | STT-attributable misses | WER (n) | Sample rate |
|---|---|---|---|---|---|---|---|---|---|---|
| clean (16 kHz, unprocessed) | 30 | 0 | 61 | 1 | 1 | **1** | 1 to 1 | 0 | 0.142 (30) | 16000 Hz |
| 10 dB SNR + telephony | 30 | 0 | 61 | 1 | 0.967 | **0.983** | 0.957 to 1 | 2 | 0.162 (30) | 8000 Hz |
| 0 dB SNR + telephony | 30 | 0 | 61 | 1 | 0.705 | **0.827** | 0.737 to 0.899 | 18 | 0.261 (30) | 8000 Hz |

Item F1 counts an item as correct only when item, quantity and unit all match. "Not understood" items count as missed. WER is secondary and shown only where reference and transcript use the same script.

## Failure gallery

- **o05** @ 0: said "ek litre doodh aur ek dozen ande"
  - transcript: एक मीटर दूर और एक दर्जन अंदर
  - expected: doodh 1 litre, ande 1 dozen
  - got: (nothing understood)
- **o12** @ 0: said "ek kilo suji aur ek kilo poha"
  - transcript: एक किलो चीज़ें और एक किलो कोको
  - expected: suji 1 kg, poha 1 kg
  - got: (nothing understood)
- **o13** @ 0: said "do packet chips aur ek packet namkeen"
  - transcript: 2 पैकेट और एक पैकेट
  - expected: chips 2 packet, namkeen 1 packet
  - got: (nothing understood)
