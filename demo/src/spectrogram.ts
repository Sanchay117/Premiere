// npx tsx demo/src/spectrogram.ts [file] [from] [to]
// Draws a log-frequency spectrogram of the soundtrack (demo/.out/spectrogram.png), as a stand-in
// for listening: the arrangement, the voice, the kicks, and any hiss, ringing or dropout show up.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { readWav } from "../../worker/src/audio/wav";
import { OUT } from "./paths";

const file = process.argv[2] ?? path.join(OUT, "soundtrack.wav");
const pcm = readWav(await readFile(file));
const SR = pcm.sampleRate;
const mono = pcm.channels[0]!.map((x, i) => (x + (pcm.channels[1]?.[i] ?? x)) / 2);
const from = Number(process.argv[3] ?? 0);
const to = Math.min(Number(process.argv[4] ?? mono.length / SR), mono.length / SR);
const N = 4096;
const columns = 1500;
const rows = 360;

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2]! * wr - im[i + k + len / 2]! * wi;
        const ai = re[i + k + len / 2]! * wi + im[i + k + len / 2]! * wr;
        re[i + k + len / 2] = re[i + k]! - ar;
        im[i + k + len / 2] = im[i + k]! - ai;
        re[i + k] = re[i + k]! + ar;
        im[i + k] = im[i + k]! + ai;
      }
    }
  }
}

const image: number[] = [];
for (let c = 0; c < columns; c++) {
  const t = from + ((to - from) * c) / columns;
  const start = Math.floor(t * SR);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    re[i] = (mono[start + i] ?? 0) * w;
  }
  fft(re, im);
  for (let r = 0; r < rows; r++) {
    // Rows on a log scale from 30 Hz to 16 kHz.
    const f = 30 * Math.pow(16000 / 30, 1 - r / (rows - 1));
    const bin = Math.min(N / 2 - 1, Math.round((f / SR) * N));
    const mag = Math.hypot(re[bin]!, im[bin]!) / (N / 4);
    image.push(Math.max(0, Math.min(1, (20 * Math.log10(mag + 1e-9) + 90) / 80)));
  }
}

const html = `<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="${columns}" height="${rows}"></canvas>
<script>
const d = ${JSON.stringify(image.map((v) => Math.round(v * 255)))};
const c = document.getElementById("c").getContext("2d");
const img = c.createImageData(${columns}, ${rows});
for (let col = 0; col < ${columns}; col++) for (let r = 0; r < ${rows}; r++) {
  const v = d[col * ${rows} + r] / 255, i = (r * ${columns} + col) * 4;
  img.data[i] = Math.min(255, v * 2.2 * 255); img.data[i + 1] = Math.max(0, (v - 0.35) * 1.7 * 255); img.data[i + 2] = Math.max(0, (v - 0.7) * 3 * 255) + (1 - v) * 40; img.data[i + 3] = 255;
}
c.putImageData(img, 0, 0);
c.fillStyle = "#fff"; c.font = "12px sans-serif";
for (let s = Math.ceil(${from}); s <= ${to}; s += ${to - from > 60 ? 10 : 2}) { const x = (s - ${from}) / (${to - from}) * ${columns}; c.fillRect(x, ${rows} - 8, 1, 8); c.fillText(s + "s", x + 2, ${rows} - 10); }
for (const f of [100, 1000, 10000]) { const y = (1 - Math.log(f / 30) / Math.log(16000 / 30)) * ${rows - 1}; c.fillText(f >= 1000 ? f / 1000 + "k" : f, 2, y); }
</script></body>`;
const page = path.join(OUT, "spectrogram.html");
await writeFile(page, html);
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: columns, height: rows } });
await tab.goto(pathToFileURL(page).href);
await tab.screenshot({ path: path.join(OUT, "spectrogram.png") });
await browser.close();
console.log(path.join(OUT, "spectrogram.png"));
