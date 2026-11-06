"use client";

// An old-fashioned intermission card that tells where the word "trailer" comes from.
// Its little countdown starts when the card scrolls into view.

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";

function Flourish({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 60" className={`absolute size-12 text-amber/60 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M4 56 V22 Q4 4 22 4 H56" />
      <path d="M12 56 V26 Q12 12 26 12 H56" opacity="0.5" />
      <circle cx="22" cy="22" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
    <span ref={ref} className="tabular-nums text-amber">
      {left > 0 ? `0:${String(left).padStart(2, "0")}` : "now. Back to your seats."}
    </span>
  );
}

export function Intermission() {
  return (
    <section id="story" className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-amber/25 bg-[radial-gradient(ellipse_at_top,#2a1d0c,#0d0b09_65%)] px-7 py-14 text-center shadow-[0_0_120px_-40px_rgb(255_181_71/0.5)] md:px-16 md:py-20">
            <Flourish className="left-5 top-5" />
            <Flourish className="right-5 top-5 rotate-90" />
            <Flourish className="bottom-5 right-5 rotate-180" />
            <Flourish className="bottom-5 left-5 -rotate-90" />

            <p className="font-mono text-xs uppercase tracking-[0.5em] text-amber">Intermission</p>
            <h2 className="mt-6 font-serif text-[clamp(2.8rem,7.5vw,6.5rem)] italic leading-[0.95]">Why &ldquo;trailer&rdquo;?</h2>
            <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-cream/90">
              New York, 1913. Early film ads were spliced onto the end of the reel, so they played after the feature.
              They trailed it, and the name stuck.
            </p>
            <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-cream-dim">
              One of the earliest promoted a Broadway musical in Marcus Loew&apos;s theaters in November 1913. Studios
              soon moved trailers to the front, where nobody could miss them.
            </p>

            <div className="mx-auto my-10 flex max-w-xs items-center gap-4" aria-hidden>
              <span className="h-px flex-1 bg-amber/30" />
              <span className="text-amber">✦</span>
              <span className="h-px flex-1 bg-amber/30" />
            </div>

            <h3 className="font-serif text-4xl md:text-5xl">Every launch needs one.</h3>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-cream-dim">
              A demo video for the launch post, the hackathon entry and the raise page. Most founders skip it or lose a day
              making one. Premiere makes it from a link.
            </p>
            <p className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-cream-faint">
              The feature resumes in <ResumeTimer />
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
