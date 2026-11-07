// npm run plan -- <url> [--planner claude|mock|fallback] [--model haiku|sonnet|opus] [--effort low|medium|high]
//                       [--style hype|walkthrough] [--length 45|30|15]
//                       [--fresh] [--recapture] [--save-mock]
// Plans one trailer the way a job would and prints the script.

import { parseArgs } from "node:util";
import { config, EFFORTS, parseChoice, PLANNERS, resolveModel } from "../config";
import { loadOrCapture } from "../capture/store";
import { formatPlan } from "../planner/format";
import { parseOptions } from "../options";
import { planTrailer } from "../planner/index";
import { writeMockPlan } from "../planner/store";
import { fail, seconds, usd } from "./shared";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    planner: { type: "string" },
    model: { type: "string" },
    effort: { type: "string" },
    fresh: { type: "boolean", default: false },
    recapture: { type: "boolean", default: false },
    "save-mock": { type: "boolean", default: false },
    style: { type: "string" },
    length: { type: "string" },
  },
});
const url = positionals[0];
if (!url) fail("Usage: npm run plan -- <url> [--planner claude|mock|fallback] [--model haiku|sonnet|opus] [--fresh]");

try {
  const planner = parseChoice(values.planner, PLANNERS, config.planner, "--planner");
  const model = values.model ? resolveModel(values.model) : config.model;
  const effort = parseChoice(values.effort, EFFORTS, config.effort, "--effort");

  const stored = await loadOrCapture(url, { fresh: values.recapture });
  console.log(`${stored.cached ? "Using saved capture" : "Captured"} ${stored.capture.finalUrl}`);

  const { style, length } = parseOptions(values);
  const result = await planTrailer(stored, { planner, model, effort, fresh: values.fresh, style, length });
  const attempt = result.attempt;
  console.log(`Planner: ${result.source}${result.model ? ` (${result.model}, effort ${effort})` : ""}`);
  if (result.reason) console.log(`Fallback because: ${result.reason}`);
  if (attempt?.usage) {
    console.log(
      `Claude call: ${attempt.usage.inputTokens} in / ${attempt.usage.outputTokens} out tokens, ${usd(attempt.costUsd)}, ${seconds(attempt.latencyMs)}`,
    );
  }
  console.log(`Narration: ${result.words} words`);
  for (const issue of result.issues) console.log(`  issue: ${issue}`);
  console.log(`\n${formatPlan(result.plan, stored.capture).join("\n")}`);

  if (values["save-mock"]) {
    const file = await writeMockPlan(stored.capture, result.plan, {
      source: result.source,
      model: result.model,
      effort: result.model ? effort : null,
    });
    console.log(`\nSaved as mock plan: ${file}`);
  }
} catch (err) {
  fail(err);
}
