// USD per million tokens: Anthropic first-party API list prices as of October 2026.
// Check https://claude.com/pricing before trusting a total; the Console usage page is the source of truth.

interface Rate {
  input: number;
  output: number;
}

type Price = Rate & { long?: Rate & { above: number } };

const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, long: { above: 100_000, input: 0.5, output: 2.5 } },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  // Models a server-side refusal fallback can route to.
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
};
/** Unknown models are priced high so the spend guard errs on the safe side. */
const UNKNOWN: Price = { input: 5, output: 25 };
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function costUsd(model: string, usage: TokenUsage): number {
  const price: Price = PRICES[model] ?? UNKNOWN;
  const promptTokens = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  const rate: Rate = price.long && promptTokens > price.long.above ? price.long : price;
  return (
    (usage.inputTokens * rate.input +
      usage.cacheWriteTokens * rate.input * CACHE_WRITE +
      usage.cacheReadTokens * rate.input * CACHE_READ +
      usage.outputTokens * rate.output) /
    1_000_000
  );
}

/** Upper bound for one call, used by the spend guard before calling. */
export function worstCaseUsd(model: string, promptTokens: number, maxTokens: number): number {
  return costUsd(model, { inputTokens: promptTokens, outputTokens: maxTokens, cacheWriteTokens: 0, cacheReadTokens: 0 });
}

/** The usage fields the API returns, top level or per attempt. */
export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

interface ApiIteration extends ApiUsage {
  type: string;
  model?: string | null;
}

export function toTokenUsage(u: ApiUsage): TokenUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
}

/**
 * Cost of one response. With a server-side refusal fallback, top-level usage covers only the
 * attempt that answered, so every attempt in usage.iterations is priced at its own model's rate.
 */
export function responseCostUsd(
  requestedModel: string,
  usage: ApiUsage & { iterations?: ApiIteration[] | null },
): { costUsd: number; usage: TokenUsage } {
  const attempts = (usage.iterations ?? []).filter((it) => it.type === "message" || it.type === "fallback_message");
  if (attempts.length === 0) {
    const tokens = toTokenUsage(usage);
    return { costUsd: costUsd(requestedModel, tokens), usage: tokens };
  }
  const total: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
  let cost = 0;
  for (const attempt of attempts) {
    const tokens = toTokenUsage(attempt);
    cost += costUsd(attempt.model ?? requestedModel, tokens);
    total.inputTokens += tokens.inputTokens;
    total.outputTokens += tokens.outputTokens;
    total.cacheWriteTokens += tokens.cacheWriteTokens;
    total.cacheReadTokens += tokens.cacheReadTokens;
  }
  return { costUsd: cost, usage: total };
}
