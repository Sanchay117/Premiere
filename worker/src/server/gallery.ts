// The gallery of past trailers. A finished trailer goes up on its own when its maker opted in and
// Claude, while planning it, found the page fit for a public wall (plan.publicSafe). Anything else
// waits for a person: `npm run gallery -- approve <id>` puts it up, `remove <id>` takes any
// trailer down. The worker films any URL someone pastes, so nothing goes up unchecked.

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { hostLabel } from "../lib/url";
import { findJob, lastFinishedAt, type Job } from "./jobs";

interface GalleryState {
  /** Put up by hand, even though Claude did not clear them (or no Claude call was made). */
  approved: string[];
  /** Taken down by hand. Wins over everything else. */
  removed: string[];
}

export interface GalleryEntry {
  id: string;
  appName: string;
  tagline: string;
  host: string;
  url: string;
  duration: number;
  style: string;
  narrator: string;
  createdAt: string;
}

const FILE = path.join(config.dataDir, "gallery.json");

const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);

export async function readGallery(): Promise<GalleryState> {
  try {
    const state = JSON.parse(await readFile(FILE, "utf8")) as Partial<GalleryState>;
    return { approved: ids(state.approved), removed: ids(state.removed) };
  } catch {
    return { approved: [], removed: [] };
  }
}

async function writeGallery(state: GalleryState): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(`${FILE}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${FILE}.tmp`, FILE);
}

type Finished = Job & { result: NonNullable<Job["result"]> };

/** Whether a job could appear at all: finished, with a trailer, and its maker opted in. */
export function showable(job: Job | undefined): job is Finished {
  return Boolean(job && job.status === "done" && job.gallery && job.result?.trailer);
}

export type Listing = "listed" | "held" | "removed" | "opted out" | "unfinished";

/** Where a job stands with the gallery. */
export function listing(job: Job, state: GalleryState): Listing {
  if (job.status !== "done" || !job.result?.trailer) return "unfinished";
  if (!job.gallery) return "opted out";
  if (state.removed.includes(job.id)) return "removed";
  if (state.approved.includes(job.id) || job.result.plan.publicSafe === true) return "listed";
  return "held";
}

/** One trailer per app on the wall: the same host and path count as the same app. */
function appKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url;
  }
}

function entry(job: Finished): GalleryEntry {
  return {
    id: job.id,
    appName: job.result.plan.appName,
    tagline: job.result.plan.tagline,
    host: hostLabel(job.result.capture.finalUrl),
    url: job.result.capture.finalUrl,
    duration: job.result.trailer?.duration ?? 0,
    style: job.options?.style ?? "walkthrough",
    narrator: job.result.trailer?.narrator ?? "",
    createdAt: job.createdAt,
  };
}

export async function setListing(id: string, action: "approve" | "remove"): Promise<GalleryState> {
  const state = await readGallery();
  const approved = state.approved.filter((x) => x !== id);
  const removed = state.removed.filter((x) => x !== id);
  const next = action === "approve" ? { approved: [id, ...approved], removed } : { approved, removed: [id, ...removed] };
  await writeGallery(next);
  return next;
}

let cached: { at: number; entries: GalleryEntry[] } | null = null;

/** Listed trailers, newest first, the newest one per app. Cached for a minute, or until a job
 *  finishes, so a new trailer is on the wall as soon as it is rendered. */
export async function galleryEntries(limit = 48): Promise<GalleryEntry[]> {
  if (cached && Date.now() - cached.at < 60_000 && cached.at > lastFinishedAt()) return cached.entries.slice(0, limit);
  const state = await readGallery();
  const seen = new Set<string>();
  const entries: GalleryEntry[] = [];
  for (const job of await savedJobs()) {
    if (!showable(job) || listing(job, state) !== "listed") continue;
    const key = appKey(job.result.capture.finalUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry(job));
  }
  cached = { at: Date.now(), entries };
  return entries.slice(0, limit);
}

export function clearGalleryCache(): void {
  cached = null;
}

/** Every saved job, newest first. Live jobs come from memory, so a trailer that has just
 *  finished counts before its job.json is written. */
export async function savedJobs(): Promise<Job[]> {
  const root = path.join(config.dataDir, "jobs");
  const names = await readdir(root).catch(() => [] as string[]);
  const found: Job[] = [];
  for (const name of names) {
    const job = await findJob(name);
    if (job) found.push(job);
  }
  return found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
