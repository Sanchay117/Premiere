// What the box office offers, with the words and details the pickers show. The worker validates
// the same ids (worker/src/options.ts).

import type { CaptionStyle, Narrator, TrailerFormat, TrailerLength, TrailerOptions, TrailerStyle } from "./types";

export const DEFAULT_OPTIONS: Required<TrailerOptions> = { style: "hype", voice: "auto", captions: "karaoke", length: 45, format: "landscape" };

/** Most a person can say in director's notes (the worker trims to the same). */
export const NOTES_MAX = 280;

/** Free for everyone until Vibeathon 02 ends (judging and the holder vote close on 16 Nov). */
export const FREE_UNTIL_LABEL = "16 Nov";

export const STYLES: { id: TrailerStyle; name: string; line: string }[] = [
  { id: "hype", name: "Hype", line: "Punch titles slam in, then the footage plays on a floating screen. Fast and loud." },
  { id: "walkthrough", name: "Walkthrough", line: "A calm, guided tour of your app, one feature at a time." },
];

/** Running times, by the names cinemas give them: the full trailer, the teaser and the spot. */
export const LENGTHS: { id: TrailerLength; name: string; line: string }[] = [
  { id: 45, name: "Trailer", line: "The full story" },
  { id: 30, name: "Teaser", line: "For a launch post" },
  { id: 15, name: "Spot", line: "For ads and stories" },
];

/** The screen a trailer is made for. */
export const FORMATS: { id: TrailerFormat; name: string; ratio: string; line: string }[] = [
  { id: "landscape", name: "Wide", ratio: "16:9", line: "YouTube, X and raise pages" },
  { id: "vertical", name: "Tall", ratio: "9:16", line: "TikTok, Reels and Shorts" },
];

/** Narration word targets, the same as the worker's (worker/src/planner/schema.ts). */
export const WORDS_TARGETS: Record<TrailerStyle, Record<TrailerLength, [number, number]>> = {
  walkthrough: { 45: [100, 125], 30: [60, 80], 15: [26, 38] },
  hype: { 45: [55, 85], 30: [36, 52], 15: [16, 26] },
};

/** The narrators, as stations on the car radio. Drive-ins played the soundtrack over FM. */
export const NARRATORS: { id: Narrator; name: string; note: string; freq: string }[] = [
  { id: "atlas", name: "Atlas", note: "Warm, confident announcer", freq: "88.1" },
  { id: "zeus", name: "Zeus", note: "Deep and smooth", freq: "89.9" },
  { id: "asteria", name: "Asteria", note: "Clear, bright ad read", freq: "91.5" },
  { id: "thalia", name: "Thalia", note: "Upbeat and enthusiastic", freq: "93.3" },
  { id: "ophelia", name: "Ophelia", note: "Cheerful and expressive", freq: "95.7" },
  { id: "athena", name: "Athena", note: "Calm storyteller", freq: "98.1" },
  { id: "draco", name: "Draco", note: "British baritone", freq: "101.3" },
  { id: "pandora", name: "Pandora", note: "Smooth, calm British", freq: "104.5" },
];

export const CAPTIONS: { id: CaptionStyle; name: string; line: string }[] = [
  { id: "karaoke", name: "Karaoke", line: "Each word lights up as it is spoken" },
  { id: "boxed", name: "Boxed", line: "Classic subtitles on a dark band" },
  { id: "bold", name: "Big & bold", line: "Two or three words at a time, huge" },
  { id: "off", name: "Off", line: "No burned-in captions; you still get the SRT" },
];

export function narratorLabel(voice: string | undefined): string {
  if (!voice || voice === "auto") return "Picked for the mood";
  return NARRATORS.find((n) => n.id === voice)?.name ?? voice;
}
