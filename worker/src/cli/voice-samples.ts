// npm run voice-samples
// Records one short line in each narrator's voice for the picker on the website
// (web/public/voices/<name>.mp3). About 700 characters of Deepgram Aura-2 in total; commit the files.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { NARRATORS } from "../options";
import { fail } from "./shared";

const LINE = "Tonight on the big screen: your app, cut into a trailer before the coffee gets cold.";
const OUT = path.resolve(import.meta.dirname, "../../../web/public/voices");

const key = config.deepgramKey;
if (!key) fail("DEEPGRAM_KEY is not set in .env");

await mkdir(OUT, { recursive: true });
for (const [name, narrator] of Object.entries(NARRATORS)) {
  const params = new URLSearchParams({ model: narrator.model, encoding: "mp3", bit_rate: "48000" });
  const response = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: LINE }),
  });
  if (!response.ok) fail(`${name}: Deepgram ${response.status} ${(await response.text()).slice(0, 200)}`);
  const file = path.join(OUT, `${name}.mp3`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`${narrator.name.padEnd(8)} ${file}`);
}
