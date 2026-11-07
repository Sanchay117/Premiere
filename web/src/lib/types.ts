// Mirrors worker/src/server/types.ts (the job server's response) and worker/src/options.ts.
// Keep them in sync.

export type PlannerChoice = "haiku" | "sonnet" | "opus" | "none";
export type StepKey = "capture" | "plan" | "voice" | "record" | "render";
export type StepStatus = "pending" | "active" | "done" | "failed" | "soon";
export type TrailerStyle = "hype" | "walkthrough";
export type CaptionStyle = "karaoke" | "boxed" | "bold" | "off";
export type Narrator = "atlas" | "zeus" | "asteria" | "thalia" | "ophelia" | "athena" | "draco" | "pandora";
export type VoiceChoice = "auto" | Narrator;
export type TrailerLength = 45 | 30 | 15;
export type TrailerFormat = "landscape" | "vertical";

export interface TrailerOptions {
  style: TrailerStyle;
  voice: VoiceChoice;
  captions: CaptionStyle;
  /** Missing on jobs made before running times existed: those are 45 seconds. */
  length?: TrailerLength;
  /** Missing on jobs made before vertical cuts existed: those are landscape. */
  format?: TrailerFormat;
}

export interface Shot {
  action: "click" | "hover" | "type" | "scroll" | "wait";
  target: string | null;
  text: string | null;
  narration: string;
  /** On-screen title for the shot (1 to 4 words). Older plans may not have one. */
  punch?: string;
}

export interface Plan {
  appName: string;
  tagline: string;
  mood: "energetic" | "calm" | "playful" | "bold";
  hook: string;
  shots: Shot[];
  close: string;
  cta: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JobStepView {
  key: StepKey;
  label: string;
  status: StepStatus;
  detail: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface JobResultView {
  capture: {
    url: string;
    finalUrl: string;
    title: string;
    description: string;
    pageHeight: number;
    viewport: { width: number; height: number };
    screenshots: { file: string; scrollY: number }[];
    elements: { id: string; kind: string; text: string; box: Box }[];
    sections: { id: string; heading: string; y: number }[];
    notes: string[];
    warnings: string[];
  };
  plan: Plan;
  planner: {
    source: "claude" | "cache" | "mock" | "fallback";
    model: string | null;
    reason: string | null;
    words: number;
    issues: string[];
    costUsd: number;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    fallbackRan: boolean;
  };
  trailer: {
    video: string;
    thumbnails: string[];
    captions: string;
    duration: number;
    shotsFilmed: number;
    shotsSkipped: { index: number; reason: string }[];
    narrator?: string;
    /** What went differently from the order (no narrator, a simpler reshoot). */
    notes?: string[];
  } | null;
}

export interface JobView {
  id: string;
  url: string;
  planner: PlannerChoice;
  status: "queued" | "running" | "done" | "failed";
  queuePosition: number | null;
  /** Roughly how long until a queued job starts, from how long recent jobs took. */
  waitSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
  steps: JobStepView[];
  error: string | null;
  result: JobResultView | null;
  /** Missing on jobs made before options existed. */
  options?: TrailerOptions;
  gallery?: boolean;
}

export interface GalleryEntry {
  id: string;
  appName: string;
  tagline: string;
  host: string;
  url: string;
  duration: number;
  style: string;
  narrator: string;
  createdAt: string;
}

export interface Pricing {
  free: boolean;
  mode: "off" | "testnet" | "mainnet";
  priceUsd: number;
  network: string | null;
  networkName: string | null;
  payTo: string | null;
  asset: string | null;
}

/** Claude Opus writes every script now; the other names remain for trailers made before. */
const PLANNER_NAMES: Record<PlannerChoice, string> = {
  opus: "Claude Opus 5.5",
  sonnet: "Claude Sonnet 5.5",
  haiku: "Claude Haiku 5.5",
  none: "Free planner",
};

export function plannerName(id: PlannerChoice): string {
  return PLANNER_NAMES[id] ?? id;
}
