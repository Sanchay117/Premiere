// npx tsx demo/src/preview.ts
// A one-image preview of the finished demo (demo/.out/preview.png): frames pulled from the final
// file at the beats that matter, labelled with their time.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { runFfmpeg } from "../../worker/src/audio/ffmpeg";
import { OUT } from "./paths";

const times = [1.5, 6, 10, 14.5, 17, 18, 19, 20.5, 24, 28, 32, 37, 43, 49, 59, 66, 75, 87, 91, 96, 104, 110, 116, 123, 131, 138];
const dir = path.join(OUT, "preview");
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
for (const t of times) {
  await runFfmpeg(["-loglevel", "error", "-y", "-ss", String(t), "-i", path.join(OUT, "premiere-demo.mp4"), "-frames:v", "1", "-vf", "scale=480:-1", path.join(dir, `t${t.toFixed(1).padStart(6, "0")}.jpg`)]);
}
const cells = times
  .map((t) => `<figure><img src="${pathToFileURL(path.join(dir, `t${t.toFixed(1).padStart(6, "0")}.jpg`)).href}"><figcaption>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}</figcaption></figure>`)
  .join("");
const html = `<!doctype html><html><body style="margin:0;background:#07080c;font:700 14px system-ui;color:#f3ead8">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${cells}</div>
<style>figure{margin:0;position:relative}img{width:100%;display:block;border-radius:3px}figcaption{position:absolute;left:6px;top:4px;background:#000b;padding:1px 6px;border-radius:3px}</style></body></html>`;
const page = path.join(OUT, "preview.html");
await writeFile(page, html);
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await tab.goto(pathToFileURL(page).href);
await tab.screenshot({ path: path.join(OUT, "preview.png"), fullPage: true });
await browser.close();
console.log(path.join(OUT, "preview.png"));
