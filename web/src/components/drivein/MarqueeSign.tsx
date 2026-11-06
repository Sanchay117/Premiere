"use client";

// The roadside marquee: chasing bulbs and letter tiles that spell out the app being typed
// into the box office.

import { AnimatePresence, motion } from "motion/react";

export function marqueeName(url: string): string {
  const host = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]!
    .replace(/^www\./i, "");
  const clean = host.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 16);
  return clean || "YOUR APP HERE";
}

function BulbRow({ count, offset }: { count: number; offset: number }) {
  return (
    <div className="flex justify-between px-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bulb size-[7px] rounded-full" style={{ animationDelay: `${((i + offset) % 3) * 0.4}s` }} />
      ))}
    </div>
  );
}

export function MarqueeSign({ url }: { url: string }) {
  const name = marqueeName(url);
  const letters = Array.from(name);
  // Long names get smaller tiles so they always fit on one row.
  const n = letters.length;
  const tile = n > 13 ? { w: "1.15rem", h: "2.05rem", font: "1.2rem" } : n > 10 ? { w: "1.35rem", h: "2.3rem", font: "1.4rem" } : { w: "1.55rem", h: "2.5rem", font: "1.6rem" };
  return (
    <div className="relative w-[min(100%,25rem)]">
      <div className="relative rounded-md border border-[#4a3510] bg-[linear-gradient(#1a1209,#0e0a05)] px-3 py-2.5 shadow-[0_0_50px_rgb(255_181_71/0.22),inset_0_0_30px_rgb(0_0_0/0.6)]">
        <BulbRow count={18} offset={0} />
        <div className="my-2 rounded-sm border border-[#3a2a0e] bg-[#0b0804] px-3 py-3">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.45em] text-amber">Now showing</p>
          <div className="mt-2.5 flex min-h-11 flex-nowrap items-center justify-center gap-[3px] [perspective:400px]" aria-live="polite" aria-label={`Now showing: ${name}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {letters.map((ch, i) => (
                <motion.span
                  key={`${i}-${ch}`}
                  initial={{ rotateX: -90, opacity: 0 }}
                  animate={{ rotateX: 0, opacity: 1 }}
                  exit={{ rotateX: 90, opacity: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.025, 0.3) }}
                  style={{ height: tile.h, width: ch === " " ? "0.6rem" : tile.w, fontSize: tile.font }}
                  className={`flex shrink-0 items-center justify-center rounded-[3px] font-[family-name:var(--font-marquee)] leading-none text-[#1a1309] ${
                    ch === " " ? "bg-transparent" : "bg-[#f6ecd6] shadow-[0_2px_0_#b8a37a]"
                  }`}
                >
                  {ch === " " ? "" : ch}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <p className="mt-2.5 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-cream-faint">45 sec · narrated · open all night</p>
        </div>
        <BulbRow count={18} offset={1} />
      </div>
      <div aria-hidden className="mx-auto h-16 w-2 bg-gradient-to-b from-[#1a1c28] to-[#05060b]" />
    </div>
  );
}
