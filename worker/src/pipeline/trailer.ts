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
import { closeStage, openStage, recordPlan } from "../record/recorder";
import { renderThumbnails, renderTrailer, type RenderOutputs } from "../render/render";
import { chooseThumbnail } from "../render/thumbnail";
import { buildTimeline, FPS, shotHolds, toSrt, type Timeline } from "../render/timeline";
import type { ThumbnailProps, TrailerProps, TrailerSegment } from "../render/remotion/types";
import { voicePlan, type VoiceLine } from "../voice/deepgram";

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

  // Voice, while the app opens for the shoot in the background: the browser launch, page load
  // and the app's own boot happen during the narration instead of after it.
  hooks.onStepStart?.("voice", "The narrator is reading the script");
  const stage = openStage(capture);
  stage.catch(() => {}); // the recorder awaits it, and a failure surfaces there
  const narrator = NARRATORS[narratorFor(options.voice, plan.mood)];
  let lines: VoiceLine[];
  try {
    lines = await voicePlan(plan, options.voice, (d) => hooks.onStepProgress?.("voice", d));
  } catch (err) {
    await closeStage(stage);
    throw err;
  }
  const totalVoice = lines.reduce((a, l) => a + l.duration, 0);
  hooks.onStepDone?.("voice", `${narrator.name} read ${lines.length} lines, ${totalVoice.toFixed(1)} s of narration`);

  // Shoot
  hooks.onStepStart?.("record", "Opening the app for the shoot");
  const recording = await recordPlan(capture, plan, {
    holds: shotHolds(lines, plan, options.style),
    outDir: jobDir,
    onProgress: (d) => hooks.onStepProgress?.("record", d),
    stage,
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
  const trailer: EditFile["trailer"] = {
    fps: FPS,
    durationInFrames,
    app,
    segments,
    frames: recording.frames,
    soundtrack: "soundtrack.wav",
    style: options.style,
    captions: options.captions,
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
    voice: narrator.name,
  };
}
