"use client";

// Rolling end credits for the bottom of the home page. They start with the title already on
// screen and only roll while the credits are in view, so nobody arrives to an empty screen.

import { useInView } from "motion/react";
import { useRef } from "react";
import { Wordmark } from "@/components/chrome";

const CREDITS: [string, string][] = [
  ["Directed by", "An agent"],
  ["Screenplay", "Claude Sonnet 5.5"],
  ["Cinematography", "Chromium, via Playwright"],
  ["Narration", "Deepgram Aura-2, eight voices"],
  ["Edited in", "Remotion"],
  ["Original score", "Synthesized from code"],
  ["Box office", "USDC on Base, over x402"],
  ["Security", "One very suspicious proxy"],
  ["Catering", "Instant noodles, 3 a.m."],
  ["Filmed on location", "Your app"],
  ["Made for", "Vibestarter Vibeathon 02: Night shift"],
];

const WINDOW = 460;
const START = 150;

export function Credits() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -15% 0px" });
  return (
    <footer className="relative overflow-hidden border-t border-line bg-black">
      <div
        ref={ref}
        className="relative mx-auto max-w-3xl overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_84%,transparent)]"
        style={{ height: WINDOW, ["--roll-h" as string]: `${START}px` }}
      >
        <div
          className="credits-roll absolute inset-x-0 flex flex-col items-center gap-8 px-5 pb-10 text-center"
          style={{ top: START, animationPlayState: inView ? "running" : "paused" }}
        >
          <Wordmark className="text-7xl" />
          <p className="-mt-3 font-mono text-[12px] font-bold uppercase tracking-[0.3em] text-cream-faint">A night shift production</p>
          {CREDITS.map(([role, name]) => (
            <div key={role}>
              <p className="font-mono text-[12px] font-bold uppercase tracking-[0.24em] text-cream-faint">{role}</p>
              <p className="mt-1.5 font-display text-[2.3rem] leading-none tracking-[0.04em] text-cream">{name.toUpperCase()}</p>
            </div>
          ))}
          <p className="mt-4 max-w-sm text-lg text-cream-dim">No apps were harmed in the making of this trailer.</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-5 py-6 text-xs text-cream-faint md:flex-row md:items-center md:justify-between md:px-8">
        <span className="flex items-baseline gap-2">
          <Wordmark className="text-xl" /> Launch trailers, made by an agent
        </span>
        <span className="font-mono">Made for Vibestarter Vibeathon 02: Night shift</span>
      </div>
    </footer>
  );
}
