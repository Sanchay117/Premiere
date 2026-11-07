// Props passed from the worker into the Remotion compositions. Type aliases (not interfaces) so
// they satisfy Remotion's Record<string, unknown> constraint.

import type { CaptionStyle, TrailerFormat, TrailerStyle } from "../../options";

export type Box = { x: number; y: number; w: number; h: number };

export type CaptionWord = { text: string; start: number; end: number };

export type TrailerSegment = {
  kind: "title" | "shot" | "end";
  from: number;
  frames: number;
  /** Words relative to the segment start, in seconds. */
  words: CaptionWord[];
  footageStart?: number;
  /** Recording seconds where the shot's footage ends: a longer recut line holds the last frame. */
  footageEnd?: number;
  actionAt?: number;
  action?: string;
  box?: Box | null;
  /** Frames of punch title before the footage (hype cuts). */
  punchFrames?: number;
  /** The shot's punch title. */
  title?: string;
};

export type AppInfo = { name: string; tagline: string; cta: string; host: string };

export type TrailerProps = {
  fps: number;
  durationInFrames: number;
  /** Base URL of the job's asset server. */
  base: string;
  app: AppInfo;
  segments: TrailerSegment[];
  frames: { t: number; file: string }[];
  soundtrack: string;
  /** Missing in edits saved before styles existed: those render as a walkthrough with boxed captions. */
  style?: TrailerStyle;
  captions?: CaptionStyle;
  /** The app's own color for type, captions and the end card (render/thumbnail.ts). Amber when missing. */
  accent?: string;
  /** Landscape (1920 by 1080) or vertical (1080 by 1920). Landscape when missing. */
  format?: TrailerFormat;
};

export type ThumbnailProps = {
  base: string;
  app: AppInfo;
  /** Frame file to use as the backdrop. */
  frame: string;
  /** Missing in edits saved before styles existed. */
  style?: TrailerStyle;
  /** The app's own color for the title rule, tagline and glow (render/thumbnail.ts). Amber when missing. */
  accent?: string;
};
