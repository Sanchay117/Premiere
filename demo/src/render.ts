// npx tsx demo/src/render.ts --stills 5,20,40 [--scale 0.5]   frames at those seconds, for review
// npx tsx demo/src/render.ts --video draft|final                the whole demo
// npx tsx demo/src/render.ts --poster                           the two thumbnails
// Bundles demo/remotion, serves demo/.out to the render browser and reads demo/.out/props.json.

import { createReadStream, existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { DemoProps } from "../remotion/types";
import { DEMO, OUT } from "./paths";

const { values } = parseArgs({
  options: {
    stills: { type: "string" },
    scale: { type: "string", default: "0.5" },
    video: { type: "string" },
    poster: { type: "boolean", default: false },
    from: { type: "string" },
    to: { type: "string" },
  },
});

/** Playwright's Chrome Headless Shell, so Remotion does not download its own. */
function headlessShell(): string | null {
  const root = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright") : path.join(os.homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return null;
  const exe = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()) {
    const sub = readdirSync(path.join(root, dir)).find((s) => s.startsWith("chrome-headless-shell"));
    const candidate = sub ? path.join(root, dir, sub, exe) : "";
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".wav": "audio/wav", ".mp4": "video/mp4" };

async function serve(dir: string) {
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? "/", "http://local").pathname).replace(/^\/+/, "");
    const file = path.resolve(dir, rel);
    const info = file.startsWith(path.resolve(dir) + path.sep) ? await stat(file).catch(() => null) : null;
    if (!info?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    const headers = { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "accept-ranges": "bytes", "access-control-allow-origin": "*" };
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": end - start + 1 });
      pipeline(createReadStream(file, { start, end }), res, () => {});
      return;
    }
    res.writeHead(200, { ...headers, "content-length": info.size });
    pipeline(createReadStream(file), res, () => {});
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((d) => server.close(() => d())) };
}

const props = JSON.parse(await readFile(path.join(OUT, "props.json"), "utf8")) as DemoProps;
const server = await serve(OUT);
const inputProps = { ...props, base: server.url };
const browserExecutable = headlessShell();
const browser = await openBrowser("chrome", { browserExecutable });
const serveUrl = await bundle({ entryPoint: path.join(DEMO, "remotion", "index.ts") });
const started = Date.now();
try {
  if (values.stills) {
    const composition = await selectComposition({ serveUrl, id: "Demo", inputProps, browserExecutable, puppeteerInstance: browser });
    const dir = path.join(OUT, "stills");
    await mkdir(dir, { recursive: true });
    for (const s of values.stills.split(",").map(Number)) {
      const frame = Math.min(composition.durationInFrames - 1, Math.round(s * props.fps));
      const output = path.join(dir, `s${s.toFixed(2).padStart(7, "0")}.jpg`);
      await renderStill({ composition, serveUrl, output, frame, inputProps, scale: Number(values.scale), imageFormat: "jpeg", jpegQuality: 85, browserExecutable, puppeteerInstance: browser });
      console.log(output);
    }
  }
  if (values.poster) {
    const composition = await selectComposition({ serveUrl, id: "Poster", inputProps, browserExecutable, puppeteerInstance: browser });
    for (const [name, scale] of [["thumbnail-1920.png", 1], ["thumbnail-1280.png", 1280 / 1920]] as const) {
      const output = path.join(OUT, name);
      await renderStill({ composition, serveUrl, output, inputProps, scale, imageFormat: "png", browserExecutable, puppeteerInstance: browser });
      console.log(output);
    }
  }
  if (values.video) {
    const final = values.video === "final";
    const composition = await selectComposition({ serveUrl, id: "Demo", inputProps, browserExecutable, puppeteerInstance: browser });
    const from = values.from ? Math.round(Number(values.from) * props.fps) : 0;
    const to = values.to ? Math.round(Number(values.to) * props.fps) : composition.durationInFrames - 1;
    const output = path.join(OUT, final ? "premiere-demo.mp4" : "draft.mp4");
    let last = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: output,
      inputProps,
      crf: final ? 16 : 21,
      x264Preset: final ? "slow" : "veryfast",
      colorSpace: "bt709",
      audioBitrate: "256k",
      frameRange: [from, to],
      browserExecutable,
      puppeteerInstance: browser,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 20) * 5;
        if (pct !== last) {
          last = pct;
          console.log(`render ${pct}%`);
        }
      },
    });
    console.log(output);
  }
} finally {
  await browser.close({ silent: true }).catch(() => {});
  await server.close();
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
