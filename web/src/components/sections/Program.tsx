"use client";

// Tonight's program: the five reels of a trailer job, printed on a handbill like a drive-in's
// weekly program, scheduled from 2:00 to 2:05 a.m. A clock beside it ticks forward as you scroll.

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { Reveal } from "./Reveal";

const REELS = [
  {
    time: "2:00",
    title: "The capture",
    body: "A fresh, locked-down browser opens your app at 1920 by 1080, clears the cookie banners and maps every button, link and section. It stays on public pages and never signs in.",
    credit: "Playwright",
  },
  {
    time: "2:01",
    title: "The script",
    body: "One Claude call reads the screenshots and writes the shot list in the cut you chose: what to click, what to type, where to scroll, a punch title for every shot, and narration that only says what your page supports.",
    credit: "Claude Sonnet 5.5",
  },
  {
    time: "2:02",
    title: "The voice",
    body: "Your narrator reads the script: one of eight voices, or the one that suits your app. Every word gets a timestamp, so the captions land exactly when they are spoken.",
    credit: "Deepgram Aura-2",
  },
  {
    time: "2:03",
    title: "The shoot",
    body: "The browser replays the shot list and films it, each shot exactly as long as its line. Every step has a timeout, and a step that fails is skipped, never faked.",
    credit: "Real footage",
  },
  {
    time: "2:05",
    title: "The cut",
    body: "Punch titles or a calm tour, a camera that eases toward each click, captions in your style, a score made from code, an end card with your URL, two thumbnails and mastered sound.",
    credit: "Remotion",
  },
];

function Clock({ minutes }: { minutes: ReturnType<typeof useSpring> }) {
  const minuteAngle = useTransform(minutes, (m) => m * 6);
  const hourAngle = useTransform(minutes, (m) => 60 + m * 0.5);
  return (
    <div className="relative size-44 rounded-full border-2 border-cream/30 bg-[radial-gradient(circle,#15120d,#0b0a08)] md:size-52">
      {Array.from({ length: 12 }, (_, i) => (
        // Each tick hangs from the top edge with its pivot at the clock's center.
        <span
          key={i}
          className="absolute top-[5%] h-[45%] w-px"
          style={{ left: "calc(50% - 0.5px)", transformOrigin: "50% 100%", transform: `rotate(${i * 30}deg)` }}
        >
          <span className={`block w-px ${i % 3 === 0 ? "h-3 bg-cream/80" : "h-1.5 bg-cream/35"}`} />
        </span>
      ))}
      <span className="absolute inset-x-0 top-[25%] text-center font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cream-faint">a.m.</span>
      <motion.span className="absolute bottom-1/2 left-1/2 h-[26%] w-[3px] origin-bottom -translate-x-1/2 bg-cream" style={{ rotate: hourAngle }} />
      <motion.span className="absolute bottom-1/2 left-1/2 h-[38%] w-[2px] origin-bottom -translate-x-1/2 bg-ticket" style={{ rotate: minuteAngle }} />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ticket" />
    </div>
  );
}

export function Program() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 70%"] });
  const minutes = useSpring(useTransform(scrollYProgress, [0, 1], [0, 5]), { stiffness: 90, damping: 22 });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(REELS.length - 1, Math.floor(v * REELS.length))));
  const clockLabel = useTransform(minutes, (m) => `2:${String(Math.min(5, Math.floor(m))).padStart(2, "0")} A.M.`);

  return (
    <section id="program" ref={ref} className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <h2 className="font-display text-[clamp(3.4rem,7.4vw,6.6rem)] leading-[0.92] tracking-[0.01em]">
              TONIGHT&apos;S
              <br />
              PROGRAM
            </h2>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-cream-dim">
              You ship at 2 a.m. The trailer is ready by 2:05, five reels run back to back while you get back to building.
            </p>
          </Reveal>
          <div className="mt-9 flex items-center gap-6">
            <Clock minutes={minutes} />
            <motion.p className="font-mono text-2xl font-bold tabular-nums text-cream">{clockLabel}</motion.p>
          </div>
        </div>

        <Reveal>
          <div className="paper relative px-6 pb-6 pt-7 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] sm:px-10 sm:pb-8 sm:pt-9">
            <div className="flex items-baseline justify-between border-b-[3px] border-double border-paper-ink/60 pb-3">
              <p className="font-display text-[clamp(1.6rem,3vw,2.3rem)] leading-none tracking-[0.05em]">PREMIERE DRIVE-IN</p>
              <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-paper-dim">Open all night</p>
            </div>
            <ol>
              {REELS.map((reel, i) => {
                const on = i <= active;
                return (
                  <li key={reel.title} className="border-b border-dashed border-paper-ink/25 py-5 last:border-0">
                    <div className="flex items-baseline gap-3">
                      <span className={`w-[4.6rem] shrink-0 font-mono text-[15px] font-bold tabular-nums transition-colors duration-500 ${on ? "text-ticket" : "text-paper-dim/60"}`}>
                        {reel.time} AM
                      </span>
                      <h3 className={`font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none tracking-[0.03em] transition-colors duration-500 ${on ? "text-paper-ink" : "text-paper-ink/35"}`}>
                        {reel.title.toUpperCase()}
                      </h3>
                      <span className="mx-1 hidden flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-paper-ink/30 sm:block" />
                      <span className="hidden shrink-0 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-paper-dim sm:block">Reel {i + 1}</span>
                    </div>
                    <motion.div initial={false} animate={{ opacity: on ? 1 : 0.4 }} transition={{ duration: 0.5 }} className="pl-0 sm:pl-[5.35rem]">
                      <p className="mt-2.5 max-w-xl leading-relaxed text-paper-ink/85">{reel.body}</p>
                      <p className="mt-2 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-paper-dim">With {reel.credit}</p>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
