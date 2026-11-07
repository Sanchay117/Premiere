// The choices a person makes when ordering a trailer: the style of cut, the narrator and the
// caption look. Every entry point (job server, CLI, x402) parses them here, so an unknown value
// falls back to the default instead of reaching the pipeline.

import type { Plan } from "./planner/schema";

export const TRAILER_STYLES = ["hype", "walkthrough"] as const;
export type TrailerStyle = (typeof TRAILER_STYLES)[number];

export const CAPTION_STYLES = ["karaoke", "boxed", "bold", "off"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

/** Running time in seconds: the full trailer, and shorter cuts for ads and social posts. */
export const TRAILER_LENGTHS = [45, 30, 15] as const;
export type TrailerLength = (typeof TRAILER_LENGTHS)[number];

/** Landscape for YouTube, X and raise pages; vertical for TikTok, Reels and Shorts. */
export const TRAILER_FORMATS = ["landscape", "vertical"] as const;
export type TrailerFormat = (typeof TRAILER_FORMATS)[number];

/** A curated set of Deepgram Aura-2 voices that suit trailers. */
export const NARRATORS = {
  atlas: { model: "aura-2-atlas-en", name: "Atlas", note: "Warm, confident announcer" },
  zeus: { model: "aura-2-zeus-en", name: "Zeus", note: "Deep and smooth" },
  asteria: { model: "aura-2-asteria-en", name: "Asteria", note: "Clear, bright ad read" },
  thalia: { model: "aura-2-thalia-en", name: "Thalia", note: "Upbeat and enthusiastic" },
  ophelia: { model: "aura-2-ophelia-en", name: "Ophelia", note: "Cheerful and expressive" },
  athena: { model: "aura-2-athena-en", name: "Athena", note: "Calm storyteller" },
  draco: { model: "aura-2-draco-en", name: "Draco", note: "British baritone" },
  pandora: { model: "aura-2-pandora-en", name: "Pandora", note: "Smooth, calm British" },
} as const;
export type Narrator = keyof typeof NARRATORS;
export type VoiceChoice = "auto" | Narrator;

/** With voice "auto", the plan's mood picks the narrator. */
const BY_MOOD: Record<Plan["mood"], Narrator> = {
  energetic: "atlas",
  bold: "atlas",
  playful: "asteria",
  calm: "athena",
};

export interface TrailerOptions {
  style: TrailerStyle;
  voice: VoiceChoice;
  captions: CaptionStyle;
  length: TrailerLength;
  format: TrailerFormat;
}

export const DEFAULT_OPTIONS: TrailerOptions = { style: "hype", voice: "auto", captions: "karaoke", length: 45, format: "landscape" };

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

export function parseOptions(input: unknown): TrailerOptions {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const voices = ["auto", ...Object.keys(NARRATORS)] as VoiceChoice[];
  const length = Number(raw.length);
  return {
    style: pick(TRAILER_STYLES, raw.style, DEFAULT_OPTIONS.style),
    voice: pick(voices, raw.voice, DEFAULT_OPTIONS.voice),
    captions: pick(CAPTION_STYLES, raw.captions, DEFAULT_OPTIONS.captions),
    length: (TRAILER_LENGTHS as readonly number[]).includes(length) ? (length as TrailerLength) : DEFAULT_OPTIONS.length,
    format: pick(TRAILER_FORMATS, raw.format, DEFAULT_OPTIONS.format),
  };
}

/** Most a person can say in director's notes. */
export const NOTES_MAX = 280;

/** Director's notes: one optional line on what the agent should film. Control characters and angle
 *  brackets go, so the notes cannot close the tags they are sent to Claude in. */
export function parseNotes(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const printable = [...raw].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("");
  const notes = printable.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NOTES_MAX);
  return notes || null;
}

/** Options saved before lengths and formats existed get the defaults. */
export const withDefaults = (options: Partial<TrailerOptions> | undefined): TrailerOptions => ({ ...DEFAULT_OPTIONS, ...options });

/** The narrator a job ends up with: the person's pick, or one that suits the plan's mood. */
export function narratorFor(voice: VoiceChoice, mood: Plan["mood"]): Narrator {
  return voice === "auto" ? BY_MOOD[mood] : voice;
}
