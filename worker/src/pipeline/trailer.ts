// Everything after planning: voice, shoot, edit, sound, render. Voice runs first so each shot is
// filmed for exactly as long as its narration line.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeLoudness } from "../audio/ffmpeg";
import { mixSoundtrack } from "../audio/mix";
import { synthScore } from "../audio/music";
import { writeWav } from "../audio/wav";
import type { StoredCapture } from "../capture/types";
import { hostLabel } from "../lib/url";
import { NARRATORS, narratorFor, type CaptionStyle, type TrailerOptions } from "../options";
import { fallbackPlan } from "../planner/fallback";
import type { Plan } from "../planner/schema";
import { validatePlan } from "../planner/validate";
import { openStage, recordPlan } from "../record/recorder";
import { renderThumbnails, renderTrailer, type RenderOutputs } from "../render/render";
import { chooseThumbnail } from "../render/thumbnail";
import { buildTimeline, FPS, shotHolds, toSrt, type Timeline } from "../render/timeline";
import type { ThumbnailProps, TrailerProps, TrailerSegment } from "../render/remotion/types";
import { silentLines, voicePlan, type VoiceLine } from "../voice/deepgram";
import { kokoroLines, kokoroVoiceName } from "../voice/kokoro";

export type TrailerStep = "voice" | "record" | "render";

const EDIT_VERSION = 1;

/** edit.json: everything the render needs, so a job can be re-rendered without new voice or footage. */
interface EditFile {
  version: number;
  url: string;
  duration: number;
  skipped: { index: number; reason: string }[];
  trailer: Omit<TrailerProps, "base">;
  thumbnail: Omit<ThumbnailProps, "base">;
}

async function readEdit(jobDir: string): Promise<EditFile> {
  const edit = JSON.parse(await readFile(path.join(jobDir, "edit.json"), "utf8")) as Partial<EditFile>;
  if (edit.version !== EDIT_VERSION || !edit.trailer || !edit.thumbnail) {
    throw new Error(`${jobDir} has no edit.json this version can re-render. Make the trailer again instead.`);
  }
  return edit as EditFile;
}

/** The thumbnail as the current code would choose it, so re-rendered jobs pick up new looks. */
async function currentThumbnail(jobDir: string, edit: EditFile): Promise<EditFile["thumbnail"]> {
  return { app: edit.thumbnail.app, style: edit.thumbnail.style ?? edit.trailer.style, ...(await chooseThumbnail(jobDir, edit.trailer)) };
}

/** Renders a finished job again from its saved edit and footage. For iterating on the look; the
 *  caption look can be swapped without new voice or filming. */
export async function rerenderTrailer(
  jobDir: string,
  onProgress?: (fraction: number) => void,
  overrides: { captions?: CaptionStyle } = {},
): Promise<RenderOutputs> {
  const edit = await readEdit(jobDir);
  const trailer = overrides.captions ? { ...edit.trailer, captions: overrides.captions } : edit.trailer;
  return renderTrailer(jobDir, trailer, await currentThumbnail(jobDir, edit), onProgress);
}

/** Renders only a finished job's two thumbnails again, in a few seconds. */
export async function rerenderThumbnails(jobDir: string): Promise<string[]> {
  const edit = await readEdit(jobDir);
  return renderThumbnails(jobDir, await currentThumbnail(jobDir, edit));
}

export interface TrailerHooks {
  onStepStart?: (step: TrailerStep, detail: string) => void;
  onStepProgress?: (step: TrailerStep, detail: string) => void;
  onStepDone?: (step: TrailerStep, detail: string) => void;
}

export interface TrailerResult {
  dir: string;
  video: string;
  thumbnails: string[];
  captions: string;
  duration: number;
  shotsFilmed: number;
  shotsSkipped: { index: number; reason: string }[];
  /** The narrator's name, for example Atlas, or "Captions only" when the voice service failed. */
  voice: string;
  /** The plan that was filmed: the one passed in, or the plainer no-AI tour when none of its shots worked. */
  plan: Plan;
  /** What went differently from the order, for the screening room. */
  notes: string[];
}

const toFrames = (seconds: number) => Math.round(seconds * FPS);

function trailerSegments(timeline: Timeline): TrailerSegment[] {
  let from = 0;
  return timeline.segments.map((segment) => {
    const frames = toFrames(segment.start + segment.duration) - from;
    const offset = segment.voiceAt - segment.start;
    const out: TrailerSegment = {
      kind: segment.kind,
      from,
      frames,
      words: segment.line.words.map((w) => ({ text: w.text, start: w.start + offset, end: w.end + offset })),
    };
    if (segment.shot) {
      out.footageStart = segment.shot.footageStart;
      out.actionAt = segment.shot.actionAt;
      out.action = segment.shot.action;
      out.box = segment.shot.box;
      out.punchFrames = toFrames(segment.shot.punch);
      out.title = segment.shot.title;
    }
    from += frames;
    return out;
  });
}

export async function makeTrailer(
  stored: StoredCapture,
  plan: Plan,
  jobDir: string,
  options: TrailerOptions,
  hooks: TrailerHooks = {},
): Promise<TrailerResult> {
  await mkdir(jobDir, { recursive: true });
  const { capture } = stored;
  const notes: string[] = [];

  // Voice, while the app opens for the shoot in the background: the browser launch, page load
  // and the app's own boot happen during the narration instead of after it.
  hooks.onStepStart?.("voice", "The narrator is reading the script");
  const stage = openStage(capture);
  stage.catch(() => {}); // the recorder awaits it, and a failure surfaces there
  let shotPlan = plan;
  let voiced = await voiceOrCaptions(shotPlan, options, (d) => hooks.onStepProgress?.("voice", d));
  hooks.onStepDone?.("voice", voiceDetail(voiced, narratorName(shotPlan, options)));

  // Shoot
  hooks.onStepStart?.("record", "Opening the app for the shoot");
  const onRecordProgress = (d: string) => hooks.onStepProgress?.("record", d);
  let recording = await recordPlan(capture, shotPlan, {
    holds: shotHolds(voiced.lines, shotPlan, options.style),
    outDir: jobDir,
    onProgress: onRecordProgress,
    stage,
  });
  let timeline = buildTimeline(voiced.lines, shotPlan, recording, options.style);
  let filmed = timeline.segments.filter((s) => s.kind === "shot").length;
  if (filmed === 0) {
    // None of the planned shots worked, usually because the page changed after it was mapped. A
    // plainer tour from the same capture (holding on the page, scrolling through its sections)
    // almost never fails, so the person still gets a trailer of their app. The plan's name,
    // tagline, hook, close and gallery judgment describe the page, not the shots, so they stay.
    onRecordProgress("None of the planned shots worked; filming a simpler tour of the page");
    shotPlan = { ...plan, shots: validatePlan(fallbackPlan(capture), capture, options.style).plan.shots };
    voiced = voiced.narrated ? await voiceOrCaptions(shotPlan, options, onRecordProgress) : { lines: silentLines(shotPlan), narrated: false };
    recording = await recordPlan(capture, shotPlan, { holds: shotHolds(voiced.lines, shotPlan, options.style), outDir: jobDir, onProgress: onRecordProgress });
    timeline = buildTimeline(voiced.lines, shotPlan, recording, options.style);
    filmed = timeline.segments.filter((s) => s.kind === "shot").length;
    notes.push("None of the planned shots could be filmed, so this is a simpler tour of the page.");
  }
  if (filmed === 0) throw new Error("None of the shots could be filmed on this page.");
  if (!voiced.narrated) notes.unshift("The narrator could not be reached, so this trailer has captions and music only.");
  else if (voiced.backup) notes.unshift(`The usual narrator could not be reached, so ${voiced.backup}, a backup voice, read this trailer.`);
  hooks.onStepDone?.(
    "record",
    `${filmed} of ${shotPlan.shots.length} shots filmed${timeline.skipped.length ? `, ${timeline.skipped.length} skipped` : ""}`,
  );

  // Sound and cut
  hooks.onStepStart?.("render", "Scoring and mixing the soundtrack");
  const score = synthScore(timeline.duration, shotPlan.mood, {
    titleEnd: timeline.titleEnd,
    endStart: timeline.endStart,
    clicks: timeline.clicks,
    hits: timeline.hits,
    hype: options.style === "hype",
  });
  // With no narrator there is nothing to duck the music under.
  const mix = mixSoundtrack(
    timeline.duration,
    voiced.narrated ? timeline.segments.map((s) => ({ pcm: s.line.pcm, at: s.voiceAt })) : [],
    score,
  );
  const raw = path.join(jobDir, "soundtrack-raw.wav");
  await writeFile(raw, writeWav(mix));
  await normalizeLoudness(raw, path.join(jobDir, "soundtrack.wav"));

  hooks.onStepProgress?.("render", "Cutting the trailer");
  const app = { name: shotPlan.appName, tagline: shotPlan.tagline, cta: shotPlan.cta, host: hostLabel(capture.finalUrl) };
  const segments = trailerSegments(timeline);
  const durationInFrames = segments.reduce((a, s) => a + s.frames, 0);
  const trailer: EditFile["trailer"] = {
    fps: FPS,
    durationInFrames,
    app,
    segments,
    frames: recording.frames,
    soundtrack: "soundtrack.wav",
    style: options.style,
    // Without a narrator the captions carry the script, so they cannot be switched off.
    captions: !voiced.narrated && options.captions === "off" ? "boxed" : options.captions,
  };

  // The edit is saved before rendering, so a failed or restyled render can be redone from it.
  const edit: EditFile = {
    version: EDIT_VERSION,
    url: capture.finalUrl,
    duration: timeline.duration,
    skipped: timeline.skipped,
    trailer,
    thumbnail: { app, style: options.style, ...(await chooseThumbnail(jobDir, trailer)) },
  };
  await writeFile(path.join(jobDir, "edit.json"), JSON.stringify(edit, null, 2));
  const captions = path.join(jobDir, "captions.srt");
  await writeFile(captions, toSrt(timeline));

  const outputs = await renderTrailer(jobDir, edit.trailer, edit.thumbnail, (fraction) =>
    hooks.onStepProgress?.("render", `Rendering ${Math.round(fraction * 100)}%`),
  );
  hooks.onStepDone?.("render", `${timeline.duration.toFixed(1)} s trailer, captions and two thumbnails`);

  return {
    dir: jobDir,
    video: outputs.video,
    thumbnails: outputs.thumbnails,
    captions,
    duration: timeline.duration,
    shotsFilmed: filmed,
    shotsSkipped: timeline.skipped,
    voice: !voiced.narrated ? "Captions only" : (voiced.backup ?? narratorName(shotPlan, options)),
    plan: shotPlan,
    notes,
  };
}

const narratorName = (plan: Plan, options: TrailerOptions) => NARRATORS[narratorFor(options.voice, plan.mood)].name;

interface Voiced {
  lines: VoiceLine[];
  /** False when no voice could be had and the lines are captions only. */
  narrated: boolean;
  /** The backup narrator's name, when Deepgram failed and Kokoro read the script instead. */
  backup?: string;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Voices the plan with Deepgram; if it cannot be reached (an outage, a spent account, no key),
 *  with Kokoro on the worker; and if that fails too, the lines become captions timed for reading,
 *  so the trailer still ships with music. Errors go to the worker's log, not the page. */
async function voiceOrCaptions(plan: Plan, options: TrailerOptions, onProgress: (detail: string) => void): Promise<Voiced> {
  try {
    return { lines: await voicePlan(plan, options.voice, onProgress), narrated: true };
  } catch (err) {
    console.error(`Deepgram narration failed, trying the Kokoro backup voice: ${message(err)}`);
  }
  try {
    onProgress("The usual narrator is unavailable; the backup voice is reading the script");
    return { lines: await kokoroLines(plan, options.voice, onProgress), narrated: true, backup: kokoroVoiceName(options.voice, plan.mood) };
  } catch (err) {
    console.error(`Kokoro narration failed too, making a captions-only trailer: ${message(err)}`);
    return { lines: silentLines(plan), narrated: false };
  }
}

function voiceDetail(voiced: Voiced, narrator: string): string {
  const seconds = voiced.lines.reduce((a, l) => a + l.duration, 0).toFixed(1);
  if (!voiced.narrated) return `The narrator could not be reached, so the ${voiced.lines.length} lines go on as captions`;
  return `${voiced.backup ? `${voiced.backup}, the backup voice,` : narrator} read ${voiced.lines.length} lines, ${seconds} s of narration`;
}
