import { loadFont as loadSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadGothic } from "@remotion/google-fonts/LeagueGothic";

// Instrument Serif for walkthrough title cards, League Gothic (a revival of the condensed poster
// gothic on old movie posters) for hype titles and bold captions, Geist for captions, Geist Mono
// for small labels.
export const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });
export const sans = loadSans("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;
export const gothic = loadGothic("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const COLORS = {
  ink: "#07080c",
  cream: "#f3ead8",
  amber: "#ffb547",
};
