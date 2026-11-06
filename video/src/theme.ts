import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadDeva } from "@remotion/google-fonts/NotoSansDevanagari";

export const display = loadDisplay("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
export const deva = loadDeva("normal", { weights: ["400", "700"], subsets: ["devanagari"] }).fontFamily;

export const C = {
  bg: "#0c0b10",
  bg2: "#15121c",
  panel: "#18161f",
  line: "#2c2935",
  text: "#f6f3ee",
  muted: "#9d99a9",
  orange: "#ff7a1a", // the one accent
  orangeSoft: "#ffa05c",
  green: "#3ddc84",
  red: "#ff5c61",
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
