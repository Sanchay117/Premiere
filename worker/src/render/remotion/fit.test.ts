import assert from "node:assert/strict";
import { test } from "node:test";
import { emWidth, fitTitle } from "./fit";

test("a name with wide letters fits its column instead of breaking", () => {
  // At the old flat estimate "TLDRAW" got 250 px in a 540 px column and broke into "TLDRA" and "W".
  const size = fitTitle("TLDRAW", "gothic", 540, 260);
  assert.ok(size * emWidth("TLDRAW", "gothic") <= 540, `${size} px is too big`);
  assert.ok(size >= 190, `${size} px is needlessly small`);
});

test("short names stay at the cap, long single words shrink, long phrases wrap between words", () => {
  assert.equal(fitTitle("EXDIV", "gothic", 540, 260), 260);
  const word = "SUPERCALIFRAGILISTIC";
  assert.ok(fitTitle(word, "gothic", 540, 260) * emWidth(word, "gothic") <= 540);
  const phrase = "THE NIGHT SHIFT DRIVE IN";
  const wrapped = fitTitle(phrase, "gothic", 540, 260);
  assert.ok(wrapped * emWidth(phrase, "gothic") > 540, "expected it to wrap");
  assert.ok(wrapped * emWidth("NIGHT", "gothic") <= 540);
  // With wrapping off the whole phrase fits one line.
  const oneLine = fitTitle(phrase, "gothic", 540, 260, false);
  assert.ok(oneLine * emWidth(phrase, "gothic") <= 540);
});
