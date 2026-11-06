# Benchmark results (SIMULATED noise)

> Noise levels are SIMULATED: synthetic or recorded speech + seeded noise bed + 8 kHz G.711 telephony chain. Not real phone calls.

Model: `prisma-v3.0`, language: `hi-IN`, clips from: `dir`, seed: 42, bed: street

| Level | n orders | n failed | items | Precision | Recall | Item F1 | F1 95% CI | STT-attributable misses | WER (n) | Sample rate |
|---|---|---|---|---|---|---|---|---|---|---|
| clean (16 kHz, unprocessed) | 10 | 0 | 21 | 1 | 1 | **1** | 1 to 1 | 0 | 0.438 (7) | 16000 Hz |
| 10 dB SNR + telephony | 10 | 0 | 21 | 1 | 0.905 | **0.95** | 0.865 to 1 | 2 | 0.413 (7) | 8000 Hz |
| 0 dB SNR + telephony | 10 | 0 | 21 | 0.714 | 0.238 | **0.357** | 0.095 to 0.545 | 16 | 0.581 (5) | 8000 Hz |

Item F1 counts an item as correct only when item, quantity and unit all match. "Not understood" items count as missed. WER is secondary and shown only where reference and transcript use the same script.

## Failure gallery

- **o01** @ 0: said "bhaiya ek kilo chawal aur do packet maggi"
  - transcript: 
  - expected: chawal 1 kg, maggi 2 packet
  - got: (nothing understood)
- **o03** @ 0: said "teen packet biscuit aur ek packet namak"
  - transcript: 3 packet biscuit और 1 packet नमकीन।
  - expected: biscuit 3 packet, namak 1 packet
  - got: biscuit 3 packet, namkeen 1 packet
- **o10** @ 0: said "chai patti do sau gram aur cheeni ek kilo"
  - transcript: गाय, बकरी, देसी गाय और गिनी etc.
  - expected: chai_patti 200 gram, cheeni 1 kg
  - got: (nothing understood)
