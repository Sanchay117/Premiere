// What each trailer's thumbnails show: a real frame of the app and the app's own color. The first
// filmed shot is usually the hero, the page's designed first impression with nothing scrolled off
// the top, so its frame is the backdrop unless a later moment is far more colorful (a plain hero
// above a vivid product, say). The accent is the strongest color in that frame, or anywhere in the
// footage when the frame has none, so every thumbnail looks like its app rather than like the
// template.

import path from "node:path";
import sharp from "sharp";
import type { TrailerProps } from "./remotion/types";

/** Frames are compared at this size: plenty for color and layout, and quick to read. */
const SAMPLE_W = 96;
const SAMPLE_H = 54;

/** Premiere's amber, for pages with no color of their own. */
export const DEFAULT_ACCENT = "#ffb547";

export interface ThumbnailPick {
  /** Frame file for the backdrop. */
  frame: string;
  /** The app's own color, light enough to read on a dark poster. */
  accent: string;
}

export interface FrameStats {
  /** Standard deviation of luma, 0 to about 128. Under 6 the frame is close to blank. */
  contrast: number;
  /** Color where something is drawn: chroma weighted by the local edge strength, so a flat fill
   *  (a footer band, a solid panel) counts for little and colorful art or UI counts a lot. */
  vivid: number;
}

export function frameStats(rgb: Uint8Array, width: number, height: number): FrameStats {
  const n = width * height;
  const luma = new Float32Array(n);
  const chroma = new Float32Array(n);
  let l1 = 0;
  let l2 = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3]!;
    const g = rgb[i * 3 + 1]!;
    const b = rgb[i * 3 + 2]!;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
    l1 += l;
    l2 += l * l;
  }
  let vivid = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const right = x + 1 < width ? i + 1 : i;
      const down = y + 1 < height ? i + width : i;
      const edge =
        Math.abs(luma[right]! - luma[i]!) +
        Math.abs(luma[down]! - luma[i]!) +
        Math.abs(chroma[right]! - chroma[i]!) +
        Math.abs(chroma[down]! - chroma[i]!);
      vivid += chroma[i]! * Math.min(1, edge / 40);
    }
  }
  const mean = l1 / n;
  return { contrast: Math.sqrt(Math.max(0, l2 / n - mean * mean)), vivid: vivid / n };
}

export interface Candidate {
  file: string;
  /** Which filmed shot the frame comes from, in trailer order. */
  shot: number;
  stats: FrameStats;
}

/** The backdrop: the first filmed shot's most colorful frame, unless a later frame is far more
 *  colorful. Blank frames never win while anything else is on offer. */
export function pickBackdrop(candidates: Candidate[]): Candidate | null {
  const usable = candidates.filter((c) => c.stats.contrast >= 6);
  if (usable.length === 0) return candidates[0] ?? null;
  const mostVivid = (list: Candidate[]) => list.reduce((a, b) => (b.stats.vivid > a.stats.vivid ? b : a));
  const lead = mostVivid(usable.filter((c) => c.shot === usable[0]!.shot));
  const rest = usable.filter((c) => c.shot !== lead.shot);
  const challenger = rest.length ? mostVivid(rest) : null;
  return challenger && challenger.stats.vivid >= Math.max(lead.stats.vivid * 2.5, lead.stats.vivid + 3) ? challenger : lead;
}

/** Strongly colored pixels by hue, in 36 bins of 10 degrees, weighted by chroma squared so the most
 *  vivid areas lead. Greys, near-black pixels and pale tints say nothing about the brand. */
export function hueHistogram(rgb: Uint8Array, width: number, height: number): { weight: Float64Array; saturation: Float64Array; pixels: number; vivid: number } {
  const n = width * height;
  const weight = new Float64Array(36);
  const saturation = new Float64Array(36);
  let vivid = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3]! / 255;
    const g = rgb[i * 3 + 1]! / 255;
    const b = rgb[i * 3 + 2]! / 255;
    const max = Math.max(r, g, b);
    const c = max - Math.min(r, g, b);
    if (max < 0.3 || c < 0.16) continue;
    const sector = max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
    const bin = Math.floor(sector * 6) % 36;
    weight[bin]! += c * c;
    saturation[bin]! += c * c * (c / max);
    vivid++;
  }
  return { weight, saturation, pixels: n, vivid };
}

type Histogram = ReturnType<typeof hueHistogram>;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** WCAG relative luminance of an sRGB color with channels from 0 to 1. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const toHex = (rgb: [number, number, number]) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;

/** The hue covering the most strongly colored area, lifted until it reads on a dark poster (at
 *  least 7:1 against Premiere's ink). Null when under 0.6% of the pixels carry real color. */
export function accentFrom(histograms: Histogram[]): string | null {
  const weight = new Float64Array(36);
  const saturation = new Float64Array(36);
  let pixels = 0;
  let vivid = 0;
  for (const h of histograms) {
    for (let k = 0; k < 36; k++) {
      weight[k]! += h.weight[k]!;
      saturation[k]! += h.saturation[k]!;
    }
    pixels += h.pixels;
    vivid += h.vivid;
  }
  if (pixels === 0 || vivid < pixels * 0.006) return null;

  // The 30 degree window with the most weight, then its weighted circular mean hue.
  let best = 0;
  let bestWeight = -1;
  for (let k = 0; k < 36; k++) {
    const w = weight[(k + 35) % 36]! + weight[k]! + weight[(k + 1) % 36]!;
    if (w > bestWeight) {
      bestWeight = w;
      best = k;
    }
  }
  let x = 0;
  let y = 0;
  let sat = 0;
  for (const k of [(best + 35) % 36, best, (best + 1) % 36]) {
    const angle = ((k + 0.5) * 10 * Math.PI) / 180;
    x += weight[k]! * Math.cos(angle);
    y += weight[k]! * Math.sin(angle);
    sat += saturation[k]!;
  }
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  // A muted brand stays recognizably muted, but never so grey that it stops being an accent.
  const s = Math.min(0.92, Math.max(0.55, sat / bestWeight));
  let color = hslToRgb(hue, s, 0.55);
  for (let l = 0.56; l <= 0.86 && luminance(color) < 0.3; l += 0.01) color = hslToRgb(hue, s, l);
  return toHex(color);
}

/** Recording times worth considering, with the filmed shot each belongs to: just after the shot's
 *  action lands, and its settled end. */
export function candidateTimes(trailer: Pick<TrailerProps, "fps" | "segments">): { t: number; shot: number }[] {
  const times: { t: number; shot: number }[] = [];
  let shot = 0;
  for (const s of trailer.segments) {
    if (s.kind !== "shot" || s.footageStart === undefined) continue;
    const length = Math.max(0, (s.frames - (s.punchFrames ?? 0)) / trailer.fps);
    times.push({ t: s.footageStart + Math.min(length, (s.actionAt ?? 0.7) + 1), shot });
    times.push({ t: s.footageStart + Math.max(0, length - 0.25), shot });
    shot++;
  }
  return times;
}

/** Latest recorded frame at or before recording time t. */
function frameAt(frames: TrailerProps["frames"], t: number): string {
  let found = frames[0]?.file ?? "";
  for (const f of frames) {
    if (f.t > t) break;
    found = f.file;
  }
  return found;
}

async function samplePixels(file: string): Promise<Uint8Array | null> {
  try {
    const { data, info } = await sharp(file)
      .resize(SAMPLE_W, SAMPLE_H, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return info.channels === 3 && data.length === SAMPLE_W * SAMPLE_H * 3 ? data : null;
  } catch {
    return null;
  }
}

/** The backdrop frame and accent for a job's thumbnails. If no frame can be read, the first shot's
 *  frame in amber. */
export async function chooseThumbnail(jobDir: string, trailer: Pick<TrailerProps, "fps" | "segments" | "frames">): Promise<ThumbnailPick> {
  const seen = new Set<string>();
  const wanted: { file: string; shot: number }[] = [];
  for (const { t, shot } of candidateTimes(trailer)) {
    const file = frameAt(trailer.frames, t);
    if (file && !seen.has(file)) {
      seen.add(file);
      wanted.push({ file, shot });
    }
  }
  const sampled = await Promise.all(
    wanted.map(async ({ file, shot }) => {
      const rgb = await samplePixels(path.join(jobDir, "frames", file));
      return rgb ? { file, shot, rgb, stats: frameStats(rgb, SAMPLE_W, SAMPLE_H) } : null;
    }),
  );
  const frames = sampled.filter((c): c is NonNullable<typeof c> => c !== null);
  const backdrop = pickBackdrop(frames);
  if (!backdrop) return { frame: wanted[0]?.file ?? trailer.frames[0]?.file ?? "", accent: DEFAULT_ACCENT };
  const own = frames.find((f) => f.file === backdrop.file)!;
  const accent =
    accentFrom([hueHistogram(own.rgb, SAMPLE_W, SAMPLE_H)]) ??
    accentFrom(frames.map((f) => hueHistogram(f.rgb, SAMPLE_W, SAMPLE_H))) ??
    DEFAULT_ACCENT;
  return { frame: backdrop.file, accent };
}
