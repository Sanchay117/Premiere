// npx tsx demo/src/voice.ts
// Voices the demo's narration with Deepgram Aura-2 (DEEPGRAM_KEY from the repo's .env) and saves
// each line as a WAV plus its word timings, in demo/.out/voice.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeWav } from "../../worker/src/audio/wav";
import { voiceLines } from "../../worker/src/voice/deepgram";
import { GUIDE_LINES, GUIDE_VOICE, TRAILER_LINES, TRAILER_VOICE } from "./script";
import { OUT } from "./paths";

export interface VoicedLine {
  key: string;
  text: string;
  file: string;
  duration: number;
  words: { text: string; start: number; end: number }[];
}

async function voiceAll(lines: readonly { key: string; text: string }[], model: string): Promise<VoicedLine[]> {
  const voiced = await voiceLines([...lines], model, (d) => console.log(`  ${model}: ${d}`));
  const dir = path.join(OUT, "voice");
  await mkdir(dir, { recursive: true });
  return Promise.all(
    voiced.map(async (line) => {
      const file = `voice/${line.key}.wav`;
      await writeFile(path.join(OUT, file), writeWav(line.pcm));
      if (line.timing !== "transcript") console.warn(`  ${line.key}: word timings are estimated`);
      const peak = line.pcm.channels[0]!.reduce((p, x) => Math.max(p, Math.abs(x)), 0);
      if (peak < 0.02) throw new Error(`${line.key}: Deepgram returned silence for "${line.text}"; reword it`);
      return { key: line.key, text: line.text, file, duration: line.duration, words: line.words };
    }),
  );
}

// With keys as arguments, only those lines are voiced again and the rest are kept.
const only = new Set(process.argv.slice(2));
const previous = only.size ? (JSON.parse(await readFile(path.join(OUT, "voice.json"), "utf8")) as { trailer: VoicedLine[]; guide: VoicedLine[] }) : null;
const pick = <T extends { key: string }>(lines: readonly T[]) => (only.size ? lines.filter((l) => only.has(l.key)) : [...lines]);
const merge = (fresh: VoicedLine[], old: VoicedLine[] | undefined, order: readonly { key: string }[]) =>
  order.map((l) => fresh.find((x) => x.key === l.key) ?? old?.find((x) => x.key === l.key)).filter((x): x is VoicedLine => Boolean(x));
const trailer = merge(await voiceAll(pick(TRAILER_LINES), TRAILER_VOICE), previous?.trailer, TRAILER_LINES);
const guide = merge(await voiceAll(pick(GUIDE_LINES), GUIDE_VOICE), previous?.guide, GUIDE_LINES);
for (const line of [...trailer, ...guide]) if (line.duration < 0.3) throw new Error(`${line.key} came back too short`);
await writeFile(path.join(OUT, "voice.json"), JSON.stringify({ trailer, guide }, null, 2));
for (const line of [...trailer, ...guide]) console.log(`${line.key.padEnd(10)} ${line.duration.toFixed(2)} s  ${line.text}`);
