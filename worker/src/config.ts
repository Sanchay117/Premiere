import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const WORKER_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(WORKER_ROOT, "..");

// The API key lives in the repo-level .env. It is loaded into this Node process only and
// never exported to the shell, where Claude Code would bill it instead of the subscription.
const envFile = path.join(REPO_ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const MODELS = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const;
export type ModelAlias = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelAlias];

export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

export const PLANNERS = ["claude", "mock", "fallback"] as const;
export type PlannerMode = (typeof PLANNERS)[number];

export function resolveModel(value: string): ModelId {
  const v = value.trim().toLowerCase();
  if (v in MODELS) return MODELS[v as ModelAlias];
  const id = Object.values(MODELS).find((m) => m === v);
  if (id) return id;
  throw new Error(`Unknown model "${value}". Use one of: ${Object.keys(MODELS).join(", ")}.`);
}

export function aliasOf(model: ModelId): ModelAlias {
  const alias = (Object.keys(MODELS) as ModelAlias[]).find((k) => MODELS[k] === model);
  if (!alias) throw new Error(`No alias for ${model}`);
  return alias;
}

export function parseChoice<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  const v = value?.trim().toLowerCase();
  if (!v) return fallback;
  if ((allowed as readonly string[]).includes(v)) return v as T;
  throw new Error(`${name} must be one of: ${allowed.join(", ")} (got "${value}").`);
}

function parseNumber(value: string | undefined, fallback: number, name: string): number {
  if (!value?.trim()) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a positive number (got "${value}").`);
  return n;
}

export const config = {
  /** Premiere's own Console key. Missing key means the planner falls back to the no-AI plan. */
  apiKey: process.env.PREMIERE_ANTHROPIC_API_KEY?.trim() || null,
  planner: parseChoice(process.env.PLANNER, PLANNERS, "claude", "PLANNER"),
  model: resolveModel(process.env.PLANNER_MODEL?.trim() || "haiku"),
  effort: parseChoice(process.env.PLANNER_EFFORT, EFFORTS, "low", "PLANNER_EFFORT"),
  monthlyBudgetUsd: parseNumber(process.env.PLANNER_MONTHLY_BUDGET_USD, 5, "PLANNER_MONTHLY_BUDGET_USD"),
  /** Deepgram key for narration (Aura-2 text to speech). Missing key means the Kokoro fallback voice. */
  deepgramKey: process.env.DEEPGRAM_KEY?.trim() || null,
  dataDir: path.resolve(process.env.PREMIERE_DATA_DIR?.trim() || path.join(WORKER_ROOT, ".data")),
  fixturesDir: path.join(WORKER_ROOT, "fixtures"),
};
