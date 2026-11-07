// npx tsx demo/src/sheet.ts [columns]
// Lays every still in demo/.out/stills out as a labelled grid (demo/.out/sheet.png), for review.

import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { OUT } from "./paths";

const columns = Number(process.argv[2] ?? 3);
const dir = path.join(OUT, "stills");
const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
const cells = files
  .map((f) => {
    const seconds = Number(f.slice(1, -4));
    return `<figure><img src="${pathToFileURL(path.join(dir, f)).href}"><figcaption>${seconds.toFixed(2)} s</figcaption></figure>`;
  })
  .join("");
const html = `<!doctype html><html><body style="margin:0;background:#222;font:600 18px system-ui;color:#fff">
<div style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:8px;padding:8px">${cells}</div>
<style>figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:6px;top:4px;background:#000a;padding:2px 6px;border-radius:4px}</style>
</body></html>`;
const page = path.join(OUT, "sheet.html");
await writeFile(page, html);
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await tab.goto(pathToFileURL(page).href);
await tab.waitForLoadState("load");
await tab.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true });
await browser.close();
console.log(path.join(OUT, "sheet.png"), files.length, "stills");
