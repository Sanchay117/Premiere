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

export class VoiceError extends Error {}

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
    throw new VoiceError(`Deepgram TTS ${response.status}: ${detail}`);
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
  if (!response.ok) throw new VoiceError(`Deepgram STT ${response.status}`);
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
export async function voicePlan(plan: Plan, voice: VoiceChoice, onProgress?: (detail: string) => void): Promise<VoiceLine[]> {
  const key = config.deepgramKey;
  if (!key) throw new VoiceError("DEEPGRAM_KEY is not set in .env");
  const model = NARRATORS[narratorFor(voice, plan.mood)].model;
  const lines = [
    { key: "hook", text: plan.hook },
    ...plan.shots.map((s, i) => ({ key: `shot-${i + 1}`, text: s.narration })),
    { key: "close", text: plan.close },
  ];
  const results: VoiceLine[] = [];
  // Two at a time keeps within Deepgram's concurrency limit.
  for (let i = 0; i < lines.length; i += 2) {
    const batch = lines.slice(i, i + 2);
    onProgress?.(`Recording line ${i + 1} of ${lines.length}`);
    const voiced = await Promise.all(
      batch.map(async (line) => {
        const wav = await speak(line.text, model, key);
        const pcm = readWav(wav);
        const duration = durationOf(pcm);
        const transcript = await transcribeWords(wav, key).catch(() => []);
        const { words, timing } = alignWords(line.text, transcript, duration);
        return { key: line.key, text: line.text, pcm, duration, words, timing } satisfies VoiceLine;
      }),
    );
    results.push(...voiced);
  }
  return results;
}
