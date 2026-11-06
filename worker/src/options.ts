// The choices a person makes when ordering a trailer: the style of cut, the narrator and the
// caption look. Every entry point (job server, CLI, x402) parses them here, so an unknown value
// falls back to the default instead of reaching the pipeline.

import type { Plan } from "./planner/schema";

export const TRAILER_STYLES = ["hype", "walkthrough"] as const;
export type TrailerStyle = (typeof TRAILER_STYLES)[number];

export const CAPTION_STYLES = ["karaoke", "boxed", "bold", "off"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

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
}

export const DEFAULT_OPTIONS: TrailerOptions = { style: "hype", voice: "auto", captions: "karaoke" };

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

export function parseOptions(input: unknown): TrailerOptions {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const voices = ["auto", ...Object.keys(NARRATORS)] as VoiceChoice[];
  return {
    style: pick(TRAILER_STYLES, raw.style, DEFAULT_OPTIONS.style),
    voice: pick(voices, raw.voice, DEFAULT_OPTIONS.voice),
    captions: pick(CAPTION_STYLES, raw.captions, DEFAULT_OPTIONS.captions),
  };
}

/** The narrator a job ends up with: the person's pick, or one that suits the plan's mood. */
export function narratorFor(voice: VoiceChoice, mood: Plan["mood"]): Narrator {
  return voice === "auto" ? BY_MOOD[mood] : voice;
}
