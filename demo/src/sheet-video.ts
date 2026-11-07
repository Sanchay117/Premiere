// npx tsx demo/src/sheet-video.ts <from> <to>
// A contact sheet of frames pulled one a second from the rendered video (demo/.out/review).

import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { OUT } from "./paths";

const from = Number(process.argv[2] ?? 0);
const to = Number(process.argv[3] ?? 35);
const dir = path.join(OUT, "review");
const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort().filter((f) => {
  const s = Number(f.slice(1, -4)) - 1;
  return s >= from && s <= to;
});
const cells = files.map((f) => `<figure><img src="${pathToFileURL(path.join(dir, f)).href}"><figcaption>${Number(f.slice(1, -4)) - 1}s</figcaption></figure>`).join("");
const html = `<!doctype html><html><body style="margin:0;background:#222;font:700 13px system-ui;color:#fff">
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px">${cells}</div>
<style>figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:3px;top:2px;background:#000b;padding:1px 4px;border-radius:3px}</style></body></html>`;
const page = path.join(OUT, "sheet.html");
await writeFile(page, html);
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await tab.goto(pathToFileURL(page).href);
await tab.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true });
await browser.close();
console.log(files.length, "frames");
