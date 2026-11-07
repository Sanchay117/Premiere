// Turns narration lengths and the recording into a timed edit: a title card, one segment per shot
// that was filmed, and an end card. Durations follow the voice, so the cut never outruns or
// trails the narrator. Also builds the caption words and the SRT file.

import type { TrailerLength, TrailerStyle } from "../options";
import type { Plan, Shot } from "../planner/schema";
import type { Recording } from "../record/recorder";
import type { VoiceLine } from "../voice/deepgram";

export const FPS = 30;
/** Seconds a hype cut spends on each shot's punch title before its footage. */
export const PUNCH = 1.0;
/** The shortest a punch title gets when a hype cut runs long. */
const PUNCH_MIN = 0.75;

type Card = { voiceAt: number; tail: number; min: number };
const TITLE: Card = { voiceAt: 0.5, tail: 0.6, min: 3.0 };
const SHOT = { voiceAt: 0.2, tail: 0.45, min: 2.6 };
const END: Card = { voiceAt: 0.45, tail: 1.6, min: 3.8 };
/** Extra hold after each line in a hype cut: its scripts are short and quick, and the footage
 *  needs a beat to land before the next title slams in. */
const HYPE_TAIL = 0.4;
/** The most a long hype cut may eat into the pause after each line (0.45 s down to 0.2 s). */
const HYPE_TAIL_MIN = -0.25;
/** Where each running time should land. A hype cut that would run past the ceiling trims its
 *  punch titles and beats evenly; a cut that would come in under the floor lingers longer after
 *  each line, so a lean script still makes a trailer of about the promised length (Opus at low
 *  effort tended to write a 90 word walkthrough, a 33 second cut, when asked for 110). */
const RUNTIME: Record<TrailerLength, { floor: number; ceiling: number }> = {
  45: { floor: 41, ceiling: 46 },
  30: { floor: 27, ceiling: 31 },
  15: { floor: 13, ceiling: 16 },
};
/** The most a short cut adds after each line: a calm tour can rest on a result, a hype cut only
 *  briefly before the next title slams in. */
const STRETCH_MAX: Record<TrailerStyle, number> = { walkthrough: 1.6, hype: 0.7 };

/** How long each punch title runs, and the beat added to (or taken from) the pause after each line. */
export interface Pacing {
  punch: number;
  tail: number;
}

const cardDuration = (card: Card, line: VoiceLine | undefined) => Math.max(card.min, card.voiceAt + (line?.duration ?? 0) + card.tail);

/**
 * The cut's rhythm. A hype cut gets a full second of punch title and a beat after every line,
 * trimmed evenly toward the minimums when the narration would carry it past 46 seconds, so a
 * slow narrator or a seventh shot does not turn a 45 second trailer into 54. A walkthrough has
 * neither. Either cut that would come in under 41 seconds holds each shot a little longer after
 * its line instead. The recorder and the edit both use this, so footage and cut always agree.
 */
export function pacing(lines: VoiceLine[], plan: Plan, style: TrailerStyle = "walkthrough", length: TrailerLength = 45): Pacing {
  const { floor, ceiling } = RUNTIME[length];
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const total = (punch: number, tail: number) =>
    cardDuration(TITLE, byKey.get("hook")) +
    cardDuration(END, byKey.get("close")) +
    plan.shots.reduce((sum, _, i) => {
      const line = byKey.get(`shot-${i + 1}`);
      return sum + punch + (line ? shotDuration(line, tail) : SHOT.min);
    }, 0);
  const base: Pacing = style === "hype" ? { punch: PUNCH, tail: HYPE_TAIL } : { punch: 0, tail: 0 };
  const full = total(base.punch, base.tail);
  const voicedShots = plan.shots.filter((_, i) => byKey.has(`shot-${i + 1}`)).length;
  if (full < floor && voicedShots > 0) {
    return { punch: base.punch, tail: base.tail + Math.min(STRETCH_MAX[style], (floor - full) / voicedShots) };
  }
  if (style !== "hype" || full <= ceiling) return base;
  const tight = total(PUNCH_MIN, HYPE_TAIL_MIN);
  const k = tight >= ceiling ? 1 : (full - ceiling) / (full - tight);
  return { punch: PUNCH - (PUNCH - PUNCH_MIN) * k, tail: HYPE_TAIL - (HYPE_TAIL - HYPE_TAIL_MIN) * k };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TimelineSegment {
  kind: "title" | "shot" | "end";
  /** Seconds from the start of the trailer. */
  start: number;
  duration: number;
  /** When this segment's line starts, in trailer seconds. */
  voiceAt: number;
  line: VoiceLine;
  shot?: {
    index: number;
    action: Shot["action"];
    /** Recording seconds where this segment's footage starts. */
    footageStart: number;
    /** Seconds after the footage starts when the action happens. */
    actionAt: number;
    box: Box | null;
    /** Seconds of punch title before the footage (0 in a walkthrough). */
    punch: number;
    /** The punch title itself. */
    title: string;
  };
}

export interface Timeline {
  segments: TimelineSegment[];
  duration: number;
  titleEnd: number;
  endStart: number;
  /** Trailer seconds of each click or type action, for sound effects. */
  clicks: number[];
  /** Trailer seconds where a punch title slams in, for impacts in the score. */
  hits: number[];
  skipped: { index: number; reason: string }[];
}

/** Seconds of footage a shot gets: its line, the pauses around it and the cut's beat. */
export function shotDuration(line: VoiceLine, tail = 0): number {
  return Math.max(SHOT.min, SHOT.voiceAt + line.duration + SHOT.tail + tail);
}

/** Seconds of footage the recorder should film for each shot. */
export function shotHolds(lines: VoiceLine[], plan: Plan, style: TrailerStyle = "walkthrough", length: TrailerLength = 45): number[] {
  const { tail } = pacing(lines, plan, style, length);
  return plan.shots.map((_, i) => {
    const line = lines.find((l) => l.key === `shot-${i + 1}`);
    return (line ? shotDuration(line, tail) : SHOT.min) + 0.35;
  });
}

export function buildTimeline(lines: VoiceLine[], plan: Plan, recording: Recording, style: TrailerStyle = "walkthrough", length: TrailerLength = 45): Timeline {
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const hook = byKey.get("hook");
  const close = byKey.get("close");
  if (!hook || !close) throw new Error("Narration is missing the hook or the close.");

  const segments: TimelineSegment[] = [];
  const skipped: Timeline["skipped"] = [];
  const clicks: number[] = [];
  const hits: number[] = [];
  const { punch, tail } = pacing(lines, plan, style, length);
  let t = 0;

  const titleDuration = cardDuration(TITLE, hook);
  segments.push({ kind: "title", start: t, duration: titleDuration, voiceAt: t + TITLE.voiceAt, line: hook });
  t += titleDuration;
  const titleEnd = t;

  for (const rec of recording.shots) {
    const shot = plan.shots[rec.index];
    const line = byKey.get(`shot-${rec.index + 1}`);
    if (!shot || !line) continue;
    if (!rec.ok) {
      skipped.push({ index: rec.index, reason: rec.error ?? "failed" });
      continue;
    }
    const available = rec.end - rec.start;
    const footage = Math.min(shotDuration(line, tail), Math.max(SHOT.min, available));
    const actionAt = Math.max(0, rec.actionAt - rec.start);
    segments.push({
      kind: "shot",
      start: t,
      duration: punch + footage,
      voiceAt: t + punch + SHOT.voiceAt,
      line,
      shot: { index: rec.index, action: shot.action, footageStart: rec.start, actionAt, box: rec.box, punch, title: shot.punch },
    });
    if (shot.action === "click" || shot.action === "type") clicks.push(t + punch + actionAt);
    if (punch) hits.push(t);
    t += punch + footage;
  }

  const endStart = t;
  const endDuration = cardDuration(END, close);
  segments.push({ kind: "end", start: t, duration: endDuration, voiceAt: t + END.voiceAt, line: close });
  t += endDuration;

  return { segments, duration: t, titleEnd, endStart, clicks, hits, skipped };
}

function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (v: number, n = 2) => String(v).padStart(n, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/** Splits a line's words into caption chunks of about eight words, breaking after sentence ends
 *  and never leaving a straggler of one to three words on its own. */
function chunkWords<T extends { text: string }>(words: T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  words.forEach((word, i) => {
    current.push(word);
    const remaining = words.length - i - 1;
    const sentenceEnd = /[.!?]$/.test(word.text);
    if ((current.length >= 8 || (sentenceEnd && current.length >= 4)) && (remaining === 0 || remaining > 3)) {
      chunks.push(current);
      current = [];
    }
  });
  if (current.length) chunks.push(current);
  return chunks;
}

/** Captions as SRT, timed to the spoken words, with cues that never overlap. */
export function toSrt(timeline: Timeline): string {
  const cues: { start: number; end: number; text: string }[] = [];
  for (const segment of timeline.segments) {
    for (const chunk of chunkWords(segment.line.words)) {
      cues.push({
        start: segment.voiceAt + chunk[0]!.start,
        end: segment.voiceAt + chunk[chunk.length - 1]!.end + 0.2,
        text: chunk.map((w) => w.text).join(" "),
      });
    }
  }
  return cues
    .map((cue, i) => {
      const next = cues[i + 1];
      const end = next ? Math.min(cue.end, next.start - 0.02) : cue.end;
      return `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(Math.max(cue.start + 0.3, end))}\n${cue.text}\n`;
    })
    .join("\n");
}
