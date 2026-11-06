// Mirrors worker/src/server/types.ts (the job server's response). Keep the two in sync.

export type PlannerChoice = "haiku" | "sonnet" | "opus" | "none";
export type StepKey = "capture" | "plan" | "voice" | "record" | "render";
export type StepStatus = "pending" | "active" | "done" | "failed" | "soon";

export interface Shot {
  action: "click" | "hover" | "type" | "scroll" | "wait";
  target: string | null;
  text: string | null;
  narration: string;
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
  } | null;
}

export interface JobView {
  id: string;
  url: string;
  planner: PlannerChoice;
  status: "queued" | "running" | "done" | "failed";
  queuePosition: number | null;
  createdAt: string;
  updatedAt: string;
  steps: JobStepView[];
  error: string | null;
  result: JobResultView | null;
}

export const PLANNERS: { id: PlannerChoice; name: string; family: string; blurb: string; cost: string; tag?: string }[] = [
  { id: "haiku", name: "Haiku", family: "Claude Haiku 5.5", blurb: "Quickest draft", cost: "~$0.001" },
  { id: "sonnet", name: "Sonnet", family: "Claude Sonnet 5.5", blurb: "Vivid, grounded scripts", cost: "~$0.015", tag: "Our pick" },
  { id: "opus", name: "Opus", family: "Claude Opus 5.5", blurb: "Tightest edit", cost: "~$0.03" },
  { id: "none", name: "No AI", family: "Free planner", blurb: "Script from the page's own words", cost: "$0" },
];

export function plannerName(id: PlannerChoice): string {
  return PLANNERS.find((p) => p.id === id)?.family ?? id;
}
