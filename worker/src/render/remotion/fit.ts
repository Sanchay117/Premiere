// Font sizes that fit an app's name into a column without breaking a word. Widths are estimated
// from each letter's rough advance in the display face rather than measured, because a still can
// render before its web font has finished loading, and a measurement against the fallback font
// would be wrong. A flat average per letter (the first version) let wide letters push a name past
// its column: "TLDRAW" broke into "TLDRA" and "W".

export type DisplayFace = "gothic" | "serif";

/** League Gothic capitals, in em. */
const GOTHIC: Record<string, number> = {
  A: 0.4, B: 0.41, C: 0.38, D: 0.41, E: 0.33, F: 0.32, G: 0.4, H: 0.42, I: 0.19, J: 0.25, K: 0.4, L: 0.31, M: 0.53,
  N: 0.43, O: 0.4, P: 0.38, Q: 0.4, R: 0.4, S: 0.36, T: 0.33, U: 0.41, V: 0.39, W: 0.58, X: 0.39, Y: 0.37, Z: 0.32,
};

/** Instrument Serif, mixed case, by class of letter, in em. */
function serifWidth(ch: string): number {
  if (/[ijlt.,:;'!|]/.test(ch)) return 0.26;
  if (/[fr]/.test(ch)) return 0.33;
  if (/[mw]/.test(ch)) return 0.7;
  if (/[MW]/.test(ch)) return 0.85;
  if (/[A-Z]/.test(ch)) return 0.62;
  if (/[0-9]/.test(ch)) return 0.5;
  return 0.46;
}

function charWidth(ch: string, face: DisplayFace): number {
  if (ch === " ") return face === "gothic" ? 0.17 : 0.24;
  if (face === "serif") return serifWidth(ch);
  return GOTHIC[ch.toUpperCase()] ?? (/[0-9]/.test(ch) ? 0.36 : 0.3);
}

/** Estimated width of a line of text, in em. */
export function emWidth(text: string, face: DisplayFace): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch, face);
  return width;
}

/** The largest size, up to `max`, at which the name fits `width` pixels: on one line when it
 *  stays big there (always, with `wrap` off), otherwise wrapped between words with its longest
 *  word fitting. A single long word gets smaller rather than broken. */
export function fitTitle(text: string, face: DisplayFace, width: number, max: number, wrap = true): number {
  const margin = 0.94;
  const name = text.trim() || " ";
  const oneLine = (width / emWidth(name, face)) * margin;
  const words = name.split(/\s+/);
  if (!wrap || words.length === 1 || oneLine >= max * 0.6) return Math.round(Math.min(max, oneLine));
  const longest = Math.max(...words.map((w) => emWidth(w, face)));
  return Math.round(Math.min(max, (width / longest) * margin));
}
