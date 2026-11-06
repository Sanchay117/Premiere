import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrailerSegment } from "./remotion/types";
import { accentFrom, candidateTimes, frameStats, hueHistogram, pickBackdrop, type Candidate, type FrameStats } from "./thumbnail";

const W = 96;
const H = 54;

function image(color: (x: number, y: number) => [number, number, number]): Uint8Array {
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) rgb.set(color(x, y), (y * W + x) * 3);
  }
  return rgb;
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("color drawn as detail counts, a flat fill of the same color barely does", () => {
  const flatGrey = frameStats(image(() => [40, 40, 44]), W, H);
  const flatGreen = frameStats(image(() => [140, 220, 130]), W, H);
  const greenSquares = frameStats(image((x, y) => ((x >> 2) + (y >> 2)) % 2 ? [90, 200, 80] : [12, 14, 12]), W, H);
  assert.ok(flatGrey.contrast < 1 && flatGrey.vivid < 0.5);
  assert.ok(flatGreen.vivid < 0.5, `flat fill scored ${flatGreen.vivid}`);
  assert.ok(greenSquares.vivid > 20, `squares scored ${greenSquares.vivid}`);
});

const stats = (vivid: number, contrast = 40): FrameStats => ({ vivid, contrast });

test("the first shot is the backdrop unless a later one is far more colorful", () => {
  const hero: Candidate = { file: "hero.jpg", shot: 0, stats: stats(2.4) };
  const heroHover: Candidate = { file: "hover.jpg", shot: 0, stats: stats(2.3) };
  const footer: Candidate = { file: "footer.jpg", shot: 3, stats: stats(5) };
  assert.equal(pickBackdrop([hero, heroHover, footer])?.file, "hero.jpg");
  const product: Candidate = { file: "product.jpg", shot: 2, stats: stats(9) };
  assert.equal(pickBackdrop([hero, heroHover, product])?.file, "product.jpg");
});

test("a blank frame never wins while anything else is on offer", () => {
  const loading: Candidate = { file: "loading.jpg", shot: 0, stats: stats(0, 2) };
  const section: Candidate = { file: "section.jpg", shot: 1, stats: stats(0.4, 20) };
  assert.equal(pickBackdrop([loading, section])?.file, "section.jpg");
  assert.equal(pickBackdrop([loading])?.file, "loading.jpg");
  assert.equal(pickBackdrop([]), null);
});

test("the accent follows the app's color and reads on a dark poster", () => {
  const orange = accentFrom([hueHistogram(image((x) => (x < 30 ? [235, 130, 40] : [10, 10, 14])), W, H)]);
  assert.ok(orange);
  const [r, g, b] = hexRgb(orange);
  assert.ok(r! > g! && g! > b!, `expected an orange, got ${orange}`);

  // A dark navy brand is lifted until it is light enough for text on ink.
  const navy = accentFrom([hueHistogram(image((x) => (x < 30 ? [30, 50, 140] : [10, 10, 14])), W, H)]);
  assert.ok(navy);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [nr, ng, nb] = hexRgb(navy);
  assert.ok(0.2126 * lin(nr!) + 0.7152 * lin(ng!) + 0.0722 * lin(nb!) >= 0.29, `${navy} is too dark`);
  assert.ok(nb! > nr!, `expected a blue, got ${navy}`);

  assert.equal(accentFrom([hueHistogram(image((x, y) => ((x + y) % 2 ? [230, 230, 230] : [20, 20, 20])), W, H)]), null);
});

test("each filmed shot offers two moments, the title and end cards none", () => {
  const segments: TrailerSegment[] = [
    { kind: "title", from: 0, frames: 90, words: [] },
    { kind: "shot", from: 90, frames: 150, words: [], footageStart: 10, actionAt: 0.7, punchFrames: 30 },
    { kind: "shot", from: 240, frames: 120, words: [], footageStart: 20, actionAt: 1.5 },
    { kind: "end", from: 360, frames: 120, words: [] },
  ];
  const times = candidateTimes({ fps: 30, segments });
  assert.deepEqual(
    times.map(({ t, shot }) => ({ t: Math.round(t * 100) / 100, shot })),
    [
      { t: 11.7, shot: 0 },
      { t: 13.75, shot: 0 },
      { t: 22.5, shot: 1 },
      { t: 23.75, shot: 1 },
    ],
  );
});
