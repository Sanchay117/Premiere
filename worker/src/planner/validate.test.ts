import assert from "node:assert/strict";
import { test } from "node:test";
import { EM_DASH } from "../lib/text";
import { WORDS_TARGET, type PlanInput as Plan } from "./schema";
import { testCapture } from "./test-capture";
import { validatePlan, WORDS_HARD } from "./validate";

const narration = "This line has exactly thirteen words so the totals stay easy to check.";

function plan(shots: Plan["shots"]): Plan {
  return {
    appName: "Tidy",
    tagline: "Clean notes in seconds",
    mood: "calm",
    hook: "Your meeting notes deserve better than a wall of text.",
    shots,
    close: "Try Tidy free today and clean up your next meeting.",
    cta: "Try it free",
  };
}

test("keeps valid shots and drops unsafe or unknown ones", () => {
  const v = validatePlan(
    plan([
      { action: "type", target: "e2", text: "Standup: Sam ships login fix by Friday", narration },
      { action: "click", target: "e3", text: null, narration },
      { action: "type", target: "e4", text: "me@example.com", narration }, // sensitive field
      { action: "click", target: "e5", text: null, narration }, // external link
      { action: "click", target: "e6", text: null, narration }, // destructive
      { action: "click", target: "e8", text: null, narration }, // mailto
      { action: "hover", target: "e99", text: null, narration }, // unknown id
      { action: "scroll", target: "s2", text: null, narration },
      { action: "scroll", target: "s77", text: null, narration }, // unknown section: becomes a plain scroll
      { action: "wait", target: "e3", text: "ignored", narration },
    ]),
    testCapture(),
  );
  assert.deepEqual(
    v.plan.shots.map((s) => [s.action, s.target]),
    [
      ["type", "e2"],
      ["click", "e3"],
      ["scroll", "s2"],
      ["scroll", null],
      ["wait", null],
    ],
  );
  assert.equal(v.droppedShots, 5);
  assert.equal(v.plan.shots[4]?.text, null);
  assert.ok(v.issues.some((i) => i.includes("sensitive")));
  assert.ok(v.issues.some((i) => i.includes("leaves the site")));
  assert.ok(v.issues.some((i) => i.includes("destructive")));
});

test("turns hovers on section ids into scrolls and drops login clicks", () => {
  const v = validatePlan(
    plan([
      { action: "hover", target: "s2", text: null, narration },
      { action: "click", target: "s3", text: null, narration },
      { action: "click", target: "e9", text: null, narration }, // "Log in"
      { action: "hover", target: "e9", text: null, narration }, // hovering is harmless
      { action: "type", target: "s4", text: "notes", narration }, // cannot type into a section
    ]),
    testCapture(),
  );
  assert.deepEqual(
    v.plan.shots.map((s) => [s.action, s.target]),
    [
      ["scroll", "s2"],
      ["scroll", "s3"],
      ["hover", "e9"],
    ],
  );
  assert.ok(v.issues.some((i) => i.includes("login form")));
});

test("removes em dashes from narration and titles", () => {
  const v = validatePlan(
    {
      ...plan([
        { action: "scroll", target: "s2", text: null, narration: `Notes go in ${EM_DASH} action items come out, ready to share` },
        { action: "scroll", target: "s3", text: null, narration },
        { action: "scroll", target: "s4", text: null, narration },
      ]),
      tagline: `Notes${EM_DASH}sorted`,
    },
    testCapture(),
  );
  assert.equal(v.plan.shots[0]?.narration, "Notes go in, action items come out, ready to share.");
  assert.equal(v.plan.tagline, "Notes, sorted");
  assert.ok(!JSON.stringify(v.plan).includes(EM_DASH));
});

test("rejects plans that would make a badly short trailer", () => {
  const v = validatePlan(plan([{ action: "scroll", target: null, text: null, narration: "Short." }]), testCapture());
  assert.equal(v.usable, false);
});

test("every style's word target clears the hard floor, and a rejection says why", () => {
  for (const [style, target] of Object.entries(WORDS_TARGET)) {
    assert.ok(target.min > WORDS_HARD.min, `${style} target starts at ${target.min}, under the floor`);
  }
  // A tight 56-word hype script (Opus wrote one for Fundable) is fine.
  const hype = validatePlan(
    {
      ...plan(Array.from({ length: 6 }, () => ({ action: "scroll" as const, target: null, text: null, narration: "Seven words in every single line, really." }))),
      hook: "Is your app worth backing today?",
      close: "Find out at the link below right now.",
    },
    testCapture(),
    "hype",
  );
  assert.equal(hype.words, 6 * 7 + 6 + 8);
  assert.equal(hype.usable, true);
  const short = validatePlan(plan([{ action: "scroll", target: null, text: null, narration: "Short." }]), testCapture());
  assert.ok(short.issues.some((issue) => issue.includes("a trailer needs")), short.issues.join("; "));
});

test("accepts a full plan near the word target", () => {
  const v = validatePlan(
    plan(Array.from({ length: 7 }, () => ({ action: "scroll" as const, target: null, text: null, narration }))),
    testCapture(),
  );
  assert.equal(v.usable, true);
  assert.equal(v.words, 7 * 13 + 10 + 10);
});
