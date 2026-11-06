// Step 2 of a job: exactly one Claude call per trailer. No agent loop, no retries on bad output:
// anything other than a clean, schema-valid plan returns a failure and the caller falls back
// to the no-AI planner.

import Anthropic from "@anthropic-ai/sdk";
import { config, type Effort, type ModelId } from "../config";
import type { StoredCapture } from "../capture/types";
import type { SpendLedger } from "./budget";
import { PLAN_JSON_SCHEMA } from "./json-schema";
import { costUsd, worstCaseUsd, type TokenUsage } from "./pricing";
import { buildUserContent, SYSTEM_PROMPT } from "./prompt";
import { PlanSchema, type Plan } from "./schema";

const MAX_TOKENS = 16_000;
/** Generous estimate of one planner prompt (four screenshots plus the element list). */
const PROMPT_TOKENS_ESTIMATE = 10_000;

export type ClaudeFailure = "no_api_key" | "budget" | "refusal" | "max_tokens" | "invalid_output" | "api_error";

export interface ClaudeAttempt {
  model: ModelId;
  effort: Effort;
  plan: Plan | null;
  failure: ClaudeFailure | null;
  detail: string | null;
  stopReason: string | null;
  usage: TokenUsage | null;
  costUsd: number;
  latencyMs: number;
  /** Raw model text, kept when it could not be parsed. */
  rawText: string | null;
}

let client: Anthropic | null = null;
function getClient(apiKey: string): Anthropic {
  // Only ever constructed with Premiere's own key. Passing apiKey explicitly stops the SDK from
  // falling back to other credentials on this machine (ANTHROPIC_API_KEY, an `ant` profile).
  client ??= new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
  return client;
}

function apiErrorDetail(err: InstanceType<typeof Anthropic.APIError>): string {
  const kind =
    err instanceof Anthropic.AuthenticationError
      ? "invalid API key"
      : err instanceof Anthropic.PermissionDeniedError
        ? "permission denied"
        : err instanceof Anthropic.RateLimitError
          ? "rate limited"
          : err instanceof Anthropic.BadRequestError
            ? "bad request (spend limit or credit balance?)"
            : err instanceof Anthropic.InternalServerError
              ? "API server error"
              : err instanceof Anthropic.APIConnectionError
                ? "could not reach the API"
                : `API error ${err.status ?? ""}`.trim();
  return `${kind}: ${err.message}`.slice(0, 300);
}

export async function planWithClaude(
  stored: StoredCapture,
  { model, effort, ledger }: { model: ModelId; effort: Effort; ledger: SpendLedger },
): Promise<ClaudeAttempt> {
  const base: ClaudeAttempt = {
    model,
    effort,
    plan: null,
    failure: null,
    detail: null,
    stopReason: null,
    usage: null,
    costUsd: 0,
    latencyMs: 0,
    rawText: null,
  };
  if (!config.apiKey) {
    return { ...base, failure: "no_api_key", detail: "PREMIERE_ANTHROPIC_API_KEY is not set in .env" };
  }
  const budget = await ledger.allows(worstCaseUsd(model, PROMPT_TOKENS_ESTIMATE, MAX_TOKENS));
  if (!budget.ok) {
    return {
      ...base,
      failure: "budget",
      detail: `monthly budget reached ($${budget.spentUsd.toFixed(4)} of $${budget.limitUsd})`,
    };
  }

  const started = Date.now();
  let response: Anthropic.Message;
  try {
    response = await getClient(config.apiKey).messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: await buildUserContent(stored) }],
      output_config: { effort, format: { type: "json_schema", schema: PLAN_JSON_SCHEMA } },
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    if (err instanceof Anthropic.APIError) return { ...base, latencyMs, failure: "api_error", detail: apiErrorDetail(err) };
    return { ...base, latencyMs, failure: "api_error", detail: err instanceof Error ? err.message : String(err) };
  }

  const latencyMs = Date.now() - started;
  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  };
  const cost = costUsd(model, usage);
  await ledger.record(cost);
  const result: ClaudeAttempt = { ...base, usage, costUsd: cost, latencyMs, stopReason: response.stop_reason };

  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "unspecified";
    return { ...result, failure: "refusal", detail: `refused (${category})` };
  }
  if (response.stop_reason === "max_tokens") {
    return { ...result, failure: "max_tokens", detail: `hit max_tokens (${MAX_TOKENS})` };
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ...result, failure: "invalid_output", detail: "response was not valid JSON", rawText: text.slice(0, 4000) };
  }
  const parsed = PlanSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ...result,
      failure: "invalid_output",
      detail: `JSON did not match the schema: ${parsed.error.message.slice(0, 200)}`,
      rawText: text.slice(0, 4000),
    };
  }
  return { ...result, plan: parsed.data };
}

export function describeFailure(attempt: ClaudeAttempt): string {
  return attempt.detail ?? attempt.failure ?? "unknown failure";
}
