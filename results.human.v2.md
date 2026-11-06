# Benchmark results (SIMULATED noise)

> Noise levels are SIMULATED: synthetic or recorded speech + seeded noise bed + 8 kHz G.711 telephony chain. Not real phone calls.

Model: `prisma-v2.5`, language: `hi-IN`, clips from: `dir`, seed: 42, bed: street

| Level | n orders | n failed | items | Precision | Recall | Item F1 | F1 95% CI | STT-attributable misses | WER (n) | Sample rate |
|---|---|---|---|---|---|---|---|---|---|---|
| clean (16 kHz, unprocessed) | 10 | 0 | 21 | 1 | 1 | **1** | 1 to 1 | 0 | 0.163 (10) | 16000 Hz |
| 10 dB SNR + telephony | 10 | 0 | 21 | 1 | 0.952 | **0.976** | 0.919 to 1 | 1 | 0.186 (10) | 8000 Hz |
| 0 dB SNR + telephony | 10 | 0 | 21 | 0.889 | 0.381 | **0.533** | 0.308 to 0.722 | 12 | 0.586 (10) | 8000 Hz |

Item F1 counts an item as correct only when item, quantity and unit all match. "Not understood" items count as missed. WER is secondary and shown only where reference and transcript use the same script.

## Failure gallery

- **o01** @ 0: said "bhaiya ek kilo chawal aur do packet maggi"
  - transcript: यह 17 सावन और 2 पैकेज है
  - expected: chawal 1 kg, maggi 2 packet
  - got: (nothing understood)
- **o10** @ 0: said "chai patti do sau gram aur cheeni ek kilo"
  - transcript: चाय पत्ती दो 3 और चीनी इस्ति
  - expected: chai_patti 200 gram, cheeni 1 kg
  - got: chai_patti 2 packet, cheeni 1 kg
- **o12** @ 0: said "ek kilo suji aur ek kilo poha"
  - transcript: 30 किलो पीजी और एक
  - expected: suji 1 kg, poha 1 kg
  - got: (nothing understood)
