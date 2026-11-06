import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { aliasOf, type Effort, type ModelId } from "../config";
import type { Capture } from "../capture/types";
import type { TrailerStyle } from "../options";
import { formatPlan } from "../planner/format";
import { WORDS_TARGET, type Plan } from "../planner/schema";
import { seconds, usd } from "./shared";

export interface BakeoffRun {
  planner: string;
  model: ModelId | null;
  usable: boolean;
  failure: string | null;
  plan: Plan | null;
  issues: string[];
  rawShots: number;
  keptShots: number;
  words: number;
  hypeWords: string[];
  emDashes: number;
  costUsd: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface BakeoffSite {
  url: string;
  capture?: Capture;
  captureDir?: string;
  error?: string;
  runs: BakeoffRun[];
}

interface Row {
  planner: string;
  apps: number;
  usable: number;
  kept: number;
  raw: number;
  avgWords: number;
  inRange: number;
  avgCost: number;
  totalCost: number;
  avgLatency: number;
  hype: number;
  emDashes: number;
}

function summarize(sites: BakeoffSite[], planners: string[], style: TrailerStyle): Row[] {
  const target = WORDS_TARGET[style];
  return planners.map((planner) => {
    const runs = sites.flatMap((s) => s.runs.filter((r) => r.planner === planner));
    const usable = runs.filter((r) => r.usable);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      planner,
      apps: runs.length,
      usable: usable.length,
      kept: runs.reduce((a, r) => a + r.keptShots, 0),
      raw: runs.reduce((a, r) => a + r.rawShots, 0),
      avgWords: mean(usable.map((r) => r.words)),
      inRange: usable.filter((r) => r.words >= target.min && r.words <= target.max).length,
      avgCost: mean(runs.map((r) => r.costUsd)),
      totalCost: runs.reduce((a, r) => a + r.costUsd, 0),
      avgLatency: mean(runs.map((r) => r.latencyMs)),
      hype: runs.reduce((a, r) => a + r.hypeWords.length, 0),
      emDashes: runs.reduce((a, r) => a + r.emDashes, 0),
    };
  });
}

function table(headers: string[], rows: string[][]): string[] {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

export async function writeReport(
  sites: BakeoffSite[],
  meta: { models: ModelId[]; effort: Effort; style: TrailerStyle; spentUsd: number; dir: string },
): Promise<{ file: string; summary: string }> {
  await mkdir(meta.dir, { recursive: true });
  const planners = ["fallback", ...meta.models.map(aliasOf)];
  const rows = summarize(sites, planners, meta.style);

  const summaryTable = table(
    ["Planner", "Usable plans", "Shots kept", "Avg words", `Words in ${WORDS_TARGET[meta.style].min}-${WORDS_TARGET[meta.style].max} (${meta.style})`, "Avg cost", "Total cost", "Avg time", "Hype words", "Em dashes"],
    rows.map((r) => [
      r.planner,
      `${r.usable}/${r.apps}`,
      r.raw ? `${r.kept}/${r.raw}` : "-",
      r.avgWords ? r.avgWords.toFixed(0) : "-",
      `${r.inRange}/${r.usable}`,
      usd(r.avgCost),
      usd(r.totalCost),
      seconds(r.avgLatency),
      String(r.hype),
      String(r.emDashes),
    ]),
  );

  const lines: string[] = [
    `# Planner bake-off, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Effort ${meta.effort}. Every planner worked from the same capture of each app. Spend in this run: ${usd(meta.spentUsd)}.`,
    "",
    "Usable means the plan passed the checks (valid element ids, safe actions, 3 or more shots, a sensible word count).",
    "Shots kept counts shots that survived the checks. Hype words and em dashes are counted in the raw model output",
    "(both are banned by the prompt and cleaned up afterwards).",
    "",
    "Quality still needs eyes: read the scripts below, then compare rendered trailers once the render step exists.",
    "",
    "## Summary",
    "",
    ...summaryTable,
  ];

  for (const site of sites) {
    lines.push("", `## ${site.capture?.title || site.url}`, "", site.capture?.finalUrl ?? site.url);
    if (site.error || !site.capture || !site.captureDir) {
      lines.push("", `Capture failed: ${site.error ?? "unknown error"}`);
      continue;
    }
    const c = site.capture;
    const shot = c.screenshots[0];
    if (shot) {
      const rel = path.relative(meta.dir, path.join(site.captureDir, shot.markedFile)).split(path.sep).join("/");
      lines.push("", `![First screen with element ids](${rel})`);
    }
    lines.push("", `Capture: ${c.elements.length} elements, ${c.sections.length} sections, ${c.screenshots.length} screenshot(s), page ${c.pageHeight}px tall.`);
    for (const note of [...c.notes, ...c.warnings]) lines.push(`- ${note}`);

    lines.push(
      "",
      ...table(
        ["Planner", "Result", "Shots kept", "Words", "Tokens in/out", "Cost", "Time"],
        site.runs.map((r) => [
          r.planner,
          r.usable ? "usable" : cell(`failed: ${r.failure ?? "?"}`),
          r.rawShots ? `${r.keptShots}/${r.rawShots}` : "-",
          String(r.words || "-"),
          r.inputTokens ? `${r.inputTokens}/${r.outputTokens}` : "-",
          usd(r.costUsd),
          seconds(r.latencyMs),
        ]),
      ),
    );

    for (const r of site.runs) {
      lines.push("", `### ${r.planner}`, "");
      if (!r.plan) {
        lines.push(`No plan: ${r.failure ?? "unknown"}`);
        continue;
      }
      const [title, ...rest] = formatPlan(r.plan, c);
      lines.push(`**${title}**`, "");
      for (const l of rest) lines.push(/^\d+\./.test(l) ? l : `- ${l}`);
      const extras = [
        ...r.issues.map((i) => `issue: ${i}`),
        ...(r.hypeWords.length ? [`hype words: ${r.hypeWords.join(", ")}`] : []),
        ...(r.emDashes ? [`em dashes in raw output: ${r.emDashes}`] : []),
      ];
      if (extras.length) lines.push("", ...extras.map((e) => `> ${e}`));
    }
  }

  const file = path.join(meta.dir, "report.md");
  await writeFile(file, `${lines.join("\n")}\n`);
  await writeFile(
    path.join(meta.dir, "results.json"),
    JSON.stringify(
      sites.map(({ capture, ...rest }) => ({ ...rest, title: capture?.title, finalUrl: capture?.finalUrl })),
      null,
      2,
    ),
  );
  return { file, summary: summaryTable.join("\n") };
}
