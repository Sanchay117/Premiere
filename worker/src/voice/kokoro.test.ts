import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { NARRATORS, narratorFor, type Narrator } from "../options";
import type { Plan } from "../planner/schema";
import { KOKORO_VOICES, kokoroVoice, kokoroVoiceName, speechBounds, trimSilence } from "./kokoro";

// Deepgram's Aura-2 narrators, from Deepgram's voice list: Kokoro ids begin with the accent
// (a American, b British) and then the gender (f, m).
const AURA: Record<Narrator, string> = {
  atlas: "am",
  zeus: "am",
  asteria: "af",
  thalia: "af",
  ophelia: "af",
  athena: "af",
  draco: "bm",
  pandora: "bf",
};

// kokoro-js reads each voice from voices/<id>.bin beside its dist folder. Resolving the package
// finds that folder without loading the library, let alone the model.
const voicesDir = path.join(path.dirname(createRequire(import.meta.url).resolve("kokoro-js")), "..", "voices");

test("every narrator has a Kokoro stand-in of the same accent and gender, named after it", () => {
  assert.deepEqual(Object.keys(KOKORO_VOICES).sort(), Object.keys(NARRATORS).sort());
  for (const narrator of Object.keys(NARRATORS) as Narrator[]) {
    const { id, name } = KOKORO_VOICES[narrator];
    assert.equal(id.slice(0, 2), AURA[narrator], `${narrator} is read by ${id}`);
    assert.ok(existsSync(path.join(voicesDir, `${id}.bin`)), `kokoro-js ships no voice ${id}`);
    // The name shown is the voice's own (af_heart is Heart), so the screening room names who read it.
    assert.equal(name, id[3]!.toUpperCase() + id.slice(4));
  }
});

test("auto takes the stand-in for the narrator the mood picks", () => {
  const moods: Plan["mood"][] = ["energetic", "bold", "playful", "calm"];
  for (const mood of moods) {
    assert.deepEqual(kokoroVoice("auto", mood), KOKORO_VOICES[narratorFor("auto", mood)]);
    assert.equal(kokoroVoiceName("auto", mood), KOKORO_VOICES[narratorFor("auto", mood)].name);
  }
  assert.notEqual(kokoroVoice("auto", "calm").id, kokoroVoice("auto", "energetic").id);
  // A narrator picked by name keeps its stand-in whatever the mood.
  assert.equal(kokoroVoice("pandora", "energetic").id, "bf_emma");
  assert.equal(kokoroVoiceName("atlas", "calm"), "Michael");
});

const RATE = 24000;

/** A clip of faint hiss (60 dB down) with tones at the given level over the given spans. */
function clip(seconds: number, ...tones: { from: number; to: number; level: number }[]): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < samples.length; i++) {
    const t = i / RATE;
    const tone = tones.find((x) => t >= x.from && t < x.to);
    samples[i] = tone ? tone.level * Math.sin(2 * Math.PI * 220 * t) : 0.0005 * Math.sin(i * 2.4);
  }
  return samples;
}

const near = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= 0.011, `${what}: ${actual.toFixed(3)} s, expected ${expected} s`);

test("finds where the speech begins and ends, to the window", () => {
  const bounds = speechBounds(clip(2.6, { from: 0.4, to: 2.05, level: 0.5 }), RATE)!;
  near(bounds.start, 0.4, "start");
  near(bounds.end, 2.05, "end");
});

test("keeps a quiet final consonant after a short gap, but not a breath far below the voice", () => {
  const bounds = speechBounds(
    clip(
      3,
      { from: 0.4, to: 1.8, level: 0.5 },
      { from: 1.9, to: 1.95, level: 0.02 }, // 28 dB down: the release of a final "t"
      { from: 2.2, to: 2.5, level: 0.002 }, // 48 dB down: a breath
    ),
    RATE,
  )!;
  near(bounds.end, 1.95, "end");
});

test("trims the padding to a short lead-in and tail, and places the speech in what is left", () => {
  const trimmed = trimSilence(clip(2.6, { from: 0.4, to: 2.05, level: 0.5 }), RATE)!;
  near(trimmed.start, 0.06, "start");
  near(trimmed.end, 0.06 + 1.65, "end");
  near(trimmed.samples.length / RATE, 0.06 + 1.65 + 0.15, "length");
  const again = speechBounds(trimmed.samples, RATE)!;
  near(again.start, trimmed.start, "speech start in the trimmed clip");
  near(again.end, trimmed.end, "speech end in the trimmed clip");
});

test("speech at the very edges of a clip is kept whole", () => {
  const trimmed = trimSilence(clip(1, { from: 0, to: 1, level: 0.5 }), RATE)!;
  assert.equal(trimmed.samples.length, RATE);
  assert.equal(trimmed.start, 0);
  near(trimmed.end, 1, "end");
});

test("a silent clip has no speech", () => {
  assert.equal(speechBounds(new Float32Array(RATE), RATE), null);
  assert.equal(trimSilence(new Float32Array(0), RATE), null);
});
