"use client";

// An intermission slide, projected the way drive-ins ran them between features: saturated color,
// rounded corners from the slide mount, darker at the edges. It tells where the word "trailer"
// comes from, and its countdown starts when the slide scrolls into view.

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

function ResumeTimer() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const [left, setLeft] = useState(60);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [inView]);
  return (
    <span ref={ref} className="tabular-nums text-[#ffd98a]">
      {left > 0 ? `0:${String(left).padStart(2, "0")}` : "now. Back to your cars."}
    </span>
  );
}

export function Intermission() {
  return (
    <section id="story" className="relative scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.2rem] bg-slide px-7 py-14 text-center shadow-[inset_0_0_140px_rgb(0_0_0/0.6),0_0_0_10px_#0b0b0d,0_0_90px_rgb(120_220_220/0.12)] md:px-16 md:py-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgb(255_255_255/0.08),transparent_60%)]" />
            <p className="relative font-script text-[clamp(3.6rem,10vw,7.4rem)] leading-[0.9] text-[#ffd98a] [text-shadow:0_4px_0_rgb(0_0_0/0.25)]">
              Intermission
            </p>
            <h2 className="relative mt-7 font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-none tracking-[0.04em] text-cream">
              WHY IS IT CALLED A TRAILER?
            </h2>
            <p className="relative mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-cream/90">
              New York, 1913. Early film ads were spliced onto the end of the reel, so they played after the feature. They trailed it, and
              the name stuck.
            </p>
            <p className="relative mx-auto mt-4 max-w-2xl leading-relaxed text-cream/70">
              One of the earliest promoted a Broadway musical in Marcus Loew&apos;s theaters in November 1913. Studios soon moved trailers to
              the front, where nobody could miss them.
            </p>

            <div aria-hidden className="relative mx-auto my-9 h-[3px] max-w-xs border-y border-[#ffd98a]/40" />

            <h3 className="relative font-display text-[clamp(1.9rem,4vw,3rem)] leading-none tracking-[0.04em] text-[#ffd98a]">EVERY LAUNCH NEEDS ONE</h3>
            <p className="relative mx-auto mt-4 max-w-2xl leading-relaxed text-cream/80">
              A demo video for the launch post, the hackathon entry and the raise page. Most founders skip it or lose a day making one.
              Premiere makes it from a link.
            </p>
            <p className="relative mt-9 font-mono text-[13px] font-bold uppercase tracking-[0.16em] text-cream/60">
              The show resumes in <ResumeTimer />
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
