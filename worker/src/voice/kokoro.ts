// Backup narrator: Kokoro, an open-source voice model (82M parameters, Apache-2.0) that runs on the
// worker's CPU through kokoro-js, for when Deepgram cannot be reached (an outage, a spent account,
// no key). It needs no account and costs nothing per line, but its voices are a step below Aura-2
// and it reads at about real time on a laptop CPU, so it only stands in.

import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateOptions, KokoroTTS } from "kokoro-js";
import { durationOf } from "../audio/wav";
import { config } from "../config";
import { narratorFor, type Narrator, type VoiceChoice } from "../options";
import type { Plan } from "../planner/schema";
import { estimateWords, scriptLines, type VoiceLine } from "./deepgram";

type KokoroVoiceId = NonNullable<GenerateOptions["voice"]>;

/** The Kokoro voice standing in for each narrator: same gender and accent, and the nearest
 *  character among Kokoro's better-graded voices. Its lower grades sound plainly synthetic, which
 *  is why the four American women share Bella (bright, upbeat) and Heart (warm, calm). */
export const KOKORO_VOICES: Record<Narrator, { id: KokoroVoiceId; name: string }> = {
  atlas: { id: "am_michael", name: "Michael" },
  zeus: { id: "am_fenrir", name: "Fenrir" },
  asteria: { id: "af_bella", name: "Bella" },
  thalia: { id: "af_bella", name: "Bella" },
  ophelia: { id: "af_heart", name: "Heart" },
  athena: { id: "af_heart", name: "Heart" },
  draco: { id: "bm_george", name: "George" },
  pandora: { id: "bf_emma", name: "Emma" },
};

/** The backup voice for an order: the stand-in for the narrator picked, or under "auto" for the one
 *  the plan's mood picks, so a calm trailer stays calm when the backup reads it. */
export const kokoroVoice = (voice: VoiceChoice, mood: Plan["mood"]) => KOKORO_VOICES[narratorFor(voice, mood)];

/** The name shown for the backup narrator, for example "Michael". */
export function kokoroVoiceName(voice: VoiceChoice, mood: Plan["mood"]): string {
  return kokoroVoice(voice, mood).name;
}

// Kokoro pads every line with about 0.4 s of near-silence before the speech and 0.55 s after it:
// seven seconds over a script, and the music would duck under all of it. The padding sits 55 dB or
// more below the line's loudest moment, so anything within 40 dB of that counts as speech, which
// keeps soft fricatives and the release of a final consonant.
const WINDOW_SECONDS = 0.01;
const SPEECH_DB = -40;
/** Kept around the speech so its attack and decay are not clipped. */
const LEAD_SECONDS = 0.06;
const TAIL_SECONDS = 0.15;

/** Where the speech in a clip begins and ends, in seconds; null for a silent clip. */
export function speechBounds(samples: Float32Array, sampleRate: number): { start: number; end: number } | null {
  const size = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
  const energy = new Float64Array(Math.ceil(samples.length / size));
  let loudest = 0;
  for (let w = 0; w < energy.length; w++) {
    const from = w * size;
    const to = Math.min(samples.length, from + size);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i]! * samples[i]!;
    energy[w] = sum / (to - from);
    loudest = Math.max(loudest, energy[w]!);
  }
  if (!(loudest > 0)) return null;
  const floor = loudest * 10 ** (SPEECH_DB / 10);
  let first = 0;
  while (energy[first]! < floor) first++;
  let last = energy.length - 1;
  while (energy[last]! < floor) last--;
  return { start: (first * size) / sampleRate, end: Math.min(samples.length, (last + 1) * size) / sampleRate };
}

/** Cuts a clip down to its speech plus a short lead-in and tail, and says where the speech sits in
 *  what is left; null for a silent clip. */
export function trimSilence(samples: Float32Array, sampleRate: number): { samples: Float32Array; start: number; end: number } | null {
  const speech = speechBounds(samples, sampleRate);
  if (!speech) return null;
  const from = Math.max(0, Math.floor((speech.start - LEAD_SECONDS) * sampleRate));
  const to = Math.min(samples.length, Math.ceil((speech.end + TAIL_SECONDS) * sampleRate));
  const offset = from / sampleRate;
  // A copy rather than a view, so the model's whole output buffer can be freed.
  return { samples: samples.slice(from, to), start: speech.start - offset, end: speech.end - offset };
}

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

let loaded: Promise<KokoroTTS> | null = null;

/** Kokoro, loaded once per process. A failed load is forgotten, so the next job tries again. */
function kokoro(onProgress?: (detail: string) => void): Promise<KokoroTTS> {
  if (!loaded) {
    loaded = loadKokoro(onProgress);
    loaded.catch(() => {
      loaded = null;
    });
  }
  return loaded;
}

async function loadKokoro(onProgress?: (detail: string) => void): Promise<KokoroTTS> {
  // Imported on first use rather than at the top: onnxruntime's native library then loads only on a
  // worker that needs the backup, and if it cannot load, this voice fails over to captions instead
  // of the whole worker failing to start.
  const [{ env }, kokoroJs] = await Promise.all([import("@huggingface/transformers"), import("kokoro-js")]);
  // transformers.js caches downloads inside node_modules by default, where every reinstall wipes
  // them; the worker's data folder keeps the model across deploys.
  env.cacheDir = path.join(config.dataDir, "models");
  // A repo's files land in <cacheDir>/<repo id>/. transformers.js streams a download straight into
  // its final path, so a worker stopped mid-download would leave a truncated model that fails every
  // later load. A load that worked leaves a mark; files without one are fetched again.
  const dir = path.join(env.cacheDir, ...MODEL.split("/"));
  const mark = path.join(dir, ".loaded");
  if (!existsSync(mark)) await rm(dir, { recursive: true, force: true }).catch(() => {});
  let tenths = -1;
  const tts = await kokoroJs.KokoroTTS.from_pretrained(MODEL, {
    dtype: "q8", // the 92 MB 8-bit model
    device: "cpu",
    // Only a machine's first use downloads anything, and that takes a minute or so.
    progress_callback: (info) => {
      if (info.status !== "progress" || !info.file.endsWith(".onnx")) return;
      const now = Math.floor(info.progress / 10);
      if (now <= tenths) return;
      tenths = now;
      onProgress?.(`Fetching the backup voice for its first use, ${now * 10}%`);
    },
  });
  await writeFile(mark, "").catch(() => {});
  return tts;
}

/** KOKORO=off skips the backup voice, so a failed narration goes straight to captions: for a
 *  machine that cannot spare the CPU, the memory or the 92 MB download. */
const switchedOff = () => /^(off|false|no|0)$/i.test(process.env.KOKORO?.trim() ?? "");

/** Voices every line of the plan (hook, one per shot, close) with Kokoro. Throws when it is
 *  switched off or cannot load, and the trailer then goes out with captions instead. */
export async function kokoroLines(plan: Plan, voice: VoiceChoice, onProgress?: (detail: string) => void): Promise<VoiceLine[]> {
  if (switchedOff()) throw new Error("The Kokoro backup voice is switched off (KOKORO=off)");
  const tts = await kokoro(onProgress);
  const { id } = kokoroVoice(voice, plan.mood);
  const lines = scriptLines(plan);
  onProgress?.(`Recording ${lines.length} lines`);
  const voiced: VoiceLine[] = [];
  // One line at a time: the same CPU is opening the app for the shoot meanwhile, and parallel runs
  // of the model would only fight over its cores.
  for (const { key, text } of lines) {
    const audio = await tts.generate(text, { voice: id });
    const clip = trimSilence(audio.audio, audio.sampling_rate);
    if (!clip) throw new Error(`Kokoro read "${text}" as silence`);
    const pcm = { sampleRate: audio.sampling_rate, channels: [clip.samples] };
    // Kokoro gives no word timings, so the words are spread over the speech by length.
    voiced.push({ key, text, pcm, duration: durationOf(pcm), words: estimateWords(text, clip.start, clip.end), timing: "estimate" });
    onProgress?.(`Recorded ${voiced.length} of ${lines.length} lines`);
  }
  return voiced;
}
