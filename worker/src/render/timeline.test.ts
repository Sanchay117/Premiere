import assert from "node:assert/strict";
import { test } from "node:test";
import type { VoiceLine } from "../voice/deepgram";
import { toSrt, type Timeline } from "./timeline";

function line(text: string, start: number): VoiceLine {
  const words = text.split(" ").map((w, i) => ({ text: w, start: start + i * 0.3, end: start + i * 0.3 + 0.25 }));
  return { key: "x", text, pcm: { sampleRate: 48000, channels: [new Float32Array(1)] }, duration: words.length * 0.3, words, timing: "transcript" };
}

test("srt cues never overlap and never leave a short straggler", () => {
  const timeline: Timeline = {
    segments: [
      { kind: "title", start: 0, duration: 3.6, voiceAt: 0.5, line: line("Sketch your ideas as fast as you can think them.", 0) },
      { kind: "end", start: 3.6, duration: 4, voiceAt: 4.0, line: line("Open Excalidraw and start sketching your next idea today.", 0) },
    ],
    duration: 7.6,
    titleEnd: 3.6,
    endStart: 3.6,
    clicks: [],
    hits: [],
    skipped: [],
  };
  const srt = toSrt(timeline);
  const blocks = srt.trim().split(/\n\n/);
  const texts = blocks.map((b) => b.split("\n")[2]!);
  assert.ok(texts.every((t) => t.split(" ").length >= 4), texts.join(" | "));
  const times = blocks.map((b) => b.split("\n")[1]!.split(" --> ").map((s) => {
    const [h, m, rest] = s.split(":");
    const [sec, ms] = rest!.split(",");
    return Number(h) * 3600 + Number(m) * 60 + Number(sec) + Number(ms) / 1000;
  }));
  for (let i = 1; i < times.length; i++) assert.ok(times[i]![0]! >= times[i - 1]![1]!, `cue ${i + 1} overlaps cue ${i}`);
});
