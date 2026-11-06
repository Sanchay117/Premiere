import assert from "node:assert/strict";
import { test } from "node:test";
import { alignWords, readingTime, silentLines } from "./deepgram";

const w = (word: string, start: number, end: number) => ({ word, start, end });

test("uses transcript timings when every word matches", () => {
  const { words, timing } = alignWords("Sketch your ideas.", [w("sketch", 0.2, 0.5), w("your", 0.5, 0.7), w("ideas", 0.7, 1.1)], 1.3);
  assert.equal(timing, "transcript");
  assert.deepEqual(words.map((x) => [x.text, x.start]), [["Sketch", 0.2], ["your", 0.5], ["ideas.", 0.7]]);
});

test("joins a name the transcript split into pieces", () => {
  const { words, timing } = alignWords(
    "Open Excalidraw today.",
    [w("open", 0.1, 0.3), w("excali", 0.35, 0.7), w("draw", 0.7, 0.95), w("today", 1.0, 1.4)],
    1.6,
  );
  assert.equal(timing, "transcript");
  assert.deepEqual(words.map((x) => [x.text, x.start, x.end]), [["Open", 0.1, 0.3], ["Excalidraw", 0.35, 0.95], ["today.", 1.0, 1.4]]);
});

test("interpolates words the transcript heard differently", () => {
  const { words } = alignWords("It takes 45 seconds.", [w("it", 0.1, 0.2), w("takes", 0.2, 0.5), w("forty", 0.5, 0.8), w("five", 0.8, 1.0), w("seconds", 1.0, 1.5)], 1.7);
  assert.equal(words.length, 4);
  assert.equal(words[2]!.text, "45");
  assert.ok(words[2]!.start >= 0.5 && words[2]!.end <= 1.0 + 1e-9, JSON.stringify(words[2]));
  assert.equal(words[3]!.start, 1.0);
});

test("without a narrator, every line is held long enough to read and its words fill the hold", () => {
  const plan = {
    appName: "Tidy",
    tagline: "Clean notes",
    mood: "calm" as const,
    hook: "Your notes deserve better.",
    shots: [{ action: "wait" as const, target: null, text: null, narration: "One tap turns a wall of text into a tidy list.", punch: "One tap" }],
    close: "Try Tidy today.",
    cta: "Try it",
    publicSafe: true,
  };
  const lines = silentLines(plan);
  assert.deepEqual(lines.map((l) => l.key), ["hook", "shot-1", "close"]);
  for (const line of lines) {
    assert.equal(line.duration, readingTime(line.text));
    assert.ok(line.duration >= 1.8);
    assert.equal(line.words.length, line.text.split(" ").length);
    assert.ok(line.words[0]!.start > 0 && line.words.at(-1)!.end <= line.duration);
    assert.equal(line.timing, "estimate");
  }
  // Eleven words take about two and a half words a second.
  assert.ok(Math.abs(lines[1]!.duration - 5) < 0.01);
});
