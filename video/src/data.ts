// Every number here is copied from the real result files in the repo root:
// results.json (v2.5, TTS), results.v3.json (v3.0, TTS), results.human.v2.json / results.human.v3.json (own voice, n=10).
export const TTS = {
  levels: ["clean", "10 dB", "0 dB"],
  v25: { f1: [1.0, 0.983, 0.827], ci: [[1, 1], [0.957, 1], [0.737, 0.899]], miss: [0, 2, 18] },
  v30: { f1: [0.984, 0.992, 0.914], ci: [[0.949, 1], [0.974, 1], [0.855, 0.96]], miss: [0, 1, 8] },
  orders: 30,
  items: 61,
};

export const HUMAN = {
  levels: ["as recorded", "+10 dB", "+0 dB"],
  v25: { f1: [1.0, 0.976, 0.533], ci: [[1, 1], [0.919, 1], [0.308, 0.722]] },
  v30: { f1: [1.0, 0.95, 0.357], ci: [[1, 1], [0.865, 1], [0.095, 0.545]] },
  orders: 10,
  items: 21,
};

export const FAILS = [
  { id: "o05", level: "0 dB", model: "v2.5", said: "ek litre doodh aur ek dozen ande", heard: "एक मीटर दूर और एक दर्जन अंदर", got: "nothing understood" },
  { id: "o12", level: "0 dB", model: "v2.5", said: "ek kilo suji aur ek kilo poha", heard: "एक किलो चीज़ें और एक किलो कोको", got: "nothing understood" },
  { id: "o13", level: "0 dB", model: "v3.0", said: "do packet chips aur ek packet namkeen", heard: "वो काफ़ी खुश और एक achievement थी", got: "nothing understood" },
];

export const REPO = "github.com/Guten-Morgen1302/kirana-bol";
