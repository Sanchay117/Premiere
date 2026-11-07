// The parts of the site's job view (GET /api/jobs/:id) this server reads. Mirrors
// web/src/lib/types.ts; fields that older jobs or older sites leave out are optional here.

export type StepStatus = "pending" | "active" | "done" | "failed" | "soon";

export interface JobStep {
  key: string;
  label: string;
  status: StepStatus;
  detail: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface TrailerResult {
  video: string;
  thumbnails: string[];
  captions: string;
  duration: number;
  shotsFilmed?: number;
  shotsSkipped?: { index: number; reason: string }[];
  /** The narrator's name, for example Atlas, or "Captions only" when no voice could be had. */
  narrator?: string;
  /** What went differently from the order (no narrator, a simpler reshoot). */
  notes?: string[];
}

export interface JobView {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  queuePosition: number | null;
  /** Roughly how long until a queued job starts. */
  waitSeconds?: number | null;
  createdAt: string;
  steps: JobStep[];
  error: string | null;
  result: { plan?: { appName?: string }; trailer: TrailerResult | null } | null;
  options?: { style?: string; voice?: string; captions?: string; length?: number; format?: string };
  gallery?: boolean;
}
