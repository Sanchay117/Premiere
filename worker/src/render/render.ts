// Renders the trailer and thumbnails with Remotion. The compositions are bundled once per process;
// each job's frames and soundtrack are served from a short-lived localhost file server.

import { createReadStream, existsSync, readdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { ThumbnailProps, TrailerProps } from "./remotion/types";

const here = path.dirname(fileURLToPath(import.meta.url));
let bundled: Promise<string> | null = null;

function getBundle(): Promise<string> {
  bundled ??= bundle({ entryPoint: path.join(here, "remotion", "index.ts") });
  return bundled;
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
    createReadStream(file).pipe(res);
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

export async function renderTrailer(
  jobDir: string,
  trailer: Omit<TrailerProps, "base">,
  thumbnail: Omit<ThumbnailProps, "base">,
  onProgress?: (fraction: number) => void,
): Promise<RenderOutputs> {
  const server = await serveDirectory(jobDir);
  const browserExecutable = headlessShell();
  try {
    const serveUrl = await getBundle();
    const trailerProps: TrailerProps = { ...trailer, base: server.url };
    const composition = await selectComposition({ serveUrl, id: "Trailer", inputProps: trailerProps, browserExecutable });
    const video = path.join(jobDir, "trailer.mp4");
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 18,
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioBitrate: "192k",
      outputLocation: video,
      inputProps: trailerProps,
      browserExecutable,
      timeoutInMilliseconds: 60_000,
      onProgress: ({ progress }) => onProgress?.(progress),
    });

    const thumbProps: ThumbnailProps = { ...thumbnail, base: server.url };
    const still = await selectComposition({ serveUrl, id: "Thumbnail", inputProps: thumbProps, browserExecutable });
    const big = path.join(jobDir, "thumbnail-1920.png");
    const small = path.join(jobDir, "thumbnail-1280.png");
    await renderStill({ composition: still, serveUrl, output: big, inputProps: thumbProps, imageFormat: "png", browserExecutable });
    await renderStill({ composition: still, serveUrl, output: small, inputProps: thumbProps, imageFormat: "png", scale: 2 / 3, browserExecutable });
    return { video, thumbnails: [big, small] };
  } finally {
    await server.close();
  }
}
