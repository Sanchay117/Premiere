"use client";

// Rolling end credits for the bottom of the home page. They start with the title already on
// screen and only roll while the credits are in view, so nobody arrives to an empty screen.

import { useInView } from "motion/react";
import { useRef } from "react";
import { Logo } from "@/components/chrome";

const CREDITS: [string, string][] = [
  ["Directed by", "An agent"],
  ["Screenplay", "Claude Sonnet 5.5"],
  ["Cinematography", "Chromium, via Playwright"],
  ["Narration", "Deepgram Aura-2"],
  ["Edited in", "Remotion"],
  ["Original score", "Synthesized from code"],
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
          className="credits-roll absolute inset-x-0 flex flex-col items-center gap-9 px-5 pb-10 text-center"
          style={{ top: START, animationPlayState: inView ? "running" : "paused" }}
        >
          <Logo className="size-10" />
          <p className="font-serif text-6xl">Premiere</p>
          <p className="eyebrow -mt-5">A night shift production</p>
          {CREDITS.map(([role, name]) => (
            <div key={role}>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cream-faint">{role}</p>
              <p className="mt-2 font-serif text-3xl text-cream">{name}</p>
            </div>
          ))}
          <p className="mt-4 max-w-sm font-serif text-xl italic text-cream-dim">No apps were harmed in the making of this trailer.</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-line px-5 py-6 text-xs text-cream-faint md:flex-row md:items-center md:justify-between md:px-8">
        <span className="flex items-center gap-2">
          <Logo className="size-4" /> Premiere · launch trailers, made by an agent
        </span>
        <span className="font-mono">Made for Vibestarter Vibeathon 02: Night shift</span>
      </div>
    </footer>
  );
}
