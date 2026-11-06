// In-process job queue for the worker server. One job runs at a time because each one drives a
// real browser. Jobs live in memory (the newest 200 are kept); a hosted queue can replace this
// without changing the HTTP API.

import { randomUUID } from "node:crypto";
import path from "node:path";
import { CaptureError } from "../capture/capture";
import { loadOrCapture } from "../capture/store";
import { config, MODELS } from "../config";
import { makeTrailer } from "../pipeline/trailer";
import { planTrailer } from "../planner/index";
import { UnsafeUrlError } from "../safety/url-guard";
import { VoiceError } from "../voice/deepgram";
import type { JobStepView, JobView, PlannerChoice, StepKey } from "./types";

interface Job extends JobView {
  fresh: boolean;
  /** Capture directory, for serving screenshots. */
  dir: string | null;
  /** Job output directory: frames, soundtrack, trailer, thumbnails, captions. */
  outDir: string;
}

const OUTPUT_FILES = new Set(["trailer.mp4", "thumbnail-1920.png", "thumbnail-1280.png", "captions.srt"]);

const MAX_JOBS = 200;
const CONCURRENCY = 1;
const jobs = new Map<string, Job>();
const queue: string[] = [];
let running = 0;

const STEPS: { key: StepKey; label: string; built: boolean }[] = [
  { key: "capture", label: "Opening the app", built: true },
  { key: "plan", label: "Writing the script", built: true },
  { key: "voice", label: "Recording the voiceover", built: true },
  { key: "record", label: "Filming the app", built: true },
  { key: "render", label: "Final cut", built: true },
];

const PLANNER_NAMES: Record<PlannerChoice, string> = {
  haiku: "Claude Haiku 5.5",
  sonnet: "Claude Sonnet 5.5",
  opus: "Claude Opus 5.5",
  none: "The free planner",
};

const now = () => new Date().toISOString();

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

export function createJob(url: string, planner: PlannerChoice, fresh: boolean): Job {
  const id = randomUUID();
  const job: Job = {
    id,
    outDir: path.join(config.dataDir, "jobs", id),
    url,
    planner,
    status: "queued",
    queuePosition: null,
    createdAt: now(),
    updatedAt: now(),
    steps: STEPS.map(({ key, label, built }) => ({
      key,
      label,
      status: built ? "pending" : "soon",
      detail: built ? null : "Not built yet",
      startedAt: null,
      endedAt: null,
    })),
    error: null,
    result: null,
    fresh,
    dir: null,
  };
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

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function toView(job: Job): JobView {
  const { fresh: _fresh, dir: _dir, outDir: _outDir, ...view } = job;
  const position = queue.indexOf(job.id);
  return { ...view, queuePosition: position >= 0 ? position + 1 : null };
}

/** Files a job may serve: its own screenshots and, once rendered, its outputs. */
export function jobFile(job: Job, name: string): string | null {
  const shots = job.result?.capture.screenshots ?? [];
  if (job.dir && shots.some((s) => s.file === name)) return path.join(job.dir, name);
  if (job.result?.trailer && OUTPUT_FILES.has(name)) return path.join(job.outDir, name);
  return null;
}

function pump(): void {
  while (running < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job) continue;
    running++;
    run(job)
      .catch((err) => console.error(`job ${id} crashed:`, err))
      .finally(() => {
        running--;
        pump();
      });
  }
}

async function run(job: Job): Promise<void> {
  job.status = "running";
  touch(job);
  console.log(`job ${job.id.slice(0, 8)} ${job.planner} ${job.url}`);
  let current: StepKey = "capture";
  try {
    startStep(job, "capture", "Starting a fresh browser");
    const stored = await loadOrCapture(job.url, {
      fresh: job.fresh,
      onProgress: (detail) => {
        step(job, "capture").detail = detail;
        touch(job);
      },
    });
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

    current = "plan";
    startStep(
      job,
      "plan",
      job.planner === "none" ? "Building a script from the page's own words" : `${PLANNER_NAMES[job.planner]} is writing the script`,
    );
    const result = await planTrailer(
      stored,
      job.planner === "none" ? { planner: "fallback" } : { planner: "claude", model: MODELS[job.planner] },
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
    const trailer = await makeTrailer(stored, result.plan, job.outDir, {
      onStepStart: (key, detail) => {
        current = key;
        startStep(job, key, detail);
      },
      onStepProgress: (key, detail) => {
        if (key === current) step(job, key).detail = detail;
        touch(job);
      },
      onStepDone: (key, detail) => finishStep(job, key, "done", detail),
    });
    job.result.trailer = {
      video: path.basename(trailer.video),
      thumbnails: trailer.thumbnails.map((t) => path.basename(t)),
      captions: path.basename(trailer.captions),
      duration: trailer.duration,
      shotsFilmed: trailer.shotsFilmed,
      shotsSkipped: trailer.shotsSkipped,
    };
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
