// Turns narration lengths and the recording into a timed edit: a title card, one segment per shot
// that was filmed, and an end card. Durations follow the voice, so the cut never outruns or
// trails the narrator. Also builds the caption words and the SRT file.

import type { Plan, Shot } from "../planner/schema";
import type { Recording } from "../record/recorder";
import type { VoiceLine } from "../voice/deepgram";

export const FPS = 30;

const TITLE = { voiceAt: 0.5, tail: 0.6, min: 3.0 };
const SHOT = { voiceAt: 0.2, tail: 0.45, min: 2.6 };
const END = { voiceAt: 0.45, tail: 1.6, min: 3.8 };

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
    /** Seconds after the segment start when the action happens. */
    actionAt: number;
    box: Box | null;
  };
}

export interface Timeline {
  segments: TimelineSegment[];
  duration: number;
  titleEnd: number;
  endStart: number;
  /** Trailer seconds of each click or type action, for sound effects. */
  clicks: number[];
  skipped: { index: number; reason: string }[];
}

export function shotDuration(line: VoiceLine): number {
  return Math.max(SHOT.min, SHOT.voiceAt + line.duration + SHOT.tail);
}

/** Seconds of footage the recorder should film for each shot. */
export function shotHolds(lines: VoiceLine[], plan: Plan): number[] {
  return plan.shots.map((_, i) => {
    const line = lines.find((l) => l.key === `shot-${i + 1}`);
    return (line ? shotDuration(line) : SHOT.min) + 0.35;
  });
}

export function buildTimeline(lines: VoiceLine[], plan: Plan, recording: Recording): Timeline {
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const hook = byKey.get("hook");
  const close = byKey.get("close");
  if (!hook || !close) throw new Error("Narration is missing the hook or the close.");

  const segments: TimelineSegment[] = [];
  const skipped: Timeline["skipped"] = [];
  const clicks: number[] = [];
  let t = 0;

  const titleDuration = Math.max(TITLE.min, TITLE.voiceAt + hook.duration + TITLE.tail);
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
    const duration = Math.min(shotDuration(line), Math.max(SHOT.min, available));
    const actionAt = Math.max(0, rec.actionAt - rec.start);
    segments.push({
      kind: "shot",
      start: t,
      duration,
      voiceAt: t + SHOT.voiceAt,
      line,
      shot: { index: rec.index, action: shot.action, footageStart: rec.start, actionAt, box: rec.box },
    });
    if (shot.action === "click" || shot.action === "type") clicks.push(t + actionAt);
    t += duration;
  }

  const endStart = t;
  const endDuration = Math.max(END.min, END.voiceAt + close.duration + END.tail);
  segments.push({ kind: "end", start: t, duration: endDuration, voiceAt: t + END.voiceAt, line: close });
  t += endDuration;

  return { segments, duration: t, titleEnd, endStart, clicks, skipped };
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
