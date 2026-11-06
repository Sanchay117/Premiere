// Narration with Deepgram Aura-2, one request per line, plus word timings from Deepgram
// speech-to-text on the audio we just generated (Aura does not return timestamps itself).

import { config } from "../config";
import { NARRATORS, narratorFor, type VoiceChoice } from "../options";
import type { Plan } from "../planner/schema";
import { durationOf, readWav, type Pcm } from "../audio/wav";

const SAMPLE_RATE = 48000;

export interface Word {
  text: string;
  /** Seconds from the start of the line's audio. */
  start: number;
  end: number;
}

export interface VoiceLine {
  key: string;
  text: string;
  pcm: Pcm;
  duration: number;
  words: Word[];
  /** Where the timings came from. */
  timing: "transcript" | "estimate";
}

export class VoiceError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** Retries a request that hit Deepgram's concurrency limit (429) or a passing server error. */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const status = err instanceof VoiceError ? err.status : 0;
      if (attempt >= 2 || !(status === 429 || status >= 500)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
    }
  }
}

async function speak(text: string, model: string, key: string): Promise<Buffer> {
  const params = new URLSearchParams({ model, encoding: "linear16", container: "wav", sample_rate: String(SAMPLE_RATE) });
  const response = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new VoiceError(`Deepgram TTS ${response.status}: ${detail}`, response.status);
  }
  return Buffer.from(await response.arrayBuffer());
}

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
}

async function transcribeWords(wav: Buffer, key: string): Promise<DeepgramWord[]> {
  const params = new URLSearchParams({ model: "nova-3", punctuate: "true" });
  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
    body: new Uint8Array(wav),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new VoiceError(`Deepgram STT ${response.status}`, response.status);
  const data = (await response.json()) as {
    results?: { channels?: { alternatives?: { words?: DeepgramWord[] }[] }[] };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
}

/** Spreads words across the speech by character length; used when no transcript lines up. */
export function estimateWords(text: string, start: number, end: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => Math.max(2, t.replace(/[^\p{L}\p{N}]/gu, "").length) + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return tokens.map((token, i) => {
    const span = ((end - start) * weights[i]!) / total;
    const word = { text: token, start: t, end: t + span };
    t += span;
    return word;
  });
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Maps transcript timings onto the script's own words. Words are matched in order, a script word
 * the transcript split in pieces ("Excalidraw" heard as "Excali draw") is joined back, and words
 * with no match (numbers spelled out, odd names) are interpolated between their neighbours.
 */
export function alignWords(text: string, transcript: DeepgramWord[], duration: number): { words: Word[]; timing: VoiceLine["timing"] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const heard = transcript.map((w) => norm(w.word));
  const found: (Word | null)[] = [];
  let j = 0;
  for (const token of tokens) {
    const target = norm(token);
    let match: Word | null = null;
    for (let k = j; target && k < Math.min(transcript.length, j + 4) && !match; k++) {
      let joined = heard[k]!;
      let last = k;
      while (joined.length < target.length && last + 1 < transcript.length && target.startsWith(joined)) {
        last++;
        joined += heard[last]!;
      }
      if (joined === target) {
        match = { text: token, start: transcript[k]!.start, end: transcript[last]!.end };
        j = last + 1;
      }
    }
    found.push(match);
  }

  const matched = found.filter(Boolean).length;
  if (matched === 0) {
    const start = transcript[0]?.start ?? 0.05;
    const end = transcript[transcript.length - 1]?.end ?? Math.max(start + 0.5, duration - 0.05);
    return { words: estimateWords(text, start, end), timing: "estimate" };
  }

  // Fill each run of unmatched words between the neighbouring known times.
  const words: Word[] = [];
  let i = 0;
  while (i < tokens.length) {
    const known = found[i];
    if (known) {
      words.push(known);
      i++;
      continue;
    }
    let runEnd = i;
    while (runEnd < tokens.length && !found[runEnd]) runEnd++;
    const from = words[words.length - 1]?.end ?? Math.min(transcript[0]?.start ?? 0.05, found[runEnd]?.start ?? duration);
    const to = found[runEnd]?.start ?? Math.max(from + 0.2, transcript[transcript.length - 1]?.end ?? duration - 0.05);
    words.push(...estimateWords(tokens.slice(i, runEnd).join(" "), from, Math.max(from + 0.05, to)));
    i = runEnd;
  }
  return { words, timing: matched >= tokens.length / 2 ? "transcript" : "estimate" };
}

/** Voices every narration line of a plan: hook, each shot, close. */
/** The lines a plan is read in: the hook, one per shot, and the close. */
function scriptLines(plan: Plan): { key: string; text: string }[] {
  return [
    { key: "hook", text: plan.hook },
    ...plan.shots.map((s, i) => ({ key: `shot-${i + 1}`, text: s.narration })),
    { key: "close", text: plan.close },
  ];
}

/** Seconds a caption needs on screen to be read, at about two and a half words a second. */
export const readingTime = (text: string) => Math.max(1.8, 0.6 + 0.4 * text.split(/\s+/).filter(Boolean).length);

/** The script without a narrator: each line held as long as it takes to read as a caption, with
 *  evenly spread word timings and no sound. For when the voice service cannot be reached, so the
 *  trailer still ships with captions and music. */
export function silentLines(plan: Plan): VoiceLine[] {
  return scriptLines(plan).map(({ key, text }) => {
    const duration = readingTime(text);
    return {
      key,
      text,
      pcm: { sampleRate: 48000, channels: [new Float32Array(1)] },
      duration,
      words: estimateWords(text, 0.15, duration - 0.15),
      timing: "estimate" as const,
    };
  });
}

export async function voicePlan(plan: Plan, voice: VoiceChoice, onProgress?: (detail: string) => void): Promise<VoiceLine[]> {
  const key = config.deepgramKey;
  if (!key) throw new VoiceError("DEEPGRAM_KEY is not set in .env");
  const model = NARRATORS[narratorFor(voice, plan.mood)].model;
  const lines = scriptLines(plan);
  // Deepgram allows 15 Aura-2 requests at once per project. Five lines at a time voices a whole
  // script in about two rounds and leaves room for anything else using the key.
  const results: VoiceLine[] = new Array(lines.length);
  let next = 0;
  let done = 0;
  onProgress?.(`Recording ${lines.length} lines`);
  const lane = async () => {
    while (next < lines.length) {
      const i = next++;
      const line = lines[i]!;
      const wav = await withRetry(() => speak(line.text, model, key));
      const pcm = readWav(wav);
      const duration = durationOf(pcm);
      const transcript = await withRetry(() => transcribeWords(wav, key)).catch(() => []);
      const { words, timing } = alignWords(line.text, transcript, duration);
      results[i] = { key: line.key, text: line.text, pcm, duration, words, timing };
      onProgress?.(`Recorded ${++done} of ${lines.length} lines`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, lines.length) }, lane));
  return results;
}
