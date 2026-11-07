// Timing shared by the picture (Intro.tsx) and the soundtrack (src/score.ts), with no Remotion
// imports so the Node side can use it too.

import type { Line } from "./types";

/** The frame, within a scene that starts at sceneStart seconds, just before the trailer voice says
 *  a word, so a slam lands with the word whichever narrator reads it. */
export function wordFrame(lines: Line[], key: string, word: string, sceneStart: number, fallback: number): number {
  const line = lines.find((l) => l.key === key);
  const w = line?.words.find((x) => x.text.toLowerCase().replace(/[^a-z]/g, "").startsWith(word));
  return w && line ? Math.round((line.at + w.start - sceneStart) * 30) - 1 : fallback;
}
