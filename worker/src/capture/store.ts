import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { normalizeUrl, urlSlug } from "../lib/url";
import { capturePage } from "./capture";
import { CAPTURE_VERSION, type Capture, type StoredCapture } from "./types";

export function captureDir(url: URL): string {
  return path.join(config.dataDir, "captures", urlSlug(url));
}

export async function readCapture(dir: string): Promise<Capture | null> {
  try {
    const capture = JSON.parse(await readFile(path.join(dir, "capture.json"), "utf8")) as Capture;
    return capture.version === CAPTURE_VERSION ? capture : null;
  } catch {
    return null;
  }
}

/** Reuses the saved capture for this URL unless `fresh` is set. */
export async function loadOrCapture(
  rawUrl: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<StoredCapture & { cached: boolean }> {
  const url = normalizeUrl(rawUrl);
  const dir = captureDir(url);
  if (!fresh) {
    const saved = await readCapture(dir);
    if (saved) return { capture: saved, dir, cached: true };
  }
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const capture = await capturePage(url.href, { outDir: dir });
  return { capture, dir, cached: false };
}
