"use client";

// The drive-in screen: a real trailer in a lit frame on posts, with the projector beam rising
// from the lot behind the cars and dust drifting through the light.

import { useEffect, useRef } from "react";
import { SampleTrailer } from "./SampleTrailer";

/** Normalized beam triangle: apex in the lot, wide end at the screen. */
const APEX = { x: 0.6, y: 1 };
const TOP_Y = 0.2;
const TOP_LEFT = 0.04;
const TOP_RIGHT = 0.96;

function insideBeam(x: number, y: number): number {
  if (y < TOP_Y || y > APEX.y) return 0;
  const t = (y - TOP_Y) / (APEX.y - TOP_Y); // 0 at the screen, 1 at the projector
  const left = TOP_LEFT + (APEX.x - TOP_LEFT) * t;
  const right = TOP_RIGHT + (APEX.x - TOP_RIGHT) * t;
  if (x < left || x > right) return 0;
  const mid = (left + right) / 2;
  const half = (right - left) / 2 || 0.0001;
  return 1 - Math.abs(x - mid) / half;
}

function BeamDust() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const motes = Array.from({ length: 110 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.00008,
      vy: -0.00003 - Math.random() * 0.0001,
      phase: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx * 16 + Math.sin(t * 0.0005 + m.phase) * 0.00012;
        m.y += m.vy * 16;
        if (m.y < TOP_Y - 0.02) {
          m.y = 1;
          m.x = APEX.x + (Math.random() - 0.5) * 0.3;
        }
        if (m.x < 0) m.x = 1;
        if (m.x > 1) m.x = 0;
        const glow = insideBeam(m.x, m.y);
        if (glow <= 0) continue;
        const alpha = glow * (0.35 + 0.35 * Math.sin(t * 0.002 + m.phase));
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 228, 175, ${alpha})`;
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    const observer = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
    });
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function BigScreen() {
  const polygon = `${APEX.x * 100},${APEX.y * 100} ${TOP_LEFT * 100},${TOP_Y * 100} ${TOP_RIGHT * 100},${TOP_Y * 100}`;
  return (
    <div className="relative">
      {/* Projector beam, from the booth in the lot up to the screen. */}
      <div aria-hidden className="pointer-events-none absolute -bottom-[clamp(160px,26vw,340px)] -left-[6%] -right-[6%] top-[8%] -z-10">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="flicker absolute inset-0 h-full w-full blur-[10px]">
          <defs>
            <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#fff1d0" stopOpacity="0.75" />
              <stop offset="0.4" stopColor="#ffd28a" stopOpacity="0.26" />
              <stop offset="1" stopColor="#ffb547" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <polygon points={polygon} fill="url(#beam)" />
        </svg>
        <BeamDust />
      </div>

      {/* The screen itself: a plain panel in a dark frame, lit only by the projector. */}
      <div className="relative bg-[#0f0f12] p-[0.9%] ring-1 ring-white/5 shadow-[0_0_90px_rgb(220_230_255/0.12)]">
        <SampleTrailer />
      </div>
      <p className="mt-2 text-right font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cream-faint">
        On screen: a real trailer Premiere made of fundable.vibestarter.xyz from its link alone
      </p>
      {/* Support posts */}
      <div aria-hidden className="mx-auto flex w-[78%] justify-between">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[clamp(60px,10vw,140px)] w-[clamp(6px,0.8vw,11px)] bg-gradient-to-b from-[#121420] to-[#05060b]" />
        ))}
      </div>
    </div>
  );
}
