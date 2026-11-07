// npx tsx demo/src/analyze.ts
// Measures the soundtrack's balance from its stems: for each stretch of the video, how loud the
// music and the voice are, and how far the voice sits above the music while someone is talking.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { readWav } from "../../worker/src/audio/wav";
import type { DemoProps } from "../remotion/types";
import { OUT } from "./paths";
import { Svf } from "./dsp";

const load = async (name: string) => readWav(await readFile(path.join(OUT, "stems", name)));
const music = await load("music.wav");
const voices = await load("voices.wav");
const props = JSON.parse(await readFile(path.join(OUT, "props.json"), "utf8")) as DemoProps;
const SR = music.sampleRate;
const dbfs = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

function rms(pcm: typeof music, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from * SR));
  const b = Math.min(pcm.channels[0]!.length, Math.floor(to * SR));
  let sum = 0;
  for (let i = a; i < b; i++) for (const ch of pcm.channels) sum += ch[i]! * ch[i]!;
  return Math.sqrt(sum / Math.max(1, (b - a) * pcm.channels.length));
}
function peak(pcm: typeof music, from: number, to: number): number {
  let p = 0;
  for (const ch of pcm.channels) for (let i = Math.floor(from * SR); i < Math.min(ch.length, Math.floor(to * SR)); i++) p = Math.max(p, Math.abs(ch[i]!));
  return p;
}

/** The music in the speech band, 300 Hz to 4 kHz, where it can mask the voice. */
const band = {
  sampleRate: SR,
  channels: music.channels.map((ch) => {
    const hp1 = new Svf(300);
    const hp2 = new Svf(300);
    const lp = new Svf(4000);
    return ch.map((x) => {
      hp1.process(x);
      hp2.process(hp1.high);
      return lp.process(hp2.high);
    });
  }),
};

const lines = [...props.trailerLines, ...props.guideLines].sort((a, b) => a.at - b.at);
console.log("line        voice dB   music dB   speech-band music   voice over band");
for (const l of lines) {
  const v = rms(voices, l.at, l.at + l.duration);
  const m = rms(music, l.at, l.at + l.duration);
  const mb = rms(band, l.at, l.at + l.duration);
  console.log(`${l.key.padEnd(10)} ${dbfs(v).toFixed(1).padStart(7)} ${dbfs(m).toFixed(1).padStart(10)} ${dbfs(mb).toFixed(1).padStart(14)} ${(dbfs(v) - dbfs(mb)).toFixed(1).padStart(14)} dB`);
}
const sections = [
  ["leader", 0, 4],
  ["every app", 4, 8],
  ["skip it", 8, 12],
  ["marquee", 12, 16],
  ["drop", 16, 26],
  ["wall", 26, 30],
  ["title", 30, 34],
  ["walkthrough", 34, props.walkEnd],
  ["graphics", props.walkEnd, props.graphics.find((g) => g.key === "close")!.start],
  ["close", props.graphics.find((g) => g.key === "close")!.start, props.durationInFrames / props.fps],
] as const;
console.log("\nsection        music rms   music peak");
for (const [name, a, b] of sections) console.log(`${name.padEnd(14)} ${dbfs(rms(music, a, b)).toFixed(1).padStart(8)} ${dbfs(peak(music, a, b)).toFixed(1).padStart(11)}`);

// Tonal balance of the music before ducking: energy per octave, relative to the loudest octave.
const dry = await load("music-dry.wav");
const octaves = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
for (const [name, a, b] of [["drop", 16, 26], ["bed", 40, 80], ["close", props.graphics.find((g) => g.key === "close")!.start, props.durationInFrames / props.fps - 1]] as const) {
  const levels = octaves.map((fc) => {
    const f1 = new Svf(fc, 1.4);
    const f2 = new Svf(fc, 1.4);
    const ch = dry.channels[0]!;
    let sum = 0;
    const i0 = Math.floor(a * SR);
    const i1 = Math.floor(b * SR);
    for (let i = i0; i < i1; i++) {
      f1.process(ch[i]!);
      f2.process(f1.band);
      sum += f2.band * f2.band;
    }
    return 10 * Math.log10(sum / (i1 - i0) + 1e-20);
  });
  const top = Math.max(...levels);
  console.log(`${name.padEnd(6)} ${octaves.map((fc, i) => `${fc}:${(levels[i]! - top).toFixed(0)}`).join("  ")}`);
}
