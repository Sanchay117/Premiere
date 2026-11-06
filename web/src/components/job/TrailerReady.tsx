"use client";

// The finished trailer on a lit drive-in screen, with the four take-home files.

import { motion } from "motion/react";
import type { JobView } from "@/lib/types";

const DOWNLOADS = [
  { key: "video", label: "Trailer", note: "MP4, 1920 × 1080" },
  { key: "thumb1920", label: "Poster", note: "PNG, 1920 × 1080" },
  { key: "thumb1280", label: "Lobby card", note: "PNG, 1280 × 720" },
  { key: "captions", label: "Subtitles", note: "SRT, word-timed" },
] as const;

export function TrailerReady({ job }: { job: JobView }) {
  const trailer = job.result!.trailer!;
  const file = (name: string, download = false) => `/api/jobs/${job.id}/files/${name}${download ? "?download=1" : ""}`;
  const names: Record<(typeof DOWNLOADS)[number]["key"], string | undefined> = {
    video: trailer.video,
    thumb1920: trailer.thumbnails[0],
    thumb1280: trailer.thumbnails[1],
    captions: trailer.captions,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="mt-14"
    >
      <p className="eyebrow flex items-center gap-2">
        <span className="rec-dot size-1.5 rounded-full bg-amber" />
        Now showing
      </p>
      <div className="relative mt-6">
        <div aria-hidden className="flicker pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber/[0.08] blur-3xl" />
        <div className="bg-[#16130e] p-[0.9%] shadow-[0_0_70px_rgb(255_214_150/0.2),0_0_220px_rgb(255_181_71/0.12)]">
          <video
            controls
            playsInline
            preload="metadata"
            poster={names.thumb1920 ? file(names.thumb1920) : undefined}
            src={file(trailer.video)}
            className="block aspect-video w-full bg-black"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {DOWNLOADS.map((d) => {
          const name = names[d.key];
          if (!name) return null;
          return (
            <a
              key={d.key}
              href={file(name, true)}
              className="ticket group flex items-center gap-3 rounded-xl border border-line-strong bg-ink-2/80 px-4 py-2.5 transition hover:border-amber/70"
            >
              <svg viewBox="0 0 24 24" className="size-4 text-amber" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <span className="block font-[family-name:var(--font-marquee)] text-xl leading-none tracking-[0.04em] text-cream group-hover:text-amber">
                  {d.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream-faint">{d.note}</span>
              </span>
            </a>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-xs text-cream-faint">
        {Math.round(trailer.duration)} s · {trailer.shotsFilmed} shots filmed
        {trailer.shotsSkipped.length > 0 && ` · ${trailer.shotsSkipped.length} skipped (never faked)`}
      </p>
    </motion.section>
  );
}
