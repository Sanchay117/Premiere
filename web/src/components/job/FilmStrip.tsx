"use client";

// Live job progress, drawn as frames on a strip of film.

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { JobStepView, StepStatus } from "@/lib/types";

function useElapsed(startedAt: string | null, endedAt: string | null, running: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);
  if (!startedAt) return "";
  const end = endedAt ? Date.parse(endedAt) : now;
  return `${Math.max(0, (end - Date.parse(startedAt)) / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-amber" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Done">
        <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg viewBox="0 0 16 16" className="size-4 text-rec" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Failed">
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "active") {
    return <span className="size-4 animate-spin rounded-full border-2 border-amber/30 border-t-amber" aria-label="Running" />;
  }
  if (status === "soon") return <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cream-faint">Soon</span>;
  return <span className="size-1.5 rounded-full bg-cream/30" aria-label="Waiting" />;
}

function Frame({ step, n }: { step: JobStepView; n: number }) {
  const active = step.status === "active";
  const elapsed = useElapsed(step.startedAt, step.endedAt, active);
  const tone =
    step.status === "active"
      ? "border-amber/70 bg-amber/[0.08] shadow-[0_0_40px_-10px_rgb(255_181_71/0.6)]"
      : step.status === "done"
        ? "border-line-strong bg-ink-2"
        : step.status === "failed"
          ? "border-rec/70 bg-rec/[0.08]"
          : step.status === "soon"
            ? "border-line bg-ink-2/40 opacity-55"
            : "border-line bg-ink-2/60";
  return (
    <motion.li
      layout
      className={`relative flex min-h-40 flex-col overflow-hidden rounded-md border p-4 transition-colors duration-500 ${tone}`}
    >
      {active && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-amber/15 to-transparent"
          initial={{ top: "-20%" }}
          animate={{ top: "110%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}
      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[11px] text-cream-faint">{String(n).padStart(2, "0")}</span>
        <StatusIcon status={step.status} />
      </div>
      <p className="relative mt-3 text-[15px] font-medium leading-tight text-cream">{step.label}</p>
      <p className="relative mt-2 text-xs leading-snug text-cream-dim">
        {step.status === "soon" ? "Coming soon" : step.detail ?? "Waiting"}
      </p>
      <span className="relative mt-auto pt-3 font-mono text-[11px] text-cream-faint">{elapsed}</span>
    </motion.li>
  );
}

export function FilmStrip({ steps }: { steps: JobStepView[] }) {
  return (
    <div className="mt-10 overflow-x-auto pb-2">
      <div className="min-w-[780px] overflow-hidden rounded-xl bg-ink-3">
        <div className="sprockets h-4" />
        <ol className="grid grid-cols-5 gap-2 px-2">
          {steps.map((step, i) => (
            <Frame key={step.key} step={step} n={i + 1} />
          ))}
        </ol>
        <div className="sprockets h-4" />
      </div>
    </div>
  );
}
