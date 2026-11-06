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
import type { Plan } from "../planner/schema";
import { recordPlan } from "../record/recorder";
import { renderTrailer, type RenderOutputs } from "../render/render";
import { buildTimeline, FPS, shotHolds, toSrt, type Timeline } from "../render/timeline";
import type { ThumbnailProps, TrailerProps, TrailerSegment } from "../render/remotion/types";
import { voicePlan } from "../voice/deepgram";

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

/** Renders a finished job again from its saved edit and footage. For iterating on the look; the
 *  caption look can be swapped without new voice or filming. */
export async function rerenderTrailer(
  jobDir: string,
  onProgress?: (fraction: number) => void,
  overrides: { captions?: CaptionStyle } = {},
): Promise<RenderOutputs> {
  const edit = JSON.parse(await readFile(path.join(jobDir, "edit.json"), "utf8")) as Partial<EditFile>;
  if (edit.version !== EDIT_VERSION || !edit.trailer || !edit.thumbnail) {
    throw new Error(`${jobDir} has no edit.json this version can re-render. Make the trailer again instead.`);
  }
  const trailer = overrides.captions ? { ...edit.trailer, captions: overrides.captions } : edit.trailer;
  const thumbnail = { ...edit.thumbnail, style: edit.thumbnail.style ?? edit.trailer.style };
  return renderTrailer(jobDir, trailer, thumbnail, onProgress);
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
  /** The narrator's name, for example Atlas. */
  voice: string;
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

  // Voice
  hooks.onStepStart?.("voice", "The narrator is reading the script");
  const narrator = NARRATORS[narratorFor(options.voice, plan.mood)];
  const lines = await voicePlan(plan, options.voice, (d) => hooks.onStepProgress?.("voice", d));
  const totalVoice = lines.reduce((a, l) => a + l.duration, 0);
  hooks.onStepDone?.("voice", `${narrator.name} read ${lines.length} lines, ${totalVoice.toFixed(1)} s of narration`);

  // Shoot
  hooks.onStepStart?.("record", "Opening the app for the shoot");
  const recording = await recordPlan(capture, plan, {
    holds: shotHolds(lines, plan, options.style),
    outDir: jobDir,
    onProgress: (d) => hooks.onStepProgress?.("record", d),
  });
  const timeline = buildTimeline(lines, plan, recording, options.style);
  const filmed = timeline.segments.filter((s) => s.kind === "shot").length;
  if (filmed === 0) throw new Error("None of the shots could be filmed on this page.");
  hooks.onStepDone?.(
    "record",
    `${filmed} of ${plan.shots.length} shots filmed${timeline.skipped.length ? `, ${timeline.skipped.length} skipped` : ""}`,
  );

  // Sound and cut
  hooks.onStepStart?.("render", "Scoring and mixing the soundtrack");
  const score = synthScore(timeline.duration, plan.mood, {
    titleEnd: timeline.titleEnd,
    endStart: timeline.endStart,
    clicks: timeline.clicks,
    hits: timeline.hits,
    hype: options.style === "hype",
  });
  const mix = mixSoundtrack(
    timeline.duration,
    timeline.segments.map((s) => ({ pcm: s.line.pcm, at: s.voiceAt })),
    score,
  );
  const raw = path.join(jobDir, "soundtrack-raw.wav");
  await writeFile(raw, writeWav(mix));
  await normalizeLoudness(raw, path.join(jobDir, "soundtrack.wav"));

  hooks.onStepProgress?.("render", "Cutting the trailer");
  const app = { name: plan.appName, tagline: plan.tagline, cta: plan.cta, host: hostLabel(capture.finalUrl) };
  const segments = trailerSegments(timeline);
  const durationInFrames = segments.reduce((a, s) => a + s.frames, 0);
  // Thumbnail backdrop: the frame where the first filmed shot's action has landed.
  const firstShot = timeline.segments.find((s) => s.kind === "shot")?.shot;
  const backdropTime = firstShot ? firstShot.footageStart + firstShot.actionAt + 0.8 : 0;
  const backdrop = recording.frames.filter((f) => f.t <= backdropTime).at(-1) ?? recording.frames[0];

  // The edit is saved before rendering, so a failed or restyled render can be redone from it.
  const edit: EditFile = {
    version: EDIT_VERSION,
    url: capture.finalUrl,
    duration: timeline.duration,
    skipped: timeline.skipped,
    trailer: {
      fps: FPS,
      durationInFrames,
      app,
      segments,
      frames: recording.frames,
      soundtrack: "soundtrack.wav",
      style: options.style,
      captions: options.captions,
    },
    thumbnail: { app, frame: backdrop?.file ?? "", style: options.style },
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
    voice: narrator.name,
  };
}
