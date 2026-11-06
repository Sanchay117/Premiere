// ffmpeg comes with Remotion's compositor package, so the worker needs no separate install.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const COMPOSITORS = [
  "@remotion/compositor-win32-x64-msvc",
  "@remotion/compositor-darwin-arm64",
  "@remotion/compositor-darwin-x64",
  "@remotion/compositor-linux-x64-gnu",
  "@remotion/compositor-linux-x64-musl",
  "@remotion/compositor-linux-arm64-gnu",
  "@remotion/compositor-linux-arm64-musl",
];

let cached: string | null = null;

export function ffmpegPath(): string {
  if (cached) return cached;
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  for (const pkg of COMPOSITORS) {
    try {
      const candidate = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), exe);
      if (existsSync(candidate)) return (cached = candidate);
    } catch {
      // not installed for this platform
    }
  }
  return (cached = "ffmpeg");
}

export function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))));
  });
}

/** Two-pass EBU R128 loudness normalization to -16 LUFS integrated, -1.5 dBTP. */
export async function normalizeLoudness(input: string, output: string): Promise<{ measuredLufs: number }> {
  const target = "I=-16:TP=-1.5:LRA=11";
  const firstPass = await runFfmpeg(["-i", input, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"]);
  const json = firstPass.slice(firstPass.lastIndexOf("{"), firstPass.lastIndexOf("}") + 1);
  const m = JSON.parse(json) as Record<string, string>;
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
  await runFfmpeg(["-i", input, "-af", `loudnorm=${target}:${measured}:linear=true:print_format=summary`, "-ar", "48000", "-c:a", "pcm_s16le", output]);
  return { measuredLufs: Number(m.input_i) };
}
