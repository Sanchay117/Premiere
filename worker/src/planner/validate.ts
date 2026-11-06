// Checks a plan against the capture it was made from, repairs what it can (drops bad shots,
// cleans the copy) and decides whether the result is good enough to record.

import type { Capture, CapturedElement } from "../capture/types";
import { asSentence, sanitizeScript, truncateWords } from "../lib/text";
import { DEFAULT_OPTIONS, type TrailerStyle } from "../options";
import { appNameFrom, DESTRUCTIVE_TEXT, LOGIN_TEXT } from "./fallback";
import { planWords, WORDS_TARGET, type Plan, type PlanInput, type Shot } from "./schema";

const MIN_SHOTS = 3;
const MAX_SHOTS = 10;
/** Outside this range the trailer would be badly short or long, so the plan is rejected. */
const WORDS_HARD = { min: 60, max: 170 };

export interface Validation {
  plan: Plan;
  issues: string[];
  droppedShots: number;
  words: number;
  usable: boolean;
}

function clickBlockReason(el: CapturedElement): string | null {
  if (el.href && /^(mailto|tel|sms):/i.test(el.href)) return "is a mailto or tel link";
  if (el.external) return "leaves the site";
  if (DESTRUCTIVE_TEXT.test(el.text)) return "looks destructive";
  if (LOGIN_TEXT.test(el.text)) return "opens a login form";
  return null;
}

/** A punch title: at most 4 words and 32 characters, cleaned like the rest of the copy. */
function cleanPunch(text: string | null | undefined): string {
  const s = sanitizeScript(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const short = truncateWords(s, 4);
  return short.length <= 32 ? short : truncateWords(short, 3).slice(0, 32).trim();
}

export function validatePlan(raw: PlanInput, capture: Capture, style: TrailerStyle = DEFAULT_OPTIONS.style): Validation {
  const issues: string[] = [];
  const elements = new Map(capture.elements.map((e) => [e.id, e]));
  const sections = new Set(capture.sections.map((s) => s.id));
  const headings = new Map(capture.sections.map((s) => [s.id, s.heading]));
  const shots: Shot[] = [];

  raw.shots.forEach((rawShot, i) => {
    const n = i + 1;
    const target = rawShot.target?.trim().toLowerCase() || null;
    const el = target ? elements.get(target) : undefined;
    const shot: Shot = { action: rawShot.action, target, text: null, narration: asSentence(rawShot.narration), punch: "" };
    if (!shot.narration) {
      issues.push(`shot ${n}: empty narration, dropped`);
      return;
    }
    switch (rawShot.action) {
      case "click":
      case "hover": {
        if (!el && target && sections.has(target)) {
          // Models sometimes aim at a heading; showing that section is what they meant.
          issues.push(`shot ${n}: ${rawShot.action} on section ${target}, scrolling to it instead`);
          shot.action = "scroll";
          break;
        }
        if (!el) {
          issues.push(`shot ${n}: ${rawShot.action} on unknown element ${target ?? "(none)"}, dropped`);
          return;
        }
        const blocked = rawShot.action === "click" ? clickBlockReason(el) : null;
        if (blocked) {
          issues.push(`shot ${n}: click on ${el.id} "${el.text}" ${blocked}, dropped`);
          return;
        }
        break;
      }
      case "type": {
        if (!el || (el.kind !== "input" && el.kind !== "textarea")) {
          issues.push(`shot ${n}: type into ${target ?? "(none)"}, which is not a text field, dropped`);
          return;
        }
        if (el.sensitive) {
          issues.push(`shot ${n}: type into sensitive field ${el.id}, dropped`);
          return;
        }
        const text = sanitizeScript(rawShot.text ?? "").slice(0, 60);
        if (!text) {
          issues.push(`shot ${n}: type with no text, dropped`);
          return;
        }
        shot.text = text;
        break;
      }
      case "scroll": {
        if (target && !el && !sections.has(target)) {
          issues.push(`shot ${n}: scroll to unknown ${target}, scrolling down instead`);
          shot.target = null;
        }
        break;
      }
      case "wait":
        shot.target = null;
        break;
    }
    // Plans from the fallback or saved before punch titles existed get one from the page itself.
    const label = shot.action === "scroll" ? (shot.target && headings.get(shot.target)) || el?.text : el?.text;
    shot.punch = cleanPunch(rawShot.punch) || cleanPunch(label) || cleanPunch(truncateWords(shot.narration, 3));
    shots.push(shot);
  });

  if (shots.length > MAX_SHOTS) {
    issues.push(`${shots.length} shots, kept the first ${MAX_SHOTS}`);
    shots.length = MAX_SHOTS;
  }

  const plan: Plan = {
    appName: sanitizeScript(raw.appName) || appNameFrom(capture),
    tagline: truncateWords(sanitizeScript(raw.tagline), 10),
    mood: raw.mood,
    hook: asSentence(raw.hook),
    shots,
    close: asSentence(raw.close),
    cta: truncateWords(sanitizeScript(raw.cta), 6) || "Try it now",
    // Only a model that looked at the page can clear it for the public gallery.
    publicSafe: raw.publicSafe === true,
  };

  const words = planWords(plan);
  if (!plan.hook) issues.push("missing hook");
  if (!plan.close) issues.push("missing close");
  if (shots.length < MIN_SHOTS) issues.push(`only ${shots.length} usable shots`);
  const target = WORDS_TARGET[style];
  if (words < target.min || words > target.max) {
    issues.push(`${words} narration words (target ${target.min} to ${target.max})`);
  }
  const usable =
    shots.length >= MIN_SHOTS && words >= WORDS_HARD.min && words <= WORDS_HARD.max && !!plan.hook && !!plan.close;

  return { plan, issues, droppedShots: raw.shots.length - shots.length, words, usable };
}
