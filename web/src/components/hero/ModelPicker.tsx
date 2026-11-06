"use client";

// Choose who writes the script, presented as a row of cinema tickets. The chosen one gets punched.

import { AnimatePresence, motion } from "motion/react";
import { PLANNERS, type PlannerChoice } from "@/lib/types";

export function ModelPicker({ value, onChange }: { value: PlannerChoice; onChange: (p: PlannerChoice) => void }) {
  return (
    <div>
      <p className="eyebrow mb-3">Who writes the script</p>
      <div role="radiogroup" aria-label="Who writes the script" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PLANNERS.map((p, i) => {
          const selected = p.id === value;
          return (
            <motion.button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              animate={{ y: selected ? -4 : 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="relative rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-amber/70"
            >
              <span
                className={`ticket relative flex h-full flex-col rounded-xl border px-4 pb-3 pt-3 transition-colors ${
                  selected
                    ? "border-amber/80 bg-amber/[0.12] shadow-[0_10px_40px_-12px_rgb(255_181_71/0.55)]"
                    : "border-line-strong bg-ink-2/80 hover:border-cream/35"
                }`}
              >
                <span className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-cream-faint">
                  <span>Admit one</span>
                  <span>No. {String(i + 1).padStart(2, "0")}</span>
                </span>
                <span
                  className={`mt-2 font-[family-name:var(--font-marquee)] text-[2.2rem] leading-[0.88] tracking-[0.04em] ${
                    selected ? "text-amber" : "text-cream"
                  }`}
                >
                  {p.name}
                </span>
                <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cream-dim">
                  {p.id === "none" ? "No model" : "Claude 5.5"}
                </span>
                <span className="mt-2 text-[12.5px] leading-snug text-cream-dim">{p.blurb}</span>
                <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-dashed border-line-strong pt-2 font-mono text-[11px]">
                  <span className={selected ? "text-amber" : "text-cream"}>{p.cost}</span>
                  <span className="text-cream-faint">per film</span>
                </span>
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      key="punch"
                      aria-hidden
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="absolute right-3.5 top-9 size-3 rounded-full bg-ink shadow-[inset_0_1px_3px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_181_71/0.35)]"
                    />
                  )}
                </AnimatePresence>
              </span>
              {p.tag && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-amber px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink">
                  {p.tag}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
