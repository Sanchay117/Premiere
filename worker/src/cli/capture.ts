// npm run capture -- <url>
// Captures one URL (always fresh) and prints what the planner will see.

import path from "node:path";
import { parseArgs } from "node:util";
import { loadOrCapture } from "../capture/store";
import { fail } from "./shared";

const { positionals } = parseArgs({ allowPositionals: true, options: {} });
const url = positionals[0];
if (!url) fail("Usage: npm run capture -- <url>");

try {
  const started = Date.now();
  const { capture, dir } = await loadOrCapture(url, { fresh: true });
  console.log(`Captured ${capture.finalUrl} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  title:       ${capture.title || "(none)"}`);
  console.log(`  description: ${capture.description || "(none)"}`);
  console.log(`  page:        ${capture.pageHeight}px tall, ${capture.elements.length} elements, ${capture.sections.length} sections`);
  for (const note of capture.notes) console.log(`  note:        ${note}`);
  for (const warning of capture.warnings) console.log(`  warning:     ${warning}`);
  console.log(`  screenshots: ${capture.screenshots.map((s) => path.join(dir, s.markedFile)).join("\n               ")}`);
  console.log("\nElements:");
  for (const e of capture.elements) {
    console.log(`  ${e.id.padEnd(4)} ${e.kind.padEnd(8)} ${e.region.padEnd(6)} y=${String(e.box.y).padEnd(5)} "${e.text}"${e.navigates ? ` -> ${e.href}` : ""}`);
  }
  console.log("\nSections:");
  for (const s of capture.sections) console.log(`  ${s.id.padEnd(4)} h${s.level} y=${String(s.y).padEnd(5)} ${s.heading}`);
} catch (err) {
  fail(err);
}
