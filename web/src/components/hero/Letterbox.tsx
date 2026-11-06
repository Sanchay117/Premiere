"use client";

// Cinema bars: close over the page when a job starts, open again on the screening room.

import { motion } from "motion/react";

const EASE = [0.7, 0, 0.3, 1] as const;

export function LetterboxClose({ active }: { active: boolean }) {
  return (
    <>
      {(["top-0", "bottom-0"] as const).map((edge) => (
        <motion.div
          key={edge}
          aria-hidden
          className={`pointer-events-none fixed inset-x-0 ${edge} z-[90] bg-black`}
          initial={{ height: 0 }}
          animate={{ height: active ? "50.5vh" : 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      ))}
    </>
  );
}

export function LetterboxOpen() {
  return (
    <>
      {(["top-0", "bottom-0"] as const).map((edge) => (
        <motion.div
          key={edge}
          aria-hidden
          className={`pointer-events-none fixed inset-x-0 ${edge} z-[90] bg-black`}
          initial={{ height: "50.5vh" }}
          animate={{ height: 0 }}
          transition={{ duration: 0.85, ease: EASE, delay: 0.15 }}
        />
      ))}
    </>
  );
}
