export interface Word {
  text: string;
  /** Seconds from the start of the line's audio. */
  start: number;
  end: number;
}

/** A voiced line, placed in the video. */
export interface Line {
  key: string;
  text: string;
  file: string;
  /** Seconds from the start of the video. */
  at: number;
  duration: number;
  words: Word[];
}

export interface AppFrame {
  name: string;
  file: string;
  accent: string;
}

// Composition props are type aliases: Remotion needs them to be indexable, which interfaces are not.
export type IntroProps = {
  base: string;
  apps: AppFrame[];
  /** A real script Premiere wrote, for the screenplay beat. */
  script: { hook: string; lines: string[] };
  /** The trailer voice's lines, with `at` relative to the start of the intro. */
  trailerLines: Line[];
};

/** A box on the recorded page, in CSS pixels of its 1440 by 810 viewport. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A stretch of the screen recording played over a stretch of the video, sped up or slowed. */
export interface RecPart {
  /** Video seconds. */
  outStart: number;
  outEnd: number;
  /** Recording seconds, from the start of the recording. */
  recStart: number;
  recEnd: number;
}

/** Where the camera looks from a moment on: a zoom (1 shows the whole page) around a point of the
 *  page, or around the pointer when following it. */
export interface CameraKey {
  at: number;
  z: number;
  cx?: number;
  cy?: number;
  follow?: boolean;
  /** Where on screen the point of interest sits, as a fraction of the height (0.44 leaves room for captions). */
  focusY?: number;
}

export interface Chapter {
  at: number;
  until: number;
  reel: number;
  title: string;
}

export interface Recording {
  viewport: { width: number; height: number };
  scale: number;
  frames: { t: number; file: string }[];
  moves: { t: number; until: number; x: number; y: number }[];
  clicks: { t: number; x: number; y: number }[];
}

export type DemoProps = IntroProps & {
  fps: number;
  durationInFrames: number;
  introSeconds: number;
  guideLines: Line[];
  rec: Recording;
  parts: RecPart[];
  camera: CameraKey[];
  chapters: Chapter[];
  /** Speed-up badges: from, to (video seconds) and how fast. */
  timelapses: { start: number; end: number; speed: number; realStart: number }[];
  /** A finished trailer drawn over the page's video player, with its own sound. */
  overlays: { file: string; start: number; end: number; box: Box; from: number }[];
  /** The motion graphic beats after the recording. */
  graphics: { key: "formats" | "agents" | "close"; start: number; end: number }[];
  /** When the screen recording ends and the graphics take over. */
  walkEnd: number;
  vertical: string | null;
  wide: string | null;
  soundtrack: string;
};
