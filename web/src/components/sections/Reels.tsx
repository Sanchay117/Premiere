"use client";

// What you take home, as labelled film cans.

import { motion } from "motion/react";
import { Reveal } from "./Reveal";

const CANS = [
  { file: "trailer.mp4", label: "Feature", specs: ["1920 × 1080, about 45 seconds", "H.264 and AAC", "captions burned in", "loudness at -16 LUFS"], hot: true },
  { file: "thumbnail-1920.png", label: "Poster", specs: ["1920 × 1080", "for YouTube and the raise page"] },
  { file: "thumbnail-1280.png", label: "Lobby card", specs: ["1280 × 720", "for X and Discord"] },
  { file: "captions.srt", label: "Subtitles", specs: ["word-timed", "edit them if you like"] },
];

function Can({ file, label, hot, i }: { file: string; label: string; hot?: boolean; i: number }) {
  return (
    <motion.div
      whileHover={{ rotate: i % 2 ? 14 : -14, y: -8 }}
      transition={{ type: "spring", stiffness: 220, damping: 16 }}
      className="relative mx-auto aspect-square w-[min(100%,15rem)] rounded-full shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]"
      style={{
        background: hot
          ? "radial-gradient(circle at 34% 28%, #5a4220, #241a0d 55%, #110c06)"
          : "radial-gradient(circle at 34% 28%, #3d4252, #191b25 55%, #0c0d13)",
      }}
    >
      <div className="absolute inset-[6%] rounded-full border border-white/10" />
      <div
        className="absolute inset-[14%] rounded-full"
        style={{ background: "repeating-radial-gradient(circle, transparent 0 9px, rgb(255 255 255 / 0.035) 9px 10px)" }}
      />
      <div className="absolute inset-[42%] rounded-full border border-white/15 bg-black/40" />
      <div className="absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 -rotate-6 rounded-sm bg-[#efe4cb] px-3 py-2 text-center shadow-md">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#6b5a3a]">{label}</p>
        <p className="mt-0.5 break-all font-mono text-[13px] font-medium text-[#1a1309]">{file}</p>
      </div>
    </motion.div>
  );
}

export function Reels() {
  return (
    <section id="deliverables" className="relative scroll-mt-24 py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <p className="eyebrow">Take-home reels</p>
          <h2 className="mt-5 max-w-3xl font-serif text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.95] tracking-[-0.02em]">
            Four cans, ready to <em className="text-amber">post.</em>
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {CANS.map((can, i) => (
            <Reveal key={can.file} delay={i * 0.08}>
              <Can file={can.file} label={can.label} hot={can.hot} i={i} />
              <ul className="mt-6 space-y-1.5 text-center text-sm text-cream-dim">
                {can.specs.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
