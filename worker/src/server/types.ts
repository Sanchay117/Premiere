// What the job server returns. web/src/lib/types.ts mirrors this file; keep them in sync.

import type { Plan } from "../planner/schema";

export type PlannerChoice = "haiku" | "sonnet" | "opus" | "none";
export type StepKey = "capture" | "plan" | "record" | "voice" | "render";
export type StepStatus = "pending" | "active" | "done" | "failed" | "soon";

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
    elements: { id: string; kind: string; text: string; box: { x: number; y: number; w: number; h: number } }[];
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
