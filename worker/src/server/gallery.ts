// The gallery of past trailers. A trailer is shown only when its maker opted in and we approved
// it (npm run gallery -- approve <id>): the worker films any URL someone pastes, so nothing
// reaches the public wall without a person looking at it first.

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { hostLabel } from "../lib/url";
import { findJob, type Job } from "./jobs";

interface GalleryState {
  approved: string[];
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

export async function readGallery(): Promise<GalleryState> {
  try {
    const state = JSON.parse(await readFile(FILE, "utf8")) as Partial<GalleryState>;
    return { approved: Array.isArray(state.approved) ? state.approved.filter((id) => typeof id === "string") : [] };
  } catch {
    return { approved: [] };
  }
}

async function writeGallery(state: GalleryState): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(`${FILE}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${FILE}.tmp`, FILE);
}

/** Whether a finished job can appear in the gallery at all. */
export function showable(job: Job | undefined): job is Job & { result: NonNullable<Job["result"]> } {
  return Boolean(job && job.status === "done" && job.gallery && job.result?.trailer);
}

function entry(job: Job & { result: NonNullable<Job["result"]> }): GalleryEntry {
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

export async function setApproved(id: string, approved: boolean): Promise<GalleryState> {
  const state = await readGallery();
  const rest = state.approved.filter((x) => x !== id);
  const next = { approved: approved ? [id, ...rest] : rest };
  await writeGallery(next);
  return next;
}

let cached: { at: number; entries: GalleryEntry[] } | null = null;

/** Approved trailers, newest first. Cached for a minute; approving clears the cache. */
export async function galleryEntries(limit = 48): Promise<GalleryEntry[]> {
  if (cached && Date.now() - cached.at < 60_000) return cached.entries.slice(0, limit);
  const { approved } = await readGallery();
  const entries: GalleryEntry[] = [];
  for (const id of approved) {
    const job = await findJob(id);
    if (showable(job)) entries.push(entry(job));
  }
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  cached = { at: Date.now(), entries };
  return entries.slice(0, limit);
}

export function clearGalleryCache(): void {
  cached = null;
}

/** Every saved job, newest first, for the gallery CLI. */
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
