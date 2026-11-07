// In-process job queue for the worker server. One job runs at a time because each one drives a
// real browser. Live jobs sit in memory (the newest 200); every job that ends is also saved as
// job.json in its folder, so its screening room and gallery entry survive a restart.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CaptureError } from "../capture/capture";
import { captureDemo, loadOrCapture } from "../capture/store";
import { aliasOf, config, MODELS } from "../config";
import type { TrailerOptions } from "../options";
import { makeTrailer, recutTrailer, type TrailerHooks, type TrailerResult } from "../pipeline/trailer";
import { planTrailer } from "../planner/index";
import { planWords, type Plan } from "../planner/schema";
import { UnsafeUrlError } from "../safety/url-guard";
import { VoiceError } from "../voice/deepgram";
import type { JobStepView, JobView, PlannerChoice, StepKey } from "./types";

export interface Job extends JobView {
  fresh: boolean;
  /** A link that opens the app signed in to a demo account. Secret: never in the view, never saved. */
  demoUrl: string | null;
  /** Capture directory, for serving screenshots. */
  dir: string | null;
  /** Job output directory: frames, soundtrack, trailer, thumbnails, captions. */
  outDir: string;
}

/** What job.json holds: the view, plus where the screenshots live (relative to the data folder). */
interface SavedJob {
  view: JobView;
  captureDir: string | null;
}

const JOB_FILE = "job.json";
const OUTPUT_FILES = new Set(["trailer.mp4", "thumbnail-1920.png", "thumbnail-1280.png", "captions.srt"]);

const MAX_JOBS = 200;
/** Jobs that run at once. One on a laptop; two suit a machine with 8 or more cores, where one job
 *  can film while another renders. Each running job drives its own browser. */
const CONCURRENCY = Math.min(4, Math.max(1, Math.floor(Number(process.env.JOB_CONCURRENCY) || 1)));
const jobs = new Map<string, Job>();
const queue: string[] = [];
let running = 0;

/** How long the last few finished jobs took, for the wait shown to people in the queue. */
const recentSeconds: number[] = [];
const typicalSeconds = () => (recentSeconds.length ? recentSeconds.reduce((a, b) => a + b, 0) / recentSeconds.length : 150);

const STEPS: { key: StepKey; label: string }[] = [
  { key: "capture", label: "Opening the app" },
  { key: "plan", label: "Writing the script" },
  { key: "voice", label: "Recording the voiceover" },
  { key: "record", label: "Filming the app" },
  { key: "render", label: "Final cut" },
];

const PLANNER_NAMES: Record<PlannerChoice, string> = {
  haiku: "Claude Haiku 5.5",
  sonnet: "Claude Sonnet 5.5",
  opus: "Claude Opus 5.5",
  none: "The free planner",
};

const now = () => new Date().toISOString();
const jobDir = (id: string) => path.join(config.dataDir, "jobs", id);

function touch(job: Job): void {
  job.updatedAt = now();
}

function step(job: Job, key: StepKey): JobStepView {
  const found = job.steps.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown step ${key}`);
  return found;
}

function startStep(job: Job, key: StepKey, detail: string): void {
  Object.assign(step(job, key), { status: "active", detail, startedAt: now() });
  touch(job);
}

function finishStep(job: Job, key: StepKey, status: "done" | "failed", detail: string): void {
  Object.assign(step(job, key), { status, detail, endedAt: now() });
  touch(job);
}

/** Every job's script is written by the configured model (PLANNER_MODEL, Claude Opus 5.5 unless
 *  set), with the no-AI planner as the fallback when Claude is unavailable or over budget. */
export function createJob(
  url: string,
  fresh: boolean,
  options: TrailerOptions,
  gallery: boolean,
  extras: { notes?: string | null; demoUrl?: string | null } = {},
): Job {
  const planner: PlannerChoice = aliasOf(config.model);
  const id = randomUUID();
  const job: Job = {
    id,
    outDir: jobDir(id),
    url,
    planner,
    status: "queued",
    queuePosition: null,
    createdAt: now(),
    updatedAt: now(),
    steps: STEPS.map(({ key, label }) => ({ key, label, status: "pending", detail: null, startedAt: null, endedAt: null })),
    error: null,
    result: null,
    options,
    // A trailer filmed signed in shows a private account, so it never hangs in the gallery.
    gallery: gallery && !extras.demoUrl,
    demo: Boolean(extras.demoUrl),
    demoUrl: extras.demoUrl ?? null,
    notes: extras.notes ?? null,
    fresh,
    dir: null,
  };
  return enqueue(job);
}

/** A new take of a finished job: its edited script, read again (by another narrator, if asked)
 *  and cut over the first take's footage. Capture and plan carry over, so it starts at the voice.
 *  It never hangs in the gallery: Claude judged the first take's lines, not these. */
export function createRecut(source: Job, plan: Plan, options: TrailerOptions): Job {
  const first = source.result!;
  const id = randomUUID();
  const at = now();
  const job: Job = {
    id,
    outDir: jobDir(id),
    url: source.url,
    planner: source.planner,
    status: "queued",
    queuePosition: null,
    createdAt: at,
    updatedAt: at,
    steps: STEPS.map(({ key, label }) =>
      key === "capture" || key === "plan"
        ? { key, label, status: "done", detail: "Kept from the first take", startedAt: at, endedAt: at }
        : { key, label, status: "pending", detail: null, startedAt: null, endedAt: null },
    ),
    error: null,
    result: {
      capture: first.capture,
      plan,
      planner: { ...first.planner, words: planWords(plan), issues: [], costUsd: 0, latencyMs: 0, inputTokens: 0, outputTokens: 0 },
      trailer: null,
    },
    options,
    gallery: false,
    demo: source.demo ?? false,
    demoUrl: null,
    notes: source.notes ?? null,
    recutOf: source.id,
    fresh: false,
    dir: source.dir,
  };
  return enqueue(job);
}

function enqueue(job: Job): Job {
  jobs.set(job.id, job);
  queue.push(job.id);
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    if (oldest === undefined) break;
    jobs.delete(oldest);
  }
  pump();
  return job;
}

async function saveJob(job: Job): Promise<void> {
  const saved: SavedJob = { view: toView(job), captureDir: job.dir ? path.relative(config.dataDir, job.dir) : null };
  await mkdir(job.outDir, { recursive: true });
  await writeFile(path.join(job.outDir, JOB_FILE), JSON.stringify(saved));
}

/** A live job, or a finished one read back from its job.json. */
export async function findJob(id: string): Promise<Job | undefined> {
  const live = jobs.get(id);
  if (live) return live;
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  try {
    const saved = JSON.parse(await readFile(path.join(jobDir(id), JOB_FILE), "utf8")) as SavedJob;
    return {
      ...saved.view,
      queuePosition: null,
      fresh: false,
      // A finished job no longer needs its demo link, and it was never saved.
      demoUrl: null,
      dir: saved.captureDir ? path.join(config.dataDir, saved.captureDir) : null,
      outDir: jobDir(id),
    };
  } catch {
    return undefined;
  }
}

export function toView(job: Job): JobView {
  const { fresh: _fresh, dir: _dir, outDir: _outDir, demoUrl: _demoUrl, ...view } = job;
  const position = queue.indexOf(job.id);
  // Every slot is busy while anyone waits, so this job starts after `position` more jobs finish,
  // spread over the slots.
  const waitSeconds = position >= 0 ? Math.round(Math.ceil((position + 1) / CONCURRENCY) * typicalSeconds()) : null;
  return { ...view, queuePosition: position >= 0 ? position + 1 : null, waitSeconds };
}

/** Files a job may serve: its own screenshots and, once rendered, its outputs. */
export function jobFile(job: Job, name: string): string | null {
  const shots = job.result?.capture.screenshots ?? [];
  if (job.dir && shots.some((s) => s.file === name)) return path.join(job.dir, name);
  if (job.result?.trailer && OUTPUT_FILES.has(name)) return path.join(job.outDir, name);
  return null;
}

let finishedAt = 0;
/** When a job last finished, so the gallery knows its cached list may be out of date. */
export const lastFinishedAt = () => finishedAt;

function pump(): void {
  while (running < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job) continue;
    running++;
    const started = Date.now();
    run(job)
      .catch((err) => console.error(`job ${id} crashed:`, err))
      .finally(() => {
        running--;
        finishedAt = Date.now();
        if (job.status === "done") {
          recentSeconds.push((finishedAt - started) / 1000);
          if (recentSeconds.length > 5) recentSeconds.shift();
        }
        saveJob(job).catch((err) => console.error(`job ${id} could not be saved:`, err));
        pump();
      });
  }
}

async function run(job: Job): Promise<void> {
  job.status = "running";
  touch(job);
  const { style, voice, captions } = job.options;
  console.log(
    job.recutOf
      ? `job ${job.id.slice(0, 8)} recut of ${job.recutOf.slice(0, 8)}, ${voice}/${captions}`
      : `job ${job.id.slice(0, 8)} ${job.planner} ${style}/${voice}/${captions} ${job.url}`,
  );
  let current: StepKey = job.recutOf ? "voice" : "capture";
  const hooks: TrailerHooks = {
    onStepStart: (key, detail) => {
      current = key;
      startStep(job, key, detail);
    },
    onStepProgress: (key, detail) => {
      if (key === current) step(job, key).detail = detail;
      touch(job);
    },
    onStepDone: (key, detail) => finishStep(job, key, "done", detail),
  };
  try {
    let trailer: TrailerResult;
    if (job.recutOf) {
      // A recut keeps the first take's capture, plan and footage: only the voice and the cut are new.
      trailer = await recutTrailer(jobDir(job.recutOf), job.outDir, job.result!.capture.finalUrl, job.result!.plan, job.options, hooks);
    } else {
      trailer = await firstTake(job, hooks, (key) => (current = key));
    }
    job.result!.trailer = {
      video: path.basename(trailer.video),
      thumbnails: trailer.thumbnails.map((t) => path.basename(t)),
      captions: path.basename(trailer.captions),
      duration: trailer.duration,
      shotsFilmed: trailer.shotsFilmed,
      shotsSkipped: trailer.shotsSkipped,
      narrator: trailer.voice,
      notes: trailer.notes,
      // The footage stays with the job, so the screening room can recut it.
      canRecut: true,
    };
    // After a reshoot the storyboard shows the shots that were actually filmed.
    job.result!.plan = trailer.plan;
    job.status = "done";
    touch(job);
  } catch (err) {
    // `current` is also set inside the pipeline callbacks, which narrowing does not see.
    const failedStep = current as StepKey;
    const known = err instanceof CaptureError || err instanceof UnsafeUrlError;
    const message =
      known && err instanceof Error
        ? err.message
        : err instanceof VoiceError
          ? `The narrator could not record the voiceover (${err.message}).`
          : failedStep === "record" || failedStep === "render"
            ? `The ${failedStep === "record" ? "shoot" : "final cut"} failed. The storyboard below is still ready.`
            : "Something went wrong while making this trailer.";
    if (!known) console.error(`job ${job.id.slice(0, 8)} failed:`, err);
    finishStep(job, failedStep, "failed", message);
    job.error = message;
    job.status = "failed";
    touch(job);
  }
}

/** A first take: open and map the app, write the script, then voice, film and cut it. */
async function firstTake(job: Job, hooks: TrailerHooks, setCurrent: (key: StepKey) => void): Promise<TrailerResult> {
  const { style, length } = job.options;
  startStep(job, "capture", "Starting a fresh browser");
  const onCaptureProgress = (detail: string) => {
    step(job, "capture").detail = detail;
    touch(job);
  };
  const stored = job.demoUrl
    ? await captureDemo(job.url, job.demoUrl, path.join(job.outDir, "capture"), onCaptureProgress)
    : await loadOrCapture(job.url, { fresh: job.fresh, onProgress: onCaptureProgress });
  job.dir = stored.dir;
  const c = stored.capture;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  finishStep(
    job,
    "capture",
    "done",
    [
      count(c.elements.length, "thing to click", "things to click"),
      count(c.sections.length, "section", "sections"),
      count(c.screenshots.length, "screenshot", "screenshots"),
    ].join(", "),
  );

  setCurrent("plan");
  startStep(
    job,
    "plan",
    job.planner === "none" ? "Building a script from the page's own words" : `${PLANNER_NAMES[job.planner]} is writing the ${style} script`,
  );
  const result = await planTrailer(
    stored,
    job.planner === "none"
      ? { planner: "fallback", style, length }
      : { planner: "claude", model: MODELS[job.planner], style, length, notes: job.notes ?? undefined, private: Boolean(job.demoUrl) },
  );
  const attempt = result.attempt;
  const shots = result.plan.shots.length;
  const planDetail =
    result.source === "fallback" && job.planner !== "none"
      ? `Used the free planner instead (${result.reason ?? "unknown reason"})`
      : `${shots} shots, ${result.words} words${attempt?.costUsd ? `, $${attempt.costUsd.toFixed(3)}` : ""}${result.source === "cache" ? " (cached)" : ""}`;
  finishStep(job, "plan", "done", planDetail);

  job.result = {
    capture: {
      url: c.url,
      finalUrl: c.finalUrl,
      title: c.title,
      description: c.description,
      pageHeight: c.pageHeight,
      viewport: c.viewport,
      screenshots: c.screenshots.map((s) => ({ file: s.file, scrollY: s.scrollY })),
      elements: c.elements.map((e) => ({ id: e.id, kind: e.kind, text: e.text, box: e.box })),
      sections: c.sections.map((s) => ({ id: s.id, heading: s.heading, y: s.y })),
      notes: c.notes,
      warnings: c.warnings,
    },
    plan: result.plan,
    planner: {
      source: result.source,
      model: result.model,
      reason: result.reason,
      words: result.words,
      issues: result.issues,
      costUsd: attempt?.costUsd ?? 0,
      latencyMs: attempt?.latencyMs ?? 0,
      inputTokens: attempt?.usage?.inputTokens ?? 0,
      outputTokens: attempt?.usage?.outputTokens ?? 0,
      fallbackRan: attempt?.fallbackRan ?? false,
    },
    trailer: null,
  };
  touch(job);

  // The storyboard is visible from here; the trailer follows.
  return makeTrailer(stored, result.plan, job.outDir, job.options, hooks);
}
