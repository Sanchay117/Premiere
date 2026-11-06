"use client";

// The roadside marquee: black plastic letters slotted into a lit panel, framed by chasing bulbs.
// It carries the headline, and its bottom row spells out the app being typed at the box office.
// Each letter hangs a little crooked, the way hand-hung marquee letters do.

import { AnimatePresence, motion } from "motion/react";
import { seeded } from "./rng";

export function marqueeName(url: string): string {
  const host = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]!
    .replace(/^www\./i, "");
  const clean = host.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 24);
  return clean || "YOUR APP HERE";
}

/** Letter tilt and drop, seeded so the sign hangs the same way on every visit. */
function hang(seed: number, count: number): { tilt: number; drop: number }[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({ tilt: (rand() - 0.5) * 3.4, drop: (rand() - 0.5) * 0.06 }));
}

function Words({ text, seed }: { text: string; seed: number }) {
  const offsets = hang(seed, text.length);
  const words: { word: string; at: number }[] = [];
  let at = 0;
  for (const word of text.split(" ")) {
    words.push({ word, at });
    at += word.length + 1;
  }
  return (
    <>
      {words.map(({ word, at: first }, w) => (
        <span key={w} className="mx-[0.12em] inline-flex whitespace-nowrap">
          {Array.from(word).map((ch, j) => {
            const o = offsets[first + j] ?? { tilt: 0, drop: 0 };
            return (
              <span key={j} className="inline-block" style={{ transform: `translateY(${o.drop}em) rotate(${o.tilt}deg)` }}>
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

function BulbRow({ count, offset }: { count: number; offset: number }) {
  return (
    <div className="flex justify-between px-2">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bulb size-[7px] rounded-full" style={{ animationDelay: `${((i + offset) % 3) * 0.4}s` }} />
      ))}
    </div>
  );
}

function AppName({ name }: { name: string }) {
  const offsets = hang(name.length * 7 + 5, name.length);
  return (
    <span className="inline-flex min-h-[1em] flex-nowrap items-center [perspective:500px]" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {Array.from(name).map((ch, i) => (
          <motion.span
            key={`${i}-${ch}`}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.25) }}
            className="inline-block"
            style={{ rotate: `${offsets[i]?.tilt ?? 0}deg`, width: ch === " " ? "0.3em" : undefined }}
          >
            {ch === " " ? "" : ch}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

export function MarqueeSign({ url }: { url: string }) {
  const name = marqueeName(url);
  return (
    <div className="relative">
      <div className="rounded-[10px] bg-[linear-gradient(#1d160c,#120d07)] p-2 shadow-[0_40px_90px_-40px_rgb(0_0_0/0.95)] ring-1 ring-[#3e2c12]">
        <BulbRow count={30} offset={0} />
        <div
          className="marquee-panel my-2 rounded-[3px] px-[3.5%] pb-3 pt-4 text-center text-[#16110a]"
          style={{ ["--track" as string]: "clamp(3.6rem,9vw,8.4rem)" }}
        >
          <h1 className="font-display text-[clamp(3.3rem,8.4vw,7.6rem)] leading-[1.02] tracking-[0.015em]">
            <span className="sr-only">Paste a URL. Get a trailer.</span>
            <span aria-hidden>
              <Words text="PASTE A URL." seed={3} /> <Words text="GET A TRAILER." seed={11} />
            </span>
          </h1>
          <p className="mt-1 flex flex-wrap items-baseline justify-center gap-x-[0.45em] border-t border-black/10 pt-2 font-display text-[clamp(1.5rem,2.9vw,2.5rem)] leading-tight">
            <span className="text-[#9b2c20]">NOW SHOWING</span>
            <AppName name={name} />
          </p>
        </div>
        <BulbRow count={30} offset={1} />
      </div>
      <div aria-hidden className="mx-auto flex w-[46%] justify-between">
        <span className="h-[clamp(18px,3vw,40px)] w-2.5 bg-gradient-to-b from-[#24262f] to-transparent" />
        <span className="h-[clamp(18px,3vw,40px)] w-2.5 bg-gradient-to-b from-[#24262f] to-transparent" />
      </div>
    </div>
  );
}
