import assert from "node:assert/strict";
import { test } from "node:test";
import { EM_DASH } from "../lib/text";
import { DEFAULT_OPTIONS } from "../options";
import type { Plan } from "../planner/schema";
import { applyRecut } from "./recut";

const plan: Plan = {
  appName: "Tidy",
  tagline: "Notes, sorted",
  mood: "calm",
  hook: "Meetings end in a mess of notes.",
  shots: [
    { action: "wait", target: null, text: null, narration: "Paste your notes in.", punch: "Paste notes" },
    { action: "click", target: "e1", text: null, narration: "Tidy finds every decision.", punch: "Find decisions" },
  ],
  close: "Try Tidy today.",
  cta: "Try it free",
  publicSafe: true,
};
const options = { ...DEFAULT_OPTIONS, voice: "athena" as const };

test("a recut changes only what was edited, cleaned like the planner's copy", () => {
  const recut = applyRecut(plan, options, {
    shots: [{}, { narration: `  tidy finds every decision ${EM_DASH} and every deadline\n`, punch: "Every single deadline, found" }],
  });
  assert.ok(recut.ok);
  assert.equal(recut.plan.hook, plan.hook);
  assert.equal(recut.plan.shots[0]!.narration, plan.shots[0]!.narration);
  assert.equal(recut.plan.shots[1]!.narration, "Tidy finds every decision, and every deadline.");
  assert.equal(recut.plan.shots[1]!.punch, "Every single deadline, found");
  assert.equal(recut.plan.shots[1]!.target, "e1");
  assert.deepEqual(recut.options, options);
});

test("a recut may swap only the narrator or the caption look", () => {
  const voice = applyRecut(plan, options, { voice: "pandora" });
  assert.ok(voice.ok && voice.options.voice === "pandora" && voice.options.captions === options.captions);
  const captions = applyRecut(plan, options, { captions: "bold", voice: "nobody" });
  assert.ok(captions.ok && captions.options.captions === "bold" && captions.options.voice === "athena");
  // The cut, running time and screen were filmed for, so they never change.
  const fixed = applyRecut(plan, options, { captions: "boxed", style: "walkthrough", length: 15, format: "vertical" });
  assert.ok(fixed.ok && fixed.options.style === options.style && fixed.options.length === 45 && fixed.options.format === "landscape");
});

test("a recut is refused when nothing changed, a line is empty, or the script runs long", () => {
  const same = applyRecut(plan, options, { hook: plan.hook, voice: "athena", shots: [{ narration: plan.shots[0]!.narration }] });
  assert.ok(!same.ok && /Nothing changed/.test(same.error));
  const empty = applyRecut(plan, options, { close: "   " });
  assert.ok(!empty.ok && /closing line is empty/.test(empty.error));
  // Each line stops at 240 characters, and a 15 second trailer holds at most 55 words.
  const long = applyRecut(plan, { ...options, length: 15 }, { hook: "word ".repeat(80) });
  assert.ok(!long.ok && /A 15 second trailer holds at most 55/.test(long.error), long.ok ? "" : long.error);
  const extra = applyRecut(plan, options, { shots: [{}, {}, { narration: "A third shot." }] });
  assert.ok(!extra.ok);
  // An emptied punch title keeps the first take's.
  const punch = applyRecut(plan, options, { shots: [{ punch: "  " }], voice: "zeus" });
  assert.ok(punch.ok && punch.plan.shots[0]!.punch === "Paste notes");
});
