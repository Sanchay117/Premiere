import { loadFont as loadCourier } from "@remotion/google-fonts/CourierPrime";
import { loadFont as loadGothic } from "@remotion/google-fonts/LeagueGothic";
import { loadFont as loadFranklin } from "@remotion/google-fonts/LibreFranklin";
import { loadFont as loadMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadScript } from "@remotion/google-fonts/Yellowtail";

// The site's faces: a poster gothic for headlines, a sign painter's script for the neon, Franklin
// for reading, Courier for anything typed, a marker for tape labels.
export const gothic = loadGothic("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const script = loadScript("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const sans = loadFranklin("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadCourier("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
export const marker = loadMarker("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const C = {
  ink: "#07080c",
  ink2: "#0d1020",
  cream: "#f3ead8",
  creamDim: "rgba(243,234,216,0.62)",
  amber: "#ffb547",
  glow: "#ffe3b0",
  red: "#c8372d",
  paper: "#efe3c6",
  paperInk: "#241a10",
  teal: "#0f4a4f",
} as const;

export const W = 1920;
export const H = 1080;
export const FPS = 30;
/** The score runs at 120 bpm: a beat is half a second, a bar two. */
export const BEAT = 0.5;

/** A small seeded random generator, so every render of a scene comes out the same. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Text that glows like light on a screen. */
export const screenGlow = "0 0 18px rgba(255,214,150,0.35), 0 0 60px rgba(255,181,71,0.18)";
/** Neon tube lettering, as on the site. */
export const neonGlow = "0 0 2px #fff6e0, 0 0 8px rgba(255,181,71,0.95), 0 0 22px rgba(255,140,50,0.7), 0 0 48px rgba(255,120,40,0.45), 0 0 90px rgba(255,120,40,0.25)";
