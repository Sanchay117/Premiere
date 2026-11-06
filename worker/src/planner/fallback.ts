// The no-AI planner. Used when the API key is missing, the budget is spent, Claude refuses or
// returns something unusable, or PLANNER=fallback. It must always return a watchable plan:
// hold on the hero, hover the main call to action, tour the strongest sections (or the
// controls of a single-screen app), then click in. The script only reuses the page's own copy.

import type { Capture, CapturedElement } from "../capture/types";
import { asSentence, countWords, sanitizeScript, splitSentences } from "../lib/text";
import { hostLabel } from "../lib/url";
import { planWords, WORDS_TARGET, type Plan, type Shot } from "./schema";

const ch = (code: number) => String.fromCharCode(code);
/** " | ", " - ", en dash, em dash, " : ", middle dot or bullet between words of a page title. */
const TITLE_SEPARATOR = new RegExp(`\\s+[|${ch(0x2013)}${ch(0x2014)}:${ch(0xb7)}${ch(0x2022)}-]\\s+`);
/** Arrows, middle dots, bullets, pipes, handles, hashes and copyright signs mark UI text, not prose. */
const UI_SYMBOLS = new RegExp(`[${ch(0x2190)}-${ch(0x21ff)}${ch(0xb7)}${ch(0x2022)}|@#${ch(0xa9)}]|0x[0-9a-f]{3,}|https?://`, "i");
const CTA_TEXT =
  /get started|start|try|sign ?up|join|launch|open (the )?app|create|generate|build|demo|explore|book|request|claim|play|upload|begin|go to app|free|scan|run/i;
export const DESTRUCTIVE_TEXT =
  /log\s?out|sign\s?out|delete|unsubscribe|deactivate|remove account|cancel (my )?(subscription|account|plan)/i;
/** Login buttons lead to credential forms, which make empty footage. */
export const LOGIN_TEXT = /\b(log\s?in|sign\s?in)\b/i;
const DANGLING_END = /\s+(that|which|and|or|but|so|the|a|an|to|of|with|for|in|on|by|your|our|their|its|is|are|from|at|as|while)$/i;
const MAX_LINE_WORDS = 18;
const FILLER = [
  "Here is a closer look at how it works.",
  "Everything sits right on the first screen.",
  "The controls stay simple and close at hand.",
  "Take a moment to look around.",
];

export function appNameFrom(c: Capture): string {
  const site = sanitizeScript(c.siteName);
  if (site && countWords(site) <= 4) return site;
  const first = sanitizeScript(c.title.split(TITLE_SEPARATOR)[0] ?? "");
  if (first && countWords(first) <= 4) return first;
  const label = hostLabel(c.finalUrl).split(".")[0] || "this app";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Page copy that reads well aloud: real words, no tickers, arrows, hashes or links. */
function speakable(text: string, minWords = 4): boolean {
  const s = text.trim();
  const words = countWords(s);
  if (words < minWords || words > 45) return false;
  if (UI_SYMBOLS.test(s)) return false;
  const chars = s.replace(/\s/g, "").length;
  const letters = (s.match(/[a-z]/gi) ?? []).length;
  const digits = (s.match(/\d/g) ?? []).length;
  return chars > 0 && letters / chars >= 0.75 && digits / chars < 0.1;
}

/** Sentences from visible page text that read as prose rather than UI labels. */
function proseFromPage(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n+/)) {
    for (const s of splitSentences(block.trim())) {
      const words = countWords(s);
      const finished = /[.!?]$/.test(s);
      if (/^[A-Z"']/.test(s) && speakable(s, 5) && (finished || words >= 8)) out.push(s);
    }
  }
  return out;
}

/** "HOW FUNDABLE IS YOUR APP?" reads as shouting in captions. */
function sentenceCase(text: string): string {
  return text === text.toUpperCase() && /[A-Z]{3}/.test(text) ? text.charAt(0) + text.slice(1).toLowerCase() : text;
}

/** Shortens copy to at most `max` words, cutting at a clause break when possible. */
function shorten(text: string, max: number): string {
  const full = sanitizeScript(sentenceCase(text));
  const s = full.replace(/[.!?]+$/, "");
  if (countWords(s) <= max) return /[?!]$/.test(full) ? `${s}${full.slice(-1)}` : s;
  let cut = s.split(/\s+/).slice(0, max).join(" ");
  const lastBreak = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(";"), cut.lastIndexOf(":"));
  if (lastBreak > cut.length * 0.4) cut = cut.slice(0, lastBreak);
  while (DANGLING_END.test(cut)) cut = cut.replace(DANGLING_END, "");
  return cut.replace(/[,;:]+$/, "");
}

const line = (text: string, max = MAX_LINE_WORDS) => asSentence(shorten(text, max));

/** The most prominent safe call to action, if the page has one. */
export function primaryCta(c: Capture): CapturedElement | null {
  const name = appNameFrom(c).toLowerCase();
  let best: CapturedElement | null = null;
  let bestScore = -Infinity;
  for (const e of c.elements) {
    if (e.kind !== "button" && e.kind !== "link") continue;
    if (e.external || e.sensitive || DESTRUCTIVE_TEXT.test(e.text) || LOGIN_TEXT.test(e.text)) continue;
    if (e.href && /^(mailto|tel|sms):/i.test(e.href)) continue;
    if (e.text.toLowerCase() === name) continue; // logo link
    const ctaText = CTA_TEXT.test(e.text) && e.text.length <= 40;
    const bigButton = e.kind === "button" && e.box.w * e.box.h >= 9000 && (e.region === "main" || e.region === "other");
    if (!ctaText && !bigButton) continue;
    let score = 0;
    if (ctaText) score += 4;
    if (e.aboveFold) score += 2;
    if (e.kind === "button") score += 1;
    if (e.region === "main" || e.region === "other") score += 1;
    score += Math.min(2, (e.box.w * e.box.h) / 20000);
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

/** Pads a thin script with leftover page copy, or trims a long one, toward the word target. */
function fitWords(plan: Plan, extra: string[]): void {
  let words = planWords(plan);
  for (const shot of plan.shots) {
    if (words >= WORDS_TARGET.walkthrough.min) break;
    const room = MAX_LINE_WORDS - countWords(shot.narration);
    if (room < 5) continue;
    const next = extra.shift();
    if (!next) break;
    shot.narration = `${shot.narration} ${line(next, room)}`;
    words = planWords(plan);
  }
  while (words > WORDS_TARGET.walkthrough.max) {
    const longest = plan.shots.reduce((a, b) => (countWords(b.narration) > countWords(a.narration) ? b : a));
    const n = countWords(longest.narration);
    if (n <= 8) break;
    longest.narration = line(longest.narration, n - 3);
    words = planWords(plan);
  }
}

export function fallbackPlan(c: Capture): Plan {
  const name = appNameFrom(c);
  const hero = c.sections.find((s) => s.level === 1);
  const cta = primaryCta(c);
  const singleScreen = c.pageHeight < c.viewport.height * 1.3;

  const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const seen = new Set<string>();

  // Tagline: a short hero heading, else (below) a short first sentence of the description.
  let tagline = "";
  if (hero && speakable(hero.heading, 2) && countWords(hero.heading) <= 10) {
    tagline = shorten(hero.heading, 10);
    seen.add(keyOf(hero.heading));
  }

  // Speakable copy from the description first, then prose from the page, without repeats.
  const material: string[] = [];
  const candidates = [...splitSentences(c.description).filter((s) => speakable(s)), ...proseFromPage(c.textExcerpt)];
  for (const s of candidates) {
    const key = keyOf(s);
    if (!seen.has(key)) {
      seen.add(key);
      material.push(s);
    }
  }
  if (!tagline && material[0] && countWords(material[0]) <= 10) tagline = shorten(material.shift()!, 10);

  const filler = [...FILLER];
  const nextLine = () => material.shift() ?? filler.shift() ?? "Take a closer look.";
  const shots: Shot[] = [{ action: "wait", target: null, text: null, punch: "", narration: line(nextLine()) }];
  if (cta) shots.push({ action: "hover", target: cta.id, text: null, punch: "", narration: line(nextLine()) });

  if (singleScreen) {
    // Nothing to scroll: show the controls instead.
    const controls = c.elements.filter(
      (e) =>
        e !== cta &&
        e.kind === "button" &&
        !e.external &&
        !DESTRUCTIVE_TEXT.test(e.text) &&
        e.text.length <= 30 &&
        (e.region === "main" || e.region === "other" || e.region === "header"),
    );
    const step = Math.max(1, Math.floor(controls.length / 3));
    for (let i = 0; i < controls.length && shots.length < 5; i += step) {
      shots.push({ action: "hover", target: controls[i]!.id, text: null, punch: "", narration: line(nextLine()) });
    }
  } else {
    const tour = c.sections
      .filter((s) => s.y > c.viewport.height * 0.6)
      .map((s) => {
        const heading = sentenceCase(s.heading);
        const detail = splitSentences(s.text).find((t) => speakable(t));
        if (speakable(heading, 3) && detail) return { id: s.id, narration: `${line(heading, 8)} ${line(detail, 10)}` };
        if (detail) return { id: s.id, narration: line(detail) };
        if (speakable(heading, 3)) return { id: s.id, narration: line(heading) };
        return null;
      })
      .filter((t): t is { id: string; narration: string } => t !== null)
      .slice(0, 3);
    for (const t of tour) shots.push({ action: "scroll", target: t.id, text: null, punch: "", narration: t.narration });
  }
  while (shots.length < 4) {
    shots.push({ action: singleScreen ? "wait" : "scroll", target: null, text: null, punch: "", narration: line(nextLine()) });
  }
  if (cta?.navigates) {
    shots.push({ action: "click", target: cta.id, text: null, punch: "", narration: line(`One click on ${sentenceCase(cta.text)} and you are in`) });
  }

  const plan: Plan = {
    appName: name,
    tagline,
    mood: "energetic",
    hook: asSentence(tagline ? `Meet ${name}. ${asSentence(tagline)}` : `Meet ${name}`),
    shots,
    close: asSentence(`Try ${name} today at ${hostLabel(c.finalUrl)}`),
    cta: "Try it now",
  };
  fitWords(plan, material);
  return plan;
}
