import assert from "node:assert/strict";
import { test } from "node:test";
import type { VoiceLine } from "../voice/deepgram";
import type { Plan } from "../planner/schema";
import type { Recording } from "../record/recorder";
import { buildTimeline, pacing, toSrt, type Timeline } from "./timeline";

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

function voiced(key: string, seconds: number): VoiceLine {
  return { key, text: "x", pcm: { sampleRate: 48000, channels: [new Float32Array(1)] }, duration: seconds, words: [], timing: "estimate" };
}

/** A hype trailer whose shot lines all take the given seconds, filmed with footage to spare. */
function hypeCut(shotSeconds: number, shots: number) {
  const plan = {
    appName: "App",
    tagline: "",
    mood: "energetic",
    hook: "x",
    shots: Array.from({ length: shots }, () => ({ action: "wait", target: null, text: null, narration: "x", punch: "Go" })),
    close: "x",
    cta: "Try it",
    publicSafe: true,
  } as Plan;
  const lines = [voiced("hook", 3), voiced("close", 3), ...plan.shots.map((_, i) => voiced(`shot-${i + 1}`, shotSeconds))];
  const recording = {
    width: 1920,
    height: 1080,
    frames: [],
    shots: plan.shots.map((_, i) => ({ index: i, ok: true, error: null, start: i * 10, actionAt: i * 10 + 0.7, end: i * 10 + 10, box: null, typed: null, url: "" })),
  } as Recording;
  return { pacing: pacing(lines, plan, "hype"), timeline: buildTimeline(lines, plan, recording, "hype") };
}

test("a hype cut keeps its full beats when it fits in 46 seconds", () => {
  const { pacing: p, timeline } = hypeCut(3.5, 6);
  assert.deepEqual(p, { punch: 1, tail: 0.4 });
  assert.ok(timeline.duration <= 46, `${timeline.duration}`);
});

test("a long hype cut trims its beats evenly to land on 46 seconds", () => {
  const { pacing: p, timeline } = hypeCut(4.2, 6);
  assert.ok(p.punch < 1 && p.punch >= 0.75, `punch ${p.punch}`);
  assert.ok(Math.abs(timeline.duration - 46) < 0.05, `${timeline.duration}`);
});

test("a very long hype cut stops at the shortest beats", () => {
  const { pacing: p } = hypeCut(4.5, 7);
  assert.deepEqual(p, { punch: 0.75, tail: -0.25 });
});
