"use client";

import { motion } from "motion/react";
import { Reveal } from "./Reveal";

const TICKETS = [
  {
    who: "Vibeathon 02 entrants",
    price: "Free",
    note: "Unlock with the entrant code we share in the Vibestarter Discord.",
    stub: "Admit one",
  },
  {
    who: "Founders",
    price: "A few USDC",
    note: "Per trailer, paid on Base. No account, no subscription.",
    stub: "Pay per film",
  },
  {
    who: "AI agents",
    price: "x402",
    note: "One HTTP request with payment returns a job id, then the trailer.",
    stub: "Machine pass",
  },
];

export function Access() {
  return (
    <section id="access" className="relative scroll-mt-24 border-t border-line py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <p className="eyebrow">Box office</p>
          <h2 className="mt-5 font-serif text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.95] tracking-[-0.02em]">
            Get your <em className="text-amber">ticket.</em>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TICKETS.map((t, i) => (
            <Reveal key={t.who} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="ticket flex h-full overflow-hidden rounded-2xl border border-line-strong bg-ink-2"
              >
                <div className="flex-1 p-7">
                  <p className="eyebrow">{t.who}</p>
                  <p className="mt-6 font-serif text-6xl leading-none text-cream">{t.price}</p>
                  <p className="mt-5 leading-relaxed text-cream-dim">{t.note}</p>
                </div>
                <div className="flex w-14 items-center justify-center border-l border-dashed border-line-strong bg-amber/[0.06]">
                  <span className="rotate-90 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.3em] text-amber">{t.stub}</span>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
