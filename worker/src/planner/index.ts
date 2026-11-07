// Picks the plan for a capture: mock fixture, cached plan, one Claude call, or the no-AI
// fallback. Always returns a plan, so a job never fails at this step.

import { aliasOf, config, type Effort, type ModelId, type PlannerMode } from "../config";
import type { StoredCapture } from "../capture/types";
import { DEFAULT_OPTIONS, type TrailerLength, type TrailerStyle } from "../options";
import { SpendLedger } from "./budget";
import { describeFailure, planWithClaude, type ClaudeAttempt } from "./claude";
import { fallbackPlan } from "./fallback";
import type { Plan } from "./schema";
import { readCachedPlan, readMockPlan, writeCachedPlan } from "./store";
import { validatePlan } from "./validate";

export interface PlanResult {
  plan: Plan;
  source: "claude" | "cache" | "mock" | "fallback";
  model: ModelId | null;
  /** Why the fallback planner was used, when it was. */
  reason: string | null;
  issues: string[];
  words: number;
  attempt: ClaudeAttempt | null;
}

export interface PlanOptions {
  planner?: PlannerMode;
  model?: ModelId;
  effort?: Effort;
  /** Skip the plan cache and call Claude again. */
  fresh?: boolean;
  ledger?: SpendLedger;
  /** Hype or walkthrough: changes the script's length and rhythm. Defaults to hype. */
  style?: TrailerStyle;
  /** Running time in seconds (45, 30 or 15). Defaults to 45. */
  length?: TrailerLength;
  /** Director's notes on what to film. The no-AI planner cannot read them. */
  notes?: string;
}

function useFallback(stored: StoredCapture, style: TrailerStyle, length: TrailerLength, reason: string, attempt: ClaudeAttempt | null = null): PlanResult {
  const v = validatePlan(fallbackPlan(stored.capture, length), stored.capture, style, length);
  return { plan: v.plan, source: "fallback", model: null, reason, issues: v.issues, words: v.words, attempt };
}

export async function planTrailer(stored: StoredCapture, options: PlanOptions = {}): Promise<PlanResult> {
  const { capture } = stored;
  const mode = options.planner ?? config.planner;
  const model = options.model ?? config.model;
  const effort = options.effort ?? config.effort;
  const style = options.style ?? DEFAULT_OPTIONS.style;
  const length = options.length ?? DEFAULT_OPTIONS.length;

  if (mode === "fallback") return useFallback(stored, style, length, "PLANNER=fallback");

  if (mode === "mock") {
    const mock = await readMockPlan(capture);
    if (!mock) return useFallback(stored, style, length, "PLANNER=mock and no saved plan for this URL");
    const v = validatePlan(mock.plan, capture, style, length);
    return { plan: v.plan, source: "mock", model: mock.model, reason: null, issues: v.issues, words: v.words, attempt: null };
  }

  if (!options.fresh) {
    const cached = await readCachedPlan(capture, model, { style, length, notes: options.notes });
    if (cached) {
      const v = validatePlan(cached.plan, capture, style, length);
      if (v.usable) {
        return { plan: v.plan, source: "cache", model: cached.model, reason: null, issues: v.issues, words: v.words, attempt: null };
      }
    }
  }

  const attempt = await planWithClaude(stored, { model, effort, style, length, notes: options.notes, ledger: options.ledger ?? SpendLedger.default() });
  if (!attempt.plan) return useFallback(stored, style, length, describeFailure(attempt), attempt);

  const v = validatePlan(attempt.plan, capture, style, length);
  if (!v.usable) return useFallback(stored, style, length, `the ${aliasOf(model)} plan failed checks: ${v.issues.join("; ")}`, attempt);

  await writeCachedPlan(capture, v.plan, { source: "claude", model, effort, style, length, notes: options.notes });
  return { plan: v.plan, source: "claude", model, reason: null, issues: v.issues, words: v.words, attempt };
}
