import { loadFont as loadSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

// The same type system as the website: Instrument Serif for display, Geist for captions,
// Geist Mono for small labels.
export const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });
export const sans = loadSans("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;

export const COLORS = {
  ink: "#07080c",
  cream: "#f3ead8",
  amber: "#ffb547",
};
