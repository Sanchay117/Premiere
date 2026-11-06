"use client";

// Choose who writes the script, presented as a row of ticket stubs.

import { motion } from "motion/react";
import { PLANNERS, type PlannerChoice } from "@/lib/types";

export function ModelPicker({ value, onChange }: { value: PlannerChoice; onChange: (p: PlannerChoice) => void }) {
  return (
    <div>
      <p className="eyebrow mb-3">Who writes the script</p>
      <div role="radiogroup" aria-label="Who writes the script" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PLANNERS.map((p) => {
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
              className={`relative text-left outline-none focus-visible:ring-2 focus-visible:ring-amber/70 rounded-xl`}
            >
              <span
                className={`ticket flex h-full flex-col gap-1 rounded-xl border px-4 py-3 transition-colors ${
                  selected
                    ? "border-amber/80 bg-amber/[0.12] shadow-[0_10px_40px_-12px_rgb(255_181_71/0.55)]"
                    : "border-line-strong bg-ink-2/70 hover:border-cream/35"
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream-faint">
                  {p.id === "none" ? "Free" : "Claude"}
                </span>
                <span className={`font-serif text-[1.65rem] leading-none ${selected ? "text-amber" : "text-cream"}`}>{p.name}</span>
                <span className="text-xs leading-snug text-cream-dim">{p.blurb}</span>
                <span className="mt-auto border-t border-dashed border-line-strong pt-2 font-mono text-[11px] text-cream-dim">
                  {p.cost} <span className="text-cream-faint">/ trailer</span>
                </span>
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
