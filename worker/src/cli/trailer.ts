// npm run trailer -- <url> [--planner opus|sonnet|haiku|none] [--style hype|walkthrough]
//                          [--voice auto|atlas|zeus|...] [--captions karaoke|boxed|bold|off] [--fresh] [--recapture]
// npm run trailer -- --rerender <job folder or name> [--captions karaoke|boxed|bold|off] [--thumbnails]
// Makes a whole trailer from a URL, the same way a job does (Opus writes the script unless
// --planner says otherwise), and prints where the files are.
// --rerender renders a finished job again from its edit.json and footage (no new voice or filming),
// for iterating on the look; --captions swaps the caption look while doing so, and --thumbnails
// renders only the two thumbnails.

import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadOrCapture } from "../capture/store";
import { config, MODELS } from "../config";
import { normalizeUrl, urlSlug } from "../lib/url";
import { CAPTION_STYLES, parseOptions, type CaptionStyle } from "../options";
import { makeTrailer, rerenderThumbnails, rerenderTrailer } from "../pipeline/trailer";
import { planTrailer } from "../planner/index";
import { fail, seconds } from "./shared";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    planner: { type: "string" },
    style: { type: "string" },
    voice: { type: "string" },
    captions: { type: "string" },
    fresh: { type: "boolean", default: false },
    recapture: { type: "boolean", default: false },
    rerender: { type: "string" },
    thumbnails: { type: "boolean", default: false },
  },
});
const url = positionals[0];
if (!url && !values.rerender) fail("Usage: npm run trailer -- <url> [--style hype|walkthrough] [--voice <name>] [--captions <look>] | --rerender <job>");

function jobFolder(name: string): string {
  if (existsSync(name)) return path.resolve(name);
  return path.join(config.dataDir, "jobs", name);
}

// Keep the process alive while browsers and renderers wind down between steps.
const keepAlive = setInterval(() => {}, 60_000);
try {
  const started = Date.now();
  if (values.rerender && values.thumbnails) {
    const thumbnails = await rerenderThumbnails(jobFolder(values.rerender));
    console.log(`Thumbnails re-rendered in ${seconds(Date.now() - started)}`);
    for (const file of thumbnails) console.log(`  ${file}`);
  } else if (values.rerender) {
    const dir = jobFolder(values.rerender);
    const captions = CAPTION_STYLES.includes(values.captions as CaptionStyle) ? (values.captions as CaptionStyle) : undefined;
    const outputs = await rerenderTrailer(dir, (f) => process.stdout.write(`\r[render] ${Math.round(f * 100)}%`.padEnd(40)), { captions });
    console.log(`\nRe-rendered in ${seconds(Date.now() - started)}${captions ? ` with ${captions} captions` : ""}`);
    for (const file of [outputs.video, ...outputs.thumbnails]) console.log(`  ${file}`);
  } else {
    const options = parseOptions(values);
    const stored = await loadOrCapture(url!, { fresh: values.recapture });
    console.log(`Capture: ${stored.cached ? "saved" : "fresh"}, ${stored.capture.elements.length} elements`);
    const choice = values.planner as keyof typeof MODELS | "none";
    const planned = await planTrailer(
      stored,
      choice === "none"
        ? { planner: "fallback", style: options.style }
        : { planner: "claude", model: MODELS[choice] ?? config.model, fresh: values.fresh, style: options.style },
    );
    console.log(`Plan: ${planned.source}, ${planned.plan.shots.length} shots, ${planned.words} words (${options.style})`);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const jobDir = path.join(config.dataDir, "jobs", `${stamp}-${urlSlug(normalizeUrl(url!))}`);
    const result = await makeTrailer(stored, planned.plan, jobDir, options, {
      onStepStart: (step, d) => console.log(`[${step}] ${d}`),
      onStepProgress: (step, d) => process.stdout.write(`\r[${step}] ${d}`.padEnd(70)),
      onStepDone: (step, d) => console.log(`\r[${step}] done: ${d}`.padEnd(70)),
    });
    console.log(`\nTrailer ready in ${seconds(Date.now() - started)}: ${result.duration.toFixed(1)} s, read by ${result.voice}`);
    console.log(`  ${result.video}`);
    for (const t of result.thumbnails) console.log(`  ${t}`);
    console.log(`  ${result.captions}`);
    for (const s of result.shotsSkipped) console.log(`  skipped shot ${s.index + 1}: ${s.reason}`);
  }
} catch (err) {
  console.error(err);
  fail(err);
} finally {
  clearInterval(keepAlive);
}
