"use client";

// Tonight's program: the five reels of a trailer job, scheduled from 2:00 to 2:05 a.m.
// A night-shift clock on the left ticks forward as you scroll through the reels.

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
    body: "One Claude call reads the screenshots and writes the shot list: what to click, what to type, where to scroll, and about 110 words of narration that only says what your page supports.",
    credit: "Claude Sonnet 5.5",
  },
  {
    time: "2:02",
    title: "The shoot",
    body: "The browser replays the shot list and records it. Every step has a timeout, and a step that fails is skipped, never faked.",
    credit: "Real footage",
  },
  {
    time: "2:04",
    title: "The voice",
    body: "A narrator reads the script and every word gets a timestamp, so the captions land exactly when they are spoken.",
    credit: "Deepgram Aura-2",
  },
  {
    time: "2:05",
    title: "The cut",
    body: "Title card, gentle zooms toward each click, captions, a score made from code, an end card with your URL, two thumbnails and mastered sound.",
    credit: "Remotion",
  },
];

function Clock({ minutes }: { minutes: ReturnType<typeof useSpring> }) {
  const minuteAngle = useTransform(minutes, (m) => m * 6);
  const hourAngle = useTransform(minutes, (m) => 60 + m * 0.5);
  return (
    <div className="relative size-48 rounded-full border border-line-strong bg-ink-2/80 shadow-[0_0_60px_-10px_rgb(255_181_71/0.35)] md:size-56">
      {Array.from({ length: 12 }, (_, i) => (
        // Each tick hangs from the top edge with its pivot at the clock's center.
        <span
          key={i}
          className="absolute top-[4%] h-[46%] w-px"
          style={{ left: "calc(50% - 0.5px)", transformOrigin: "50% 100%", transform: `rotate(${i * 30}deg)` }}
        >
          <span className={`block w-px ${i % 3 === 0 ? "h-3 bg-cream/70" : "h-1.5 bg-cream/30"}`} />
        </span>
      ))}
      <span className="absolute inset-x-0 top-[24%] text-center font-mono text-[10px] uppercase tracking-[0.3em] text-cream-faint">a.m.</span>
      <motion.span
        className="absolute bottom-1/2 left-1/2 h-[26%] w-[3px] origin-bottom -translate-x-1/2 rounded-full bg-cream"
        style={{ rotate: hourAngle }}
      />
      <motion.span
        className="absolute bottom-1/2 left-1/2 h-[38%] w-[2px] origin-bottom -translate-x-1/2 rounded-full bg-amber"
        style={{ rotate: minuteAngle }}
      />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber" />
    </div>
  );
}

export function Program() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 70%"] });
  const minutes = useSpring(useTransform(scrollYProgress, [0, 1], [0, 5]), { stiffness: 90, damping: 22 });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(REELS.length - 1, Math.floor(v * REELS.length))));
  const clockLabel = useTransform(minutes, (m) => `2:${String(Math.min(5, Math.floor(m))).padStart(2, "0")} a.m.`);

  return (
    <section id="program" ref={ref} className="relative scroll-mt-24 py-28 md:py-36">
      <div className="mx-auto grid max-w-7xl gap-16 px-5 md:px-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="eyebrow">Tonight&apos;s program</p>
            <h2 className="mt-5 font-serif text-[clamp(2.8rem,6.4vw,5.8rem)] leading-[0.95] tracking-[-0.02em]">
              You ship at 2&nbsp;a.m.
              <br />
              <em className="text-amber">The trailer is ready by 2:05.</em>
            </h2>
          </Reveal>
          <div className="mt-10 flex items-center gap-6">
            <Clock minutes={minutes} />
            <div>
              <motion.p className="font-mono text-2xl tabular-nums text-cream">{clockLabel}</motion.p>
              <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-cream-dim">
                Five reels, run back to back while you get back to building.
              </p>
            </div>
          </div>
        </div>

        <ol className="relative">
          {REELS.map((reel, i) => {
            const on = i <= active;
            return (
              <li key={reel.title} className="relative border-b border-line py-8 first:pt-2 last:border-0">
                <div className="flex items-baseline gap-4">
                  <span className={`w-14 shrink-0 font-mono text-sm tabular-nums transition-colors duration-500 ${on ? "text-amber" : "text-cream-faint"}`}>
                    {reel.time}
                  </span>
                  <h3 className={`font-serif text-4xl transition-colors duration-500 md:text-5xl ${on ? "text-cream" : "text-cream/35"}`}>{reel.title}</h3>
                  <span className="mx-2 hidden flex-1 border-b border-dotted border-line-strong md:block" />
                  <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-cream-faint md:block">Reel {i + 1}</span>
                </div>
                <motion.div
                  initial={false}
                  animate={{ opacity: on ? 1 : 0.35 }}
                  transition={{ duration: 0.5 }}
                  className="pl-[4.5rem]"
                >
                  <p className="mt-4 max-w-xl leading-relaxed text-cream-dim">{reel.body}</p>
                  <span className="mt-4 inline-flex rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] text-cream-dim">
                    {reel.credit}
                  </span>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
