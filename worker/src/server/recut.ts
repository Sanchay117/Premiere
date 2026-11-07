// A recut: the person's edits to a finished trailer (its spoken lines, its punch titles, the
// narrator and the caption look), checked here before a new take is cut from the first take's
// footage. Nothing is filmed again, and Claude is not called.

import { asSentence } from "../lib/text";
import { parseOptions, type TrailerOptions } from "../options";
import { planWords, type Plan } from "../planner/schema";
import { cleanPunch, WORDS_HARD_BY_LENGTH } from "../planner/validate";

/** Most characters in one edited line. */
export const LINE_MAX = 240;

export type Recut = { ok: true; plan: Plan; options: TrailerOptions } | { ok: false; error: string };

/** One line of copy as typed into the screening room: printable, one line, no em dashes. */
function cleanLine(raw: string): string {
  const printable = [...raw].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("");
  return asSentence(printable.slice(0, LINE_MAX));
}

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Applies a recut to the first take's plan. The body may carry hook, close, shots (one
 * { narration, punch } per shot, in order), voice and captions; anything left out stays as it was.
 * The cut, running time and screen stay the first take's, since the footage was filmed for them.
 */
export function applyRecut(plan: Plan, options: TrailerOptions, body: Record<string, unknown>): Recut {
  const edits = Array.isArray(body.shots) ? (body.shots as unknown[]) : [];
  if (edits.length > plan.shots.length) return { ok: false, error: "That script has more shots than the first take filmed." };

  const line = (label: string, value: unknown, current: string): string | { error: string } => {
    const raw = text(value);
    if (raw === undefined) return current;
    const cleaned = cleanLine(raw);
    return cleaned ? cleaned : { error: `${label} is empty. Every line needs a few words.` };
  };

  const hook = line("The opening line", body.hook, plan.hook);
  if (typeof hook !== "string") return { ok: false, ...hook };
  const close = line("The closing line", body.close, plan.close);
  if (typeof close !== "string") return { ok: false, ...close };

  const shots: Plan["shots"] = [];
  for (const [i, shot] of plan.shots.entries()) {
    const edit = (edits[i] && typeof edits[i] === "object" ? edits[i] : {}) as Record<string, unknown>;
    const narration = line(`Shot ${i + 1}'s line`, edit.narration, shot.narration);
    if (typeof narration !== "string") return { ok: false, ...narration };
    // An emptied punch title keeps the first take's: the hype cut shows one before every shot.
    const punch = text(edit.punch) !== undefined ? cleanPunch(text(edit.punch)) || shot.punch : shot.punch;
    shots.push({ ...shot, narration, punch });
  }

  const next: Plan = { ...plan, hook, close, shots };
  const words = planWords(next);
  const limit = WORDS_HARD_BY_LENGTH[options.length].max;
  if (words > limit) {
    return { ok: false, error: `That script runs ${words} words. A ${options.length} second trailer holds at most ${limit}; trim a line or two.` };
  }

  // The narrator and the caption look may change; an unknown value keeps the first take's.
  const nextOptions = parseOptions({
    ...options,
    voice: text(body.voice) ?? options.voice,
    captions: text(body.captions) ?? options.captions,
  });
  if (text(body.voice) && nextOptions.voice !== body.voice) nextOptions.voice = options.voice;
  if (text(body.captions) && nextOptions.captions !== body.captions) nextOptions.captions = options.captions;

  const sameScript =
    next.hook === plan.hook &&
    next.close === plan.close &&
    next.shots.every((s, i) => s.narration === plan.shots[i]!.narration && s.punch === plan.shots[i]!.punch);
  if (sameScript && nextOptions.voice === options.voice && nextOptions.captions === options.captions) {
    return { ok: false, error: "Nothing changed. Edit a line, or pick another narrator or caption look." };
  }
  return { ok: true, plan: next, options: nextOptions };
}

