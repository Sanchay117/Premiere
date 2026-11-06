"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import type { ReactNode } from "react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <ReactLenis root options={{ lerp: 0.11, smoothWheel: !reduce, anchors: true }}>
      {children}
    </ReactLenis>
  );
}
