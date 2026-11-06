// npm run bakeoff -- [url ...] [--models haiku,sonnet,opus] [--effort low] [--recapture] [--save-mock <model>]
//
// Model bake-off for the planner. Captures each app once, then plans it with every model from
// the same capture (plus the no-AI fallback as a $0 baseline), checks each plan, and writes a
// report with the scripts side by side. Spend goes through the same ledger as real jobs.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { aliasOf, config, EFFORTS, parseChoice, resolveModel, WORKER_ROOT, type Effort, type ModelId } from "../config";
import { loadOrCapture } from "../capture/store";
import type { StoredCapture } from "../capture/types";
import { countEmDashes } from "../lib/text";
import { SpendLedger } from "../planner/budget";
import { describeFailure, planWithClaude } from "../planner/claude";
import { fallbackPlan } from "../planner/fallback";
import type { Plan } from "../planner/schema";
import { writeMockPlan } from "../planner/store";
import { validatePlan } from "../planner/validate";
import { DEFAULT_OPTIONS, TRAILER_STYLES, type TrailerStyle } from "../options";
import { writeReport, type BakeoffRun, type BakeoffSite } from "./bakeoff-report";
import { fail, seconds, usd } from "./shared";

const HYPE =
  /\b(revolutionar\w*|revolutioni[sz]\w*|game[- ]chang\w*|seamless\w*|cutting[- ]edge|unleash\w*|supercharg\w*|effortless\w*|elevat\w*|next[- ]level|world[- ]class|best[- ]in[- ]class|groundbreaking|empower\w*|harness\w*|transformative)\b/gi;

function scriptText(plan: Plan): string {
  return [plan.hook, ...plan.shots.map((s) => s.narration), plan.close].join(" ");
}

function scored(planner: string, model: ModelId | null, raw: Plan | null, stored: StoredCapture): Omit<BakeoffRun, "costUsd" | "latencyMs" | "inputTokens" | "outputTokens" | "failure"> {
  if (!raw) {
    return { planner, model, usable: false, plan: null, issues: [], rawShots: 0, keptShots: 0, words: 0, hypeWords: [], emDashes: 0 };
  }
  const v = validatePlan(raw, stored.capture, style);
  return {
    planner,
    model,
    usable: v.usable,
    plan: v.plan,
    issues: v.issues,
    rawShots: raw.shots.length,
    keptShots: v.plan.shots.length,
    words: v.words,
    hypeWords: [...new Set((scriptText(raw).match(HYPE) ?? []).map((w) => w.toLowerCase()))],
    emDashes: countEmDashes(JSON.stringify(raw)),
  };
}

function runFallback(stored: StoredCapture): BakeoffRun {
  const started = Date.now();
  const result = scored("fallback", null, fallbackPlan(stored.capture), stored);
  return {
    ...result,
    failure: result.usable ? null : `failed checks: ${result.issues.join("; ")}`,
    costUsd: 0,
    latencyMs: Date.now() - started,
    inputTokens: 0,
    outputTokens: 0,
  };
}

async function runModel(stored: StoredCapture, model: ModelId, effort: Effort, ledger: SpendLedger): Promise<BakeoffRun> {
  const attempt = await planWithClaude(stored, { model, effort, ledger, style });
  const result = scored(aliasOf(model), model, attempt.plan, stored);
  return {
    ...result,
    failure: attempt.plan ? (result.usable ? null : `failed checks: ${result.issues.join("; ")}`) : describeFailure(attempt),
    costUsd: attempt.costUsd,
    latencyMs: attempt.latencyMs,
    inputTokens: attempt.usage?.inputTokens ?? 0,
    outputTokens: attempt.usage?.outputTokens ?? 0,
  };
}

async function defaultUrls(): Promise<string[]> {
  const text = await readFile(path.join(WORKER_ROOT, "bakeoff-urls.txt"), "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    models: { type: "string", default: "haiku,sonnet,opus" },
    effort: { type: "string" },
    recapture: { type: "boolean", default: false },
    "save-mock": { type: "string" },
    style: { type: "string", default: DEFAULT_OPTIONS.style },
  },
});
const style: TrailerStyle = (TRAILER_STYLES as readonly string[]).includes(values.style) ? (values.style as TrailerStyle) : DEFAULT_OPTIONS.style;

try {
  const models = values.models
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .map(resolveModel);
  const effort = parseChoice(values.effort, EFFORTS, config.effort, "--effort");
  const saveMock = values["save-mock"] ? resolveModel(values["save-mock"]) : null;
  const urls = positionals.length ? positionals : await defaultUrls();
  const ledger = SpendLedger.default();

  const before = await ledger.thisMonth();
  console.log(`Bake-off: ${urls.length} app(s), models ${models.map(aliasOf).join(", ")} at effort ${effort}, plus the no-AI fallback.`);
  console.log(`Spend so far this month: ${usd(before.usd)} of $${ledger.limitUsd}.`);
  if (!config.apiKey) console.log("No PREMIERE_ANTHROPIC_API_KEY in .env, so only the fallback planner will produce plans.");

  const sites: BakeoffSite[] = [];
  for (const url of urls) {
    let stored: StoredCapture & { cached: boolean };
    try {
      stored = await loadOrCapture(url, { fresh: values.recapture });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.log(`\n${url}: capture failed (${error})`);
      sites.push({ url, error, runs: [] });
      continue;
    }
    const { capture } = stored;
    console.log(
      `\n${capture.finalUrl}: ${stored.cached ? "saved capture" : "captured"}, ${capture.elements.length} elements, ${capture.sections.length} sections, ${capture.screenshots.length} screenshot(s)`,
    );
    const runs = [runFallback(stored), ...(await Promise.all(models.map((m) => runModel(stored, m, effort, ledger))))];
    for (const r of runs) {
      const status = r.usable ? "ok  " : "FAIL";
      const detail = r.failure ? ` (${r.failure})` : "";
      console.log(
        `  ${r.planner.padEnd(8)} ${status} ${String(r.keptShots).padStart(2)}/${String(r.rawShots).padEnd(2)} shots ${String(r.words).padStart(3)} words  ${usd(r.costUsd).padEnd(8)} ${seconds(r.latencyMs)}${detail}`,
      );
      if (saveMock && r.model === saveMock && r.usable && r.plan) {
        await writeMockPlan(capture, r.plan, { source: "bakeoff", model: r.model, effort });
      }
    }
    sites.push({ url, capture, captureDir: stored.dir, runs });
  }

  const after = await ledger.thisMonth();
  const report = await writeReport(sites, {
    models,
    effort,
    style,
    spentUsd: after.usd - before.usd,
    dir: path.join(config.dataDir, "bakeoff", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)),
  });
  console.log(`\n${report.summary}`);
  console.log(`\nReport: ${report.file}`);
  if (saveMock) console.log(`Saved usable ${aliasOf(saveMock)} plans as mock fixtures in worker/fixtures/plans.`);
} catch (err) {
  fail(err);
}
