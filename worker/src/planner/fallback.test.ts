import assert from "node:assert/strict";
import { test } from "node:test";
import { appNameFrom, fallbackPlan, primaryCta } from "./fallback";
import { planWords, WORDS_TARGET, WORDS_TARGETS } from "./schema";
import { testCapture } from "./test-capture";
import { validatePlan } from "./validate";

test("derives the app name from the title", () => {
  assert.equal(appNameFrom(testCapture()), "Tidy");
});

test("picks a safe primary call to action", () => {
  assert.equal(primaryCta(testCapture())?.id, "e3");
});

test("fallback plan is valid and close to the word target", () => {
  const capture = testCapture();
  const plan = fallbackPlan(capture);
  const v = validatePlan(plan, capture);
  assert.equal(v.usable, true, v.issues.join("; "));
  assert.equal(v.droppedShots, 0);
  assert.ok(plan.shots.length >= 4);
  assert.ok(planWords(plan) >= 70 && planWords(plan) <= WORDS_TARGET.walkthrough.max, `words: ${planWords(plan)}`);
  assert.equal(plan.close, "Try Tidy today at example-app.test.");
});

test("fallback still plans a bare page with no elements or sections", () => {
  const capture = { ...testCapture(), elements: [], sections: [], description: "" };
  const plan = fallbackPlan(capture);
  assert.ok(plan.shots.length >= 3);
  assert.ok(plan.shots.every((s) => s.target === null));
});

test("the no-AI tour keeps a short cut short", () => {
  const capture = testCapture();
  for (const [length, most] of [[15, 2], [30, 3]] as const) {
    const plan = fallbackPlan(capture, length);
    assert.ok(plan.shots.length <= most, `${length}s kept ${plan.shots.length} shots`);
    assert.ok(planWords(plan) <= WORDS_TARGETS.walkthrough[length].max + 10, `${length}s has ${planWords(plan)} words`);
  }
});
