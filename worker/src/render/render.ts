// Renders the trailer and thumbnails with Remotion. The compositions are bundled once per process
// (the worker starts bundling when it boots); each job's frames and soundtrack are served from a
// short-lived localhost file server, and one browser serves the whole render.

import { createReadStream, existsSync, readdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { pipeline } from "node:stream";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition, type HeadlessBrowser } from "@remotion/renderer";
import type { ThumbnailProps, TrailerProps } from "./remotion/types";

const here = path.dirname(fileURLToPath(import.meta.url));
let bundled: Promise<string> | null = null;

function getBundle(): Promise<string> {
  bundled ??= bundle({ entryPoint: path.join(here, "remotion", "index.ts") }).catch((err: unknown) => {
    bundled = null;
    throw err;
  });
  return bundled;
}

/** Starts bundling the compositions now, so the first job does not wait for it. */
export function warmRenderer(): void {
  getBundle().catch((err) => console.error("Remotion bundle failed:", err));
}

/** Playwright's Chrome Headless Shell, so Remotion does not need to download its own. */
function headlessShell(): string | undefined {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
        : path.join(os.homedir(), ".cache", "ms-playwright"),
  ].filter((r): r is string => Boolean(r) && existsSync(r!));
  const exe = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  for (const root of roots) {
    const dirs = readdirSync(root)
      .filter((d) => d.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const sub = readdirSync(path.join(root, dir)).find((s) => s.startsWith("chrome-headless-shell"));
      const candidate = sub ? path.join(root, dir, sub, exe) : "";
      if (candidate && existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
};

/** Serves one directory on 127.0.0.1 for the render browser. */
async function serveDirectory(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const rootDir = path.resolve(dir);
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? "/", "http://local").pathname).replace(/^\/+/, "");
    const file = path.resolve(rootDir, rel);
    if (!file.startsWith(rootDir + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "content-length": info.size,
      "access-control-allow-origin": "*",
    });
    pipeline(createReadStream(file), res, () => {});
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}

export interface RenderOutputs {
  video: string;
  thumbnails: string[];
}

interface Renderer {
  /** Base URL the job's files are served from. */
  base: string;
  shared: { serveUrl: string; browserExecutable: string | null; puppeteerInstance: HeadlessBrowser };
}

/** Serves the job's files and opens one browser for everything rendered from them. */
async function withRenderer<T>(jobDir: string, work: (renderer: Renderer) => Promise<T>): Promise<T> {
  const server = await serveDirectory(jobDir);
  const browserExecutable = headlessShell() ?? null;
  const browser = await openBrowser("chrome", { browserExecutable });
  try {
    const serveUrl = await getBundle();
    return await work({ base: server.url, shared: { serveUrl, browserExecutable, puppeteerInstance: browser } });
  } finally {
    await browser.close({ silent: true }).catch(() => {});
    await server.close();
  }
}

/** Both thumbnails, 1920 and 1280 wide, from one composition. */
async function renderStills(jobDir: string, { base, shared }: Renderer, thumbnail: Omit<ThumbnailProps, "base">): Promise<string[]> {
  const inputProps: ThumbnailProps = { ...thumbnail, base };
  const composition = await selectComposition({ ...shared, id: "Thumbnail", inputProps });
  const big = path.join(jobDir, "thumbnail-1920.png");
  const small = path.join(jobDir, "thumbnail-1280.png");
  await Promise.all([
    renderStill({ ...shared, composition, output: big, inputProps, imageFormat: "png" }),
    renderStill({ ...shared, composition, output: small, inputProps, imageFormat: "png", scale: 2 / 3 }),
  ]);
  return [big, small];
}

export function renderTrailer(
  jobDir: string,
  trailer: Omit<TrailerProps, "base">,
  thumbnail: Omit<ThumbnailProps, "base">,
  onProgress?: (fraction: number) => void,
): Promise<RenderOutputs> {
  return withRenderer(jobDir, async (renderer) => {
    const { shared } = renderer;
    // The thumbnails render alongside the video, in tabs of the same browser, instead of after it.
    const stills = renderStills(jobDir, renderer, thumbnail);
    stills.catch(() => {}); // awaited below; keeps a failure from going unhandled meanwhile
    const inputProps: TrailerProps = { ...trailer, base: renderer.base };
    const composition = await selectComposition({ ...shared, id: "Trailer", inputProps });
    const video = path.join(jobDir, "trailer.mp4");
    await renderMedia({
      ...shared,
      composition,
      codec: "h264",
      crf: 18,
      // Rendering frames is the bottleneck, and veryfast frees CPU for it: about 10% quicker
      // than the default preset in our benchmark, with a slightly smaller file at the same CRF.
      x264Preset: "veryfast",
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioBitrate: "192k",
      outputLocation: video,
      inputProps,
      timeoutInMilliseconds: 60_000,
      onProgress: ({ progress }) => onProgress?.(progress),
    });
    return { video, thumbnails: await stills };
  });
}

/** Only the thumbnails, for restyling them without rendering the video again. */
export function renderThumbnails(jobDir: string, thumbnail: Omit<ThumbnailProps, "base">): Promise<string[]> {
  return withRenderer(jobDir, (renderer) => renderStills(jobDir, renderer, thumbnail));
}
