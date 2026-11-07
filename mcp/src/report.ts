// Turns a job view into the few lines an agent reads back to its user: where the job stands while
// it runs, and every link once it is done. Plain text, since every MCP client shows that.

import type { Site } from "./site.ts";
import type { JobStep, JobView } from "./types.ts";

export const isFinished = (job: JobView): boolean => job.status === "done" || job.status === "failed";

const STEP_STATE: Record<JobStep["status"], string> = {
  done: "done",
  active: "in progress",
  failed: "failed",
  pending: "to do",
  soon: "to do",
};

const KEEP_WAITING = "Call trailer_status again with wait_seconds to keep waiting.";

/** "under a minute", "about 3 min". */
export function roughly(seconds: number): string {
  return seconds < 60 ? "under a minute" : `about ${Math.round(seconds / 60)} min`;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

/** How long the job has run, from its first step. Compares the site's clock with ours, so it is
 *  rounded and never negative. */
function runningFor(job: JobView): string | null {
  const started = Date.parse(job.steps[0]?.startedAt ?? "");
  if (Number.isNaN(started)) return null;
  const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** One line on where the job stands, for progress notifications and the order receipt. */
export function headline(job: JobView): string {
  switch (job.status) {
    case "queued": {
      const place = job.queuePosition ? `, number ${job.queuePosition} in line` : "";
      const wait = job.waitSeconds ? `, starts in ${roughly(job.waitSeconds)}` : "";
      return `Queued${place}${wait}`;
    }
    case "running": {
      const step = job.steps.find((s) => s.status === "active");
      return step ? `${step.label}${step.detail ? `: ${step.detail}` : ""}` : "Running";
    }
    case "done":
      return "Done";
    case "failed":
      return `Failed${job.error ? `: ${job.error}` : ""}`;
    default:
      return String(job.status);
  }
}

/** The full status: steps while it runs, links when it is done, the reason when it failed. */
export function describeJob(job: JobView, site: Site): string {
  const page = site.pageUrl(job.id);

  if (job.status === "queued") {
    return [`Status: ${lowerFirst(headline(job))}.`, `Screening room: ${page}`, `Not started yet. ${KEEP_WAITING}`].join("\n");
  }

  if (job.status === "failed") {
    const step = job.steps.find((s) => s.status === "failed");
    return [
      `Status: failed${step ? ` at "${step.label}"` : ""}${job.error ? `: ${job.error}` : "."}`,
      `Screening room (how far it got): ${page}`,
      "It can be ordered again with make_trailer.",
    ].join("\n");
  }

  const trailer = job.result?.trailer;
  if (job.status === "done" && !trailer) {
    return [`Status: done, but the site listed no trailer files.`, `Screening room: ${page}`].join("\n");
  }
  if (job.status !== "done" || !trailer) {
    const elapsed = runningFor(job);
    return [
      `Status: ${job.status}${elapsed ? `, ${elapsed} so far` : ""}.`,
      ...job.steps.map((s) => `- ${s.label}: ${STEP_STATE[s.status] ?? s.status}${s.detail ? ` (${s.detail})` : ""}`),
      `Screening room (live progress): ${page}`,
      `Not finished yet. ${KEEP_WAITING}`,
    ].join("\n");
  }

  const name = job.result?.plan?.appName;
  const options = job.options ?? {};
  const settings = [
    options.style && `Cut: ${options.style}.`,
    trailer.narrator && `Narrator: ${trailer.narrator}.`,
    options.captions && `Captions: ${options.captions}.`,
    options.format && `Format: ${options.format}.`,
  ].filter(Boolean);
  const skipped = trailer.shotsSkipped ?? [];
  return [
    `Status: done. ${name ? `"${name}", ` : ""}${trailer.duration.toFixed(1)} s.`,
    ...(settings.length ? [settings.join(" ")] : []),
    ...(trailer.notes ?? []).map((note) => `Note: ${note}`),
    ...(skipped.length
      ? [`Skipped shots (cut from the edit): ${skipped.map((s) => `shot ${s.index + 1}, ${clip(s.reason, 120)}`).join("; ")}.`]
      : []),
    `Trailer: ${site.fileUrl(job.id, trailer.video)}`,
    ...trailer.thumbnails.map((file) => `Thumbnail: ${site.fileUrl(job.id, file)}`),
    `Captions (SRT): ${site.fileUrl(job.id, trailer.captions)}`,
    `Screening room (watch, download, share): ${page}`,
    "Add ?download=1 to a file link to download it under its own name.",
  ].join("\n");
}
