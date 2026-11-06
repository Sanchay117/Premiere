"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { plannerName, type JobView, type Shot } from "@/lib/types";
import { Animatic, buildScenes, runtimeOf, type AnimaticHandle } from "./Animatic";

const ACTION_STYLE: Record<Shot["action"], string> = {
  click: "border-amber/50 bg-amber/10 text-amber",
  type: "border-sky/50 bg-sky/10 text-sky",
  hover: "border-cream/30 bg-cream/5 text-cream",
  scroll: "border-cream/20 bg-transparent text-cream-dim",
  wait: "border-cream/15 bg-transparent text-cream-faint",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-sm text-cream-dim">{label}</span>
      <span className="text-right font-mono text-sm text-cream">
        {value}
        {hint && <span className="block text-[11px] text-cream-faint">{hint}</span>}
      </span>
    </div>
  );
}

/** A second take of the same app: filmed again with a fresh script, or in the other cut. */
function Rerun({ job }: { job: JobView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"again" | "other" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const style = job.options?.style ?? "hype";
  const other = style === "hype" ? "walkthrough" : "hype";
  const takes = [
    { id: "again" as const, label: "Same cut, new script", order: { fresh: true } },
    { id: "other" as const, label: `The ${other} cut`, order: { style: other } },
  ];

  const run = async (take: (typeof takes)[number]) => {
    setBusy(take.id);
    setError(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: job.url, ...job.options, gallery: job.gallery ?? true, ...take.order }),
      });
      const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Could not start the job.");
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the job.");
      setBusy(null);
    }
  };

  return (
    <div className="mt-16 rounded-2xl border border-line bg-ink-2/60 p-6 md:p-8">
      <p className="eyebrow">Second take</p>
      <h3 className="mt-3 font-display text-[2.4rem] leading-none tracking-[0.03em]">SHOOT ANOTHER TAKE</h3>
      <p className="mt-2 text-sm text-cream-dim">
        A new take films your app again and Claude writes a fresh script, so it can come out quite different. It counts as one of
        today&apos;s free trailers.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {takes.map((take) => (
          <button
            key={take.id}
            type="button"
            disabled={busy !== null}
            onClick={() => run(take)}
            className="rounded-full border border-line-strong px-4 py-2 text-sm transition hover:border-amber hover:text-amber disabled:opacity-50"
          >
            {busy === take.id ? "Starting" : take.label}
          </button>
        ))}
        <a href="/#make" className="rounded-full px-4 py-2 text-sm text-cream-dim underline-offset-4 hover:text-cream hover:underline">
          Try a different link
        </a>
      </div>
      {error && <p className="mt-3 text-sm text-rec">{error}</p>}
    </div>
  );
}

export function Storyboard({ job }: { job: JobView }) {
  const result = job.result!;
  const { plan, planner, capture } = result;
  const animatic = useRef<AnimaticHandle>(null);
  const [current, setCurrent] = useState(0);
  const onScene = useCallback((i: number) => setCurrent(i), []);
  const runtime = useMemo(() => runtimeOf(buildScenes(result)), [result]);
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of capture.elements) map.set(e.id, e.text);
    for (const s of capture.sections) map.set(s.id, s.heading);
    return map;
  }, [capture]);

  const usedFallback = planner.source === "fallback";
  const writer = usedFallback ? "Free planner" : planner.model ? plannerName(job.planner) : plannerName(job.planner);
  const rows = [
    { kind: "title" as const, text: plan.hook },
    ...plan.shots.map((shot) => ({ kind: "shot" as const, shot, text: shot.narration })),
    { kind: "end" as const, text: plan.close },
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="mt-16">
      <p className="eyebrow">{result.trailer ? "How it was planned" : job.status === "running" ? "Storyboard, while the trailer is made" : "Storyboard preview"}</p>
      <h2 className="mt-3 font-display text-[clamp(2.6rem,6vw,4.6rem)] uppercase leading-none tracking-[0.02em]">
        {plan.appName}: <span className="text-cream-dim">the storyboard</span>
      </h2>
      {plan.tagline && <p className="mt-3 text-xl font-semibold text-amber">{plan.tagline}</p>}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Animatic ref={animatic} jobId={job.id} result={result} onScene={onScene} />
        <aside className="h-fit rounded-2xl border border-line bg-ink-2/70 p-6">
          <p className="eyebrow mb-2">The take</p>
          <Stat label="Script by" value={writer} hint={planner.source === "cache" ? "from cache, $0" : undefined} />
          <Stat label="Narration" value={`${planner.words} words`} hint={job.options?.style === "hype" ? "target 55 to 85" : "target 95 to 125"} />
          <Stat label="Runtime" value={`about ${Math.round(runtime)} s`} />
          <Stat label="Shots" value={String(plan.shots.length)} />
          <Stat label="Mood" value={plan.mood} />
          {planner.costUsd > 0 && <Stat label="Planning cost" value={`$${planner.costUsd.toFixed(4)}`} />}
          {planner.latencyMs > 0 && <Stat label="Planning time" value={`${(planner.latencyMs / 1000).toFixed(1)} s`} />}
          {planner.inputTokens > 0 && <Stat label="Tokens" value={`${planner.inputTokens} in`} hint={`${planner.outputTokens} out`} />}
          {usedFallback && job.planner !== "none" && planner.reason && (
            <p className="mt-4 rounded-lg border border-amber/30 bg-amber/[0.06] p-3 text-xs leading-relaxed text-cream-dim">
              Claude was not used: {planner.reason}
            </p>
          )}
          {planner.fallbackRan && (
            <p className="mt-4 text-xs text-cream-faint">A refusal was retried on a fallback model inside the same call.</p>
          )}
          {(planner.issues.length > 0 || capture.notes.length > 0 || capture.warnings.length > 0) && (
            <details className="mt-4 text-xs text-cream-dim">
              <summary className="cursor-pointer text-cream-faint hover:text-cream">Notes and fixes ({planner.issues.length + capture.notes.length + capture.warnings.length})</summary>
              <ul className="mt-2 space-y-1.5">
                {[...capture.warnings, ...capture.notes, ...planner.issues].map((note, i) => (
                  <li key={i} className="leading-relaxed">· {note}</li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>

      <div className="mt-14">
        <p className="eyebrow mb-4">The script</p>
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {rows.map((row, i) => {
            const active = i === current;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => animatic.current?.seek(i)}
                  className={`grid w-full grid-cols-[3rem_1fr] gap-4 px-5 py-4 text-left transition md:grid-cols-[3rem_15rem_1fr] ${
                    active ? "bg-amber/[0.08]" : "hover:bg-ink-2"
                  }`}
                >
                  <span className={`font-mono text-xs ${active ? "text-amber" : "text-cream-faint"}`}>
                    {row.kind === "title" ? "TITLE" : row.kind === "end" ? "END" : String(i).padStart(2, "0")}
                  </span>
                  <span className="col-span-1 hidden md:block">
                    {row.kind === "shot" ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${ACTION_STYLE[row.shot.action]}`}>{row.shot.action}</span>
                        {row.shot.target && (
                          <span className="truncate text-xs text-cream-dim" title={labels.get(row.shot.target)}>
                            {labels.get(row.shot.target) ?? row.shot.target}
                          </span>
                        )}
                        {row.shot.text && <span className="font-mono text-[11px] text-sky">&ldquo;{row.shot.text}&rdquo;</span>}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-cream-faint">{row.kind === "title" ? `${plan.appName} title card` : `end card: ${plan.cta}`}</span>
                    )}
                  </span>
                  <span className={`leading-relaxed ${active ? "text-cream" : "text-cream-dim"}`}>{row.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <Rerun job={job} />
    </motion.section>
  );
}
