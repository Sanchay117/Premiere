// npx tsx demo/src/build.ts
// Lays out the demo: places the trailer voice on the opening's bars, then each walkthrough line in
// turn over its stretch of the screen recording (sped up where the wait was long), with camera
// moves, chapters, the finished trailer over the page's player, and the motion graphic beats.
// Writes demo/.out/props.json for the render, and the soundtrack (see score.ts).

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { copyApps } from "./apps";
import { JOBS, OUT } from "./paths";
import { GUIDE_LINES, TRAILER_LINES } from "./script";
import type { RecEvent } from "./record";
import type { VoicedLine } from "./voice";
import type { CameraKey, Chapter, DemoProps, Line, RecPart } from "../remotion/types";
import { makeSoundtrack } from "./score";

const FPS = 30;
const INTRO = 34;
/** A breath after each line before the next begins. */
const PAD = 0.45;
/** The vertical cut shown in the formats beat: Excalidraw, 30 s, made on 7 Nov. */
const VERTICAL_JOB = "5fa4c5b1-5084-43cd-92a6-36bc3dde99e2";

const voice = JSON.parse(await readFile(path.join(OUT, "voice.json"), "utf8")) as { trailer: VoicedLine[]; guide: VoicedLine[] };
const rec = JSON.parse(await readFile(path.join(OUT, "rec", "recording.json"), "utf8")) as {
  started: number;
  viewport: { width: number; height: number };
  scale: number;
  jobs: { first: string; recut: string };
  frames: { t: number; file: string }[];
  events: RecEvent[];
};

const rel = (t: number) => t - rec.started;
const markAt = (name: string) => {
  const found = rec.events.find((e) => e.kind === "mark" && e.name === name);
  if (!found) throw new Error(`no mark ${name} in the recording`);
  return rel(found.t);
};
const firstClickAfter = (t: number) => rec.events.filter((e) => e.kind === "click").map((e) => rel(e.t)).find((c) => c >= t) ?? t;

// Footage and clips the render needs, next to the recording.
await mkdir(path.join(OUT, "clips"), { recursive: true });
await copyFile(path.join(JOBS, rec.jobs.first, "trailer.mp4"), path.join(OUT, "clips", "first.mp4"));
await copyFile(path.join(JOBS, VERTICAL_JOB, "trailer.mp4"), path.join(OUT, "clips", "vertical.mp4"));
const apps = await copyApps();
// The script on the screenplay page is the one Claude wrote for the recorded order.
const firstJob = JSON.parse(await readFile(path.join(JOBS, rec.jobs.first, "job.json"), "utf8")) as {
  view: { result: { plan: { hook: string; shots: { narration: string }[] } } };
};
const plan = firstJob.view.result.plan;

// The opening trailer's lines sit on the bars the scenes were cut to.
const trailerLines: Line[] = TRAILER_LINES.map((l) => {
  const v = voice.trailer.find((x) => x.key === l.key)!;
  return { key: l.key, text: v.text, file: v.file, at: l.at, duration: v.duration, words: v.words };
});

// The walkthrough, one beat per line.
const guideLines: Line[] = [];
const parts: RecPart[] = [];
let t = INTRO + 0.5;
const beat = (key: (typeof GUIDE_LINES)[number]["key"], minimum = 0) => {
  const v = voice.guide.find((x) => x.key === key)!;
  const start = t;
  const length = Math.max(v.duration + PAD, minimum);
  guideLines.push({ key, text: v.text, file: v.file, at: start + 0.15, duration: v.duration, words: v.words });
  t = start + length;
  return { start, end: t };
};
/** Spreads a beat's time over stretches of the recording, each given its share of the beat. */
const film = (span: { start: number; end: number }, ranges: [number, number, number][]) => {
  const total = ranges.reduce((a, r) => a + r[2], 0);
  let at = span.start;
  for (const [from, to, share] of ranges) {
    const length = ((span.end - span.start) * share) / total;
    parts.push({ outStart: at, outEnd: at + length, recStart: from, recEnd: to });
    at += length;
  }
};

const m = {
  url: markAt("url"),
  options: markAt("options"),
  roll: markAt("roll"),
  job: markAt("capture:active"),
  planActive: markAt("plan:active"),
  storyboard: markAt("storyboard"),
  back: markAt("back-to-strip"),
  recorded: markAt("record:done"),
  done: markAt("done"),
  player: markAt("player"),
  ready: markAt("ready"),
  recut: markAt("recut"),
  recutJob: markAt("recut-job"),
  recutDone: markAt("recut-done"),
};
const ordered = firstClickAfter(m.roll);

const home = beat("home");
// From the moment the site's own film leader hands over to the hero.
film(home, [[3.3, m.url, 1]]);
const url = beat("url");
film(url, [[m.url, m.options, 1]]);
const options = beat("options");
film(options, [[m.options, m.roll, 1]]);
const roll = beat("roll", 3.2);
film(roll, [[m.roll, m.job + 0.2, 1]]);
const capture = beat("capture");
film(capture, [[m.job + 0.2, m.planActive, 1]]);
const planned = beat("plan");
film(planned, [[m.planActive, m.back + 1.8, 1]]);
const filmed = beat("film");
film(filmed, [[m.back + 1.8, m.recorded, 1]]);
const cut = beat("cut");
film(cut, [[m.recorded, m.done + 0.5, 1]]);

// The finished trailer plays over the page's player, with its own sound and no narration.
const trailerSpan = { start: t, end: t + 10.2 };
t = trailerSpan.end;
film(trailerSpan, [
  [m.done + 0.5, m.player, 1.2],
  [m.player, m.ready, 9],
]);
const ready = beat("ready");
film(ready, [[m.ready, m.recut, 1]]);
const recut = beat("recut", 8.2);
film(recut, [
  [m.recut, m.recutJob, 5.6],
  [m.recutJob, m.recutDone + 0.6, 2.6],
]);
// Then the recut plays, so the new line is heard in the new voice.
const player2At = box("player2").t;
const recutPlay = { start: t, end: t + 5 };
t = recutPlay.end;
film(recutPlay, [
  [m.recutDone + 0.6, rel(player2At), 0.8],
  [rel(player2At), rel(player2At) + 4.4, 4.2],
]);
const walkEnd = t;
const formats = beat("formats", 6.8);
const agents = beat("agents", 8.4);
const close = beat("close", 12.5);
const duration = t;

/** Video time for a recording time, through the parts. */
function outAt(recT: number): number {
  for (const p of parts) {
    if (recT >= p.recStart && recT <= p.recEnd) return p.outStart + ((recT - p.recStart) / (p.recEnd - p.recStart)) * (p.outEnd - p.outStart);
  }
  const before = parts.filter((p) => p.recEnd < recT).at(-1);
  return before ? before.outEnd : INTRO;
}

function box(name: string) {
  const found = rec.events.find((e): e is Extract<RecEvent, { kind: "box" }> => e.kind === "box" && e.name === name);
  if (!found) throw new Error(`no box ${name}`);
  return found;
}
const player = box("player");
const player2 = box("player2");
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ cx: b.x + b.w / 2, cy: b.y + b.h / 2 });
/** The zoom at which a box fills the frame's width: the stage shows the 1440 px page 1600 px wide. */
const fill = (b: { w: number }) => 1920 / (b.w * (1600 / 1440)) + 0.004;
// The screening room's film strip: five cells, 234 px wide with 8 px gaps, from x 120.
const cell = (i: number, cy: number) => ({ cx: 237 + 241.6 * i, cy });
const stripTop = box("strip").y + 80;

const camera: CameraKey[] = [
  { at: home.start, z: 1, focusY: 0.5 },
  { at: outAt(m.url) - 0.2, z: 1.3, cx: 560, cy: 590 },
  { at: outAt(m.options + 1.3), z: 1.5, follow: true },
  { at: outAt(m.roll + 1.0), z: 1.6, cx: 400, cy: 300 },
  { at: outAt(ordered + 0.6), z: 1, focusY: 0.5 },
  { at: outAt(m.job + 0.4), z: 1.3, cx: 720, cy: 440 },
  // A little higher than usual, so the page's huge title stays out of the top of the frame.
  { at: outAt(m.job + 2.6), z: 2.1, ...cell(0, stripTop), focusY: 0.36 },
  { at: outAt(m.planActive), z: 2.1, ...cell(1, stripTop), focusY: 0.36 },
  { at: outAt(m.storyboard + 0.3), z: 1.12, cx: 720, cy: 470 },
  { at: outAt(m.back + 0.2), z: 2.4, ...cell(3, 250) },
  { at: outAt(m.recorded), z: 2.4, ...cell(4, 250) },
  { at: outAt(m.done + 0.6), z: 1, focusY: 0.5 },
  { at: outAt(m.player), z: 1.05, ...centre(player), focusY: 0.5 },
  // Then into the player until the trailer fills the frame (the window bar sits above the page,
  // so the focus is nudged up by half its height).
  { at: outAt(m.player) + 1.0, z: fill(player), ...centre(player), focusY: 0.5 - (40 * fill(player)) / 2 / 1080 },
  { at: outAt(m.ready + 0.2), z: 1.9, cx: 420, cy: 290 },
  { at: outAt(m.recut + 0.3), z: 1.7, cx: 420, cy: 220 },
  { at: outAt(m.recut + 3.6), z: 1.5, follow: true },
  { at: outAt(m.recutJob + 0.3), z: 1.7, cx: 1000, cy: stripTop },
  { at: outAt(rel(player2At)), z: 1.05, ...centre(player2), focusY: 0.5 },
  { at: outAt(rel(player2At)) + 0.9, z: fill(player2), ...centre(player2), focusY: 0.5 - (40 * fill(player2)) / 2 / 1080 },
];

const chapters: Chapter[] = [
  { at: home.start, until: roll.end, reel: 1, title: "THE BOX OFFICE" },
  { at: capture.start, until: cut.end, reel: 2, title: "THE SHOOT" },
  { at: trailerSpan.start, until: ready.end, reel: 3, title: "THE PREMIERE" },
  { at: recut.start, until: recutPlay.end, reel: 4, title: "THE CUTTING ROOM" },
  { at: formats.start, until: formats.end, reel: 5, title: "ANY SCREEN" },
  { at: agents.start, until: agents.end, reel: 6, title: "FOR AGENTS" },
];

// A badge wherever the wait is sped up a lot, with the real clock since the order where it helps.
const timelapses = parts
  .map((p) => ({ p, speed: (p.recEnd - p.recStart) / (p.outEnd - p.outStart) }))
  .filter(({ speed }) => speed >= 3)
  .map(({ p, speed }) => ({
    start: p.outStart,
    end: p.outEnd,
    speed: Math.round(speed),
    realStart: p.recStart < m.recut ? p.recStart - ordered : -1,
  }));

await copyFile(path.join(JOBS, rec.jobs.recut, "trailer.mp4"), path.join(OUT, "clips", "recut.mp4"));
const overlays = [
  { file: "clips/first.mp4", start: outAt(m.player), end: trailerSpan.end, box: { x: player.x, y: player.y, w: player.w, h: player.h }, from: 0 },
  { file: "clips/recut.mp4", start: outAt(rel(player2At)), end: recutPlay.end, box: { x: player2.x, y: player2.y, w: player2.w, h: player2.h }, from: 0 },
];

const props: DemoProps = {
  base: "",
  fps: FPS,
  durationInFrames: Math.round(duration * FPS),
  introSeconds: INTRO,
  apps,
  script: { hook: plan.hook, lines: plan.shots.map((s) => s.narration) },
  trailerLines,
  guideLines,
  rec: {
    viewport: rec.viewport,
    scale: rec.scale,
    frames: rec.frames.map((f) => ({ t: rel(f.t), file: `rec/frames/${f.file}` })),
    moves: rec.events.filter((e): e is Extract<RecEvent, { kind: "move" }> => e.kind === "move").map((e) => ({ t: rel(e.t), until: rel(e.until), x: e.x, y: e.y })),
    clicks: rec.events.filter((e): e is Extract<RecEvent, { kind: "click" }> => e.kind === "click").map((e) => ({ t: rel(e.t), x: e.x, y: e.y })),
  },
  parts,
  camera,
  chapters,
  timelapses,
  overlays,
  graphics: [
    { key: "formats", start: formats.start, end: formats.end },
    { key: "agents", start: agents.start, end: agents.end },
    { key: "close", start: close.start, end: close.end },
  ],
  walkEnd,
  vertical: "clips/vertical.mp4",
  wide: "clips/first.mp4",
  soundtrack: "soundtrack.wav",
};

// Interface sounds: each click, each key typed (the recorder typed at a steady pace after its
// clicks into the field), and a soft whoosh on the camera's bigger moves.
const recClicks = props.rec.clicks.map((c) => c.t);
const inWalk = (t: number) => t >= INTRO && t <= walkEnd;
const typed = (afterClick: number, lead: number, count: number, gap: number) => Array.from({ length: count }, (_, i) => outAt(afterClick + lead + i * gap));
const urlClick = recClicks.find((c) => c >= m.url)!;
const hookClick = recClicks.filter((c) => c >= m.recut)[1]!;
const cues = {
  clicks: recClicks.map(outAt).filter(inWalk),
  keys: [...typed(urlClick, 0.37, 24, 0.089), ...typed(hookClick, 0.3, 39, 0.058)].filter(inWalk),
  moves: camera.slice(1).filter((k, i) => Math.abs(Math.log(k.z / camera[i]!.z)) > 0.12).map((k) => k.at - 0.1),
};

await writeFile(path.join(OUT, "props.json"), JSON.stringify(props));
await makeSoundtrack(props, path.join(OUT, "soundtrack.wav"), cues);
console.log(`Demo: ${duration.toFixed(1)} s (${props.durationInFrames} frames), walkthrough ${INTRO}-${walkEnd.toFixed(1)} s`);
for (const p of parts) console.log(`  ${p.outStart.toFixed(1)}-${p.outEnd.toFixed(1)} s  rec ${p.recStart.toFixed(1)}-${p.recEnd.toFixed(1)}  x${((p.recEnd - p.recStart) / (p.outEnd - p.outStart)).toFixed(1)}`);
