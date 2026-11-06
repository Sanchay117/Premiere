"use client";

// What you take home, as steel film cans with masking tape across the lid, labelled in marker the
// way editors label their reels.

import { motion } from "motion/react";
import { Reveal } from "./Reveal";

const CANS = [
  { file: "trailer.mp4", label: "the feature", specs: ["1920 × 1080, about 45 seconds", "H.264 and AAC, loudness at -16 LUFS", "captions burned in, your style"] },
  { file: "thumbnail-1920.png", label: "the poster", specs: ["1920 × 1080, for YouTube", "and your raise page"] },
  { file: "thumbnail-1280.png", label: "the lobby card", specs: ["1280 × 720, for X", "and Discord"] },
  { file: "captions.srt", label: "word-timed", specs: ["Subtitles you can edit", "or upload anywhere"] },
];

/** Torn tape ends, so the strip does not look cut with scissors. */
const TAPE = "polygon(0% 8%, 3% 0%, 6% 10%, 9% 2%, 91% 0%, 95% 9%, 98% 1%, 100% 12%, 100% 88%, 97% 100%, 94% 90%, 91% 99%, 8% 100%, 5% 91%, 2% 100%, 0% 90%)";

function Can({ file, label, i }: { file: string; label: string; i: number }) {
  return (
    <motion.div
      whileHover={{ rotate: i % 2 ? 10 : -10, y: -6 }}
      transition={{ type: "spring", stiffness: 220, damping: 16 }}
      className="relative mx-auto aspect-square w-[min(100%,15rem)] rounded-full shadow-[0_30px_50px_-20px_rgb(0_0_0/0.9)]"
      style={{ background: "radial-gradient(circle at 32% 26%, #c9cdd3, #8b9098 30%, #55595f 62%, #2c2e32)" }}
    >
      <div className="absolute inset-[5%] rounded-full border-[3px] border-black/25 shadow-[inset_0_2px_3px_rgb(255_255_255/0.35)]" />
      <div className="absolute inset-[11%] rounded-full" style={{ background: "repeating-radial-gradient(circle, transparent 0 7px, rgb(0 0 0 / 0.07) 7px 8px)" }} />
      <div className="absolute inset-[40%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#9ca1a8,#3d4045)] shadow-[inset_0_1px_2px_rgb(255_255_255/0.4)]" />
      <div
        className="absolute left-[5%] right-[5%] top-1/2 -translate-y-1/2 bg-[#e9ddb9]/95 px-3 py-2.5 text-center shadow-[0_2px_4px_rgb(0_0_0/0.35)]"
        style={{ clipPath: TAPE, transform: `translateY(-50%) rotate(${i % 2 ? 3 : -4}deg)` }}
      >
        <p className={`font-marker leading-tight text-[#1c1a17] ${file.length > 14 ? "text-[0.86rem]" : "text-[1.05rem]"}`}>{file}</p>
        <p className="font-marker text-[0.8rem] leading-tight text-[#1c1a17]/70">{label}</p>
      </div>
    </motion.div>
  );
}

export function Reels() {
  return (
    <section id="deliverables" className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <h2 className="max-w-4xl font-display text-[clamp(3.2rem,7vw,6.2rem)] leading-[0.92] tracking-[0.01em]">FOUR CANS GO HOME WITH YOU</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-dim">Every trailer comes back as four files, labelled and ready to post.</p>
        </Reveal>
        <div className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {CANS.map((can, i) => (
            <Reveal key={can.file} delay={i * 0.08}>
              <Can file={can.file} label={can.label} i={i} />
              <ul className="mt-6 space-y-1 text-center text-[15px] leading-relaxed text-cream-dim">
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
