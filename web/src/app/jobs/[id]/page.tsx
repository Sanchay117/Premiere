"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Footer, Nav } from "@/components/chrome";
import { NightSky } from "@/components/drivein/NightSky";
import { LetterboxOpen } from "@/components/hero/Letterbox";
import { FilmStrip } from "@/components/job/FilmStrip";
import { Storyboard } from "@/components/job/Storyboard";
import { TrailerReady } from "@/components/job/TrailerReady";
import { useJob } from "@/components/job/useJob";
import { plannerName } from "@/lib/types";
import { narratorLabel } from "@/lib/options";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { job, error } = useJob(id);
  const host = job ? hostOf(job.result?.capture.finalUrl ?? job.url) : "";
  const title = job?.result?.plan.appName ?? (job ? host : error ? "Lost reel" : "Loading the reel");
  const statusText = !job
    ? ""
    : job.status === "queued"
      ? `In the queue${job.queuePosition ? `, number ${job.queuePosition}` : ""}${
          job.waitSeconds ? `, starts in about ${Math.max(1, Math.round(job.waitSeconds / 60))} min` : ""
        }`
      : job.status === "running"
        ? "Rolling"
        : job.status === "done"
          ? job.result?.trailer
            ? "Trailer ready"
            : "Storyboard ready"
          : "Stopped";

  return (
    <>
      <Nav />
      <LetterboxOpen />
      <main className="relative isolate min-h-screen overflow-hidden pb-28 pt-28 md:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)]"
        >
          <div className="relative isolate h-full">
            <NightSky />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <Link href="/" className="eyebrow inline-flex items-center gap-2 transition hover:text-cream">
            ← Back to the front gate
          </Link>
          <p className="eyebrow mt-10">Screening room</p>
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 break-words font-display text-[clamp(3.2rem,9vw,7.6rem)] uppercase leading-[0.9] tracking-[0.01em]"
          >
            {title}
          </motion.h1>

          {job && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs text-cream-dim">{host}</span>
              <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs text-cream-dim">{plannerName(job.planner)}</span>
              {job.options && (
                <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-xs text-cream-dim">
                  {job.options.style === "hype" ? "Hype cut" : "Walkthrough"} · {job.options.length ?? 45} s · {job.result?.trailer?.narrator ?? narratorLabel(job.options.voice)} · {job.options.captions} captions
                </span>
              )}
              <span
                className={`flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs ${
                  job.status === "failed" ? "bg-rec/15 text-rec" : job.status === "done" ? "bg-amber/15 text-amber" : "bg-cream/10 text-cream"
                }`}
              >
                {(job.status === "running" || job.status === "queued") && <span className="rec-dot size-1.5 rounded-full bg-rec" />}
                {statusText}
              </span>
            </div>
          )}

          {error && !job && (
            <div className="mt-10 max-w-xl rounded-2xl border border-rec/40 bg-rec/[0.06] p-6">
              <p className="text-cream">{error}</p>
              <Link href="/#make" className="mt-4 inline-block text-sm text-amber underline-offset-4 hover:underline">
                Start a new trailer
              </Link>
            </div>
          )}

          {job && <FilmStrip steps={job.steps} />}

          {job?.status === "failed" && (
            <div className="mt-10 max-w-2xl rounded-2xl border border-rec/40 bg-rec/[0.06] p-6">
              <p className="eyebrow text-rec">The take did not finish</p>
              <p className="mt-3 text-lg text-cream">{job.error ?? "Something went wrong."}</p>
              <Link href="/#make" className="mt-5 inline-block text-sm text-amber underline-offset-4 hover:underline">
                Try another link
              </Link>
            </div>
          )}

          {job?.result?.trailer && <TrailerReady job={job} />}
          {job?.result && <Storyboard job={job} />}
        </div>
      </main>
      <Footer />
    </>
  );
}
