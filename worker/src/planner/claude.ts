// Step 2 of a job: exactly one Claude call per trailer. No agent loop, no retries on bad output:
// anything other than a clean, schema-valid plan returns a failure and the caller falls back
// to the no-AI planner.

import Anthropic from "@anthropic-ai/sdk";
import { config, type Effort, type ModelId } from "../config";
import type { StoredCapture } from "../capture/types";
import type { SpendLedger } from "./budget";
import { PLAN_JSON_SCHEMA } from "./json-schema";
import { responseCostUsd, worstCaseUsd, type TokenUsage } from "./pricing";
import type { TrailerStyle } from "../options";
import { buildUserContent, systemPrompt } from "./prompt";
import { PlanSchema, type Plan } from "./schema";

const MAX_TOKENS = 16_000;
/** Generous estimate of one planner prompt (four screenshots plus the element list). */
const PROMPT_TOKENS_ESTIMATE = 10_000;

/**
 * Models that support the server-side refusal fallback (`fallbacks: "default"`). For Sonnet 5.5 it
 * retries cyber and frontier_llm declines on Sonnet 5, at the same price, inside the same call.
 * That matters for apps about security tools, whose pages can trip the cyber classifier.
 * Haiku 5.5 has no server-side fallback.
 */
const SERVER_FALLBACK = new Set<ModelId>(["claude-sonnet-5-5", "claude-opus-5-5"]);
const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type ClaudeFailure = "no_api_key" | "budget" | "refusal" | "max_tokens" | "invalid_output" | "api_error";

export interface ClaudeAttempt {
  model: ModelId;
  effort: Effort;
  plan: Plan | null;
  failure: ClaudeFailure | null;
  detail: string | null;
  stopReason: string | null;
  /** Model that produced the returned message (differs from `model` after a refusal fallback). */
  servedBy: string | null;
  fallbackRan: boolean;
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
  { model, effort, ledger, style }: { model: ModelId; effort: Effort; ledger: SpendLedger; style: TrailerStyle },
): Promise<ClaudeAttempt> {
  const base: ClaudeAttempt = {
    model,
    effort,
    plan: null,
    failure: null,
    detail: null,
    stopReason: null,
    servedBy: null,
    fallbackRan: false,
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

  const serverFallback = SERVER_FALLBACK.has(model);
  const started = Date.now();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await getClient(config.apiKey).beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(style),
      messages: [{ role: "user", content: await buildUserContent(stored) }],
      output_config: { effort, format: { type: "json_schema", schema: PLAN_JSON_SCHEMA } },
      ...(serverFallback ? { betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const } : {}),
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    if (err instanceof Anthropic.APIError) return { ...base, latencyMs, failure: "api_error", detail: apiErrorDetail(err) };
    return { ...base, latencyMs, failure: "api_error", detail: err instanceof Error ? err.message : String(err) };
  }

  const latencyMs = Date.now() - started;
  const { costUsd, usage } = responseCostUsd(model, response.usage);
  await ledger.record(costUsd);
  const fallbackRan = (response.usage.iterations ?? []).some((it) => it.type === "fallback_message");
  const result: ClaudeAttempt = {
    ...base,
    usage,
    costUsd,
    latencyMs,
    stopReason: response.stop_reason,
    servedBy: response.model,
    fallbackRan,
  };

  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "unspecified";
    return { ...result, failure: "refusal", detail: `refused (${category})${fallbackRan ? ", fallback model too" : ""}` };
  }
  if (response.stop_reason === "max_tokens") {
    return { ...result, failure: "max_tokens", detail: `hit max_tokens (${MAX_TOKENS})` };
  }

  // Only text after the last fallback marker belongs to the answering model.
  const lastFallback = response.content.map((b) => b.type).lastIndexOf("fallback");
  const text = response.content
    .slice(lastFallback + 1)
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
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
