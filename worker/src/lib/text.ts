// Text helpers for narration, captions and title cards.
// Project rule: no em dashes in anything we generate, so every script passes through sanitizeScript.

// Built from char codes so the source itself stays free of the characters it removes.
export const EM_DASH = String.fromCharCode(0x2014);
const HORIZONTAL_BAR = String.fromCharCode(0x2015);
const EM_DASHES = new RegExp(`\\s*[${EM_DASH}${HORIZONTAL_BAR}]\\s*`, "g");
const EM_DASH_CHARS = new RegExp(`[${EM_DASH}${HORIZONTAL_BAR}]`, "g");

/** Tidies generated or scraped copy: replaces em dashes with commas and normalizes spacing. */
export function sanitizeScript(text: string): string {
  return text
    .replace(EM_DASHES, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/^[\s,;:]+/, "")
    .replace(/[\s,;:]+$/, "")
    .trim();
}

export function countEmDashes(text: string): number {
  return (text.match(EM_DASH_CHARS) ?? []).length;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Cuts text to at most `max` words, dropping trailing punctuation left by the cut. */
export function truncateWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return words.slice(0, max).join(" ").replace(/[,;:.!?]+$/, "");
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 1);
}

export function firstSentence(text: string): string {
  return splitSentences(text)[0] ?? text.trim();
}

/** Makes a line end like a spoken sentence. */
export function asSentence(text: string): string {
  const t = sanitizeScript(text);
  if (!t) return t;
  const capped = t[0]!.toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
