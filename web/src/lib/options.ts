// What the box office offers, with the words and details the pickers show. The worker validates
// the same ids (worker/src/options.ts).

import type { CaptionStyle, Narrator, TrailerOptions, TrailerStyle } from "./types";

export const DEFAULT_OPTIONS: TrailerOptions = { style: "hype", voice: "auto", captions: "karaoke" };

/** Free for everyone until Vibeathon 02 ends (judging and the holder vote close on 16 Nov). */
export const FREE_UNTIL_LABEL = "16 Nov";

export const STYLES: { id: TrailerStyle; name: string; line: string }[] = [
  { id: "hype", name: "Hype", line: "Punch titles slam in, then the footage plays on a floating screen. Fast and loud." },
  { id: "walkthrough", name: "Walkthrough", line: "A calm, guided tour of your app, one feature at a time." },
];

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
