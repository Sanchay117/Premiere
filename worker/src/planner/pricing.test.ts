import assert from "node:assert/strict";
import { test } from "node:test";
import { responseCostUsd } from "./pricing";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("prices a plain response at the requested model's rate", () => {
  const { costUsd } = responseCostUsd("claude-sonnet-5-5", { input_tokens: 8000, output_tokens: 500 });
  near(costUsd, (8000 * 2 + 500 * 10) / 1e6);
});

test("prices every attempt of a refusal fallback at its own model's rate", () => {
  const { costUsd, usage } = responseCostUsd("claude-sonnet-5-5", {
    input_tokens: 8000,
    output_tokens: 400,
    iterations: [
      { type: "message", model: "claude-sonnet-5-5", input_tokens: 8000, output_tokens: 0 },
      { type: "fallback_message", model: "claude-sonnet-5", input_tokens: 8000, output_tokens: 400 },
    ],
  });
  near(costUsd, (8000 * 2 + 0) / 1e6 + (8000 * 2 + 400 * 10) / 1e6);
  assert.equal(usage.inputTokens, 16000);
});

test("prices unknown models conservatively", () => {
  const { costUsd } = responseCostUsd("claude-mystery-9", { input_tokens: 1_000_000, output_tokens: 0 });
  near(costUsd, 5);
});
