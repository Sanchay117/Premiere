import type { ModelId } from "../config";

// USD per million tokens: Anthropic first-party API list prices as of October 2026.
// Check https://claude.com/pricing before trusting a total; the Console usage page is the source of truth.
const PRICES: Record<ModelId, { input: number; output: number; long?: { above: number; input: number; output: number } }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, long: { above: 100_000, input: 0.5, output: 2.5 } },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function costUsd(model: ModelId, usage: TokenUsage): number {
  const price = PRICES[model];
  const promptTokens = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  const rate = price.long && promptTokens > price.long.above ? price.long : price;
  return (
    (usage.inputTokens * rate.input +
      usage.cacheWriteTokens * rate.input * CACHE_WRITE +
      usage.cacheReadTokens * rate.input * CACHE_READ +
      usage.outputTokens * rate.output) /
    1_000_000
  );
}

/** Upper bound for one call, used by the spend guard before calling. */
export function worstCaseUsd(model: ModelId, promptTokens: number, maxTokens: number): number {
  return costUsd(model, { inputTokens: promptTokens, outputTokens: maxTokens, cacheWriteTokens: 0, cacheReadTokens: 0 });
}
