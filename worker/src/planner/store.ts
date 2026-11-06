// Saved plans. The cache makes re-rendering the same app free; mock fixtures (committed, in
// worker/fixtures/plans) let PLANNER=mock drive recording, voice and render work at $0.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, type Effort, type ModelId } from "../config";
import type { Capture } from "../capture/types";
import { urlSlug } from "../lib/url";
import { PROMPT_VERSION } from "./prompt";
import { PlanSchema, type Plan } from "./schema";

export interface SavedPlan {
  url: string;
  savedAt: string;
  source: string;
  model: ModelId | null;
  effort: Effort | null;
  promptVersion: number;
  plan: Plan;
}

const slug = (c: Capture) => urlSlug(new URL(c.url));
const cachePath = (c: Capture) => path.join(config.dataDir, "plans", `${slug(c)}.json`);
export const mockPath = (c: Capture) => path.join(config.fixturesDir, "plans", `${slug(c)}.json`);

async function readSaved(file: string): Promise<SavedPlan | null> {
  try {
    const saved = JSON.parse(await readFile(file, "utf8")) as SavedPlan;
    const parsed = PlanSchema.safeParse(saved.plan);
    return parsed.success ? { ...saved, plan: parsed.data } : null;
  } catch {
    return null;
  }
}

async function writeSaved(file: string, saved: SavedPlan): Promise<string> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(saved, null, 2)}\n`);
  return file;
}

type Meta = { source: string; model: ModelId | null; effort: Effort | null };

function toSaved(c: Capture, plan: Plan, meta: Meta): SavedPlan {
  return { url: c.url, savedAt: new Date().toISOString(), promptVersion: PROMPT_VERSION, ...meta, plan };
}

export async function readCachedPlan(c: Capture): Promise<SavedPlan | null> {
  const saved = await readSaved(cachePath(c));
  return saved?.promptVersion === PROMPT_VERSION ? saved : null;
}

export function writeCachedPlan(c: Capture, plan: Plan, meta: Meta): Promise<string> {
  return writeSaved(cachePath(c), toSaved(c, plan, meta));
}

export function readMockPlan(c: Capture): Promise<SavedPlan | null> {
  return readSaved(mockPath(c));
}

export function writeMockPlan(c: Capture, plan: Plan, meta: Meta): Promise<string> {
  return writeSaved(mockPath(c), toSaved(c, plan, meta));
}
