"use client";

// The hero screen: a looping teaser of what a run looks like, for a made-up app called Nightjar.
// Five scenes: the link, the capture, the script, the voice and the premiere.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const SCENES = [
  { key: "paste", label: "The link" },
  { key: "capture", label: "The capture" },
  { key: "script", label: "The script" },
  { key: "voice", label: "The voice" },
  { key: "premiere", label: "The premiere" },
] as const;
const SCENE_MS = 3200;

function Cursor({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${className}`} aria-hidden>
      <path d="M4 2l15 9.5-6.6 1.4L9.2 20z" fill="#f3ead8" stroke="#07080c" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PasteScene() {
  const full = "nightjar.app";
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => Math.min(full.length, v + 1)), 90);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#1b1f2e,#0a0c13_70%)]">
      <div className="w-[74%] rounded-xl border border-white/10 bg-[#10121b] shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[9px] uppercase tracking-[0.2em] text-cream-faint">premiere</span>
        </div>
        <div className="flex items-center gap-2 p-[4%]">
          <div className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[clamp(10px,1.3vw,15px)] text-cream">
            <span className="text-cream-faint">https://</span>
            {full.slice(0, n)}
            <span className="caret text-amber">|</span>
          </div>
          <div className="relative">
            <motion.div
              className="rounded-lg bg-amber px-3 py-2 text-[clamp(9px,1.15vw,13px)] font-medium text-ink"
              animate={{ scale: [1, 1, 0.9, 1] }}
              transition={{ times: [0, 0.72, 0.8, 1], duration: 2.7 }}
            >
              Roll camera
            </motion.div>
            <motion.div
              className="absolute -bottom-4 -right-3"
              initial={{ x: 70, y: 46, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ delay: 1.15, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <Cursor />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WIREFRAME = [
  { id: "e1", box: "left-[7%] top-[15%] w-[13%] h-[6%]", kind: "logo" },
  { id: "e2", box: "left-[58%] top-[16%] w-[8%] h-[4%]", kind: "link" },
  { id: "e3", box: "left-[69%] top-[16%] w-[8%] h-[4%]", kind: "link" },
  { id: "e4", box: "left-[80%] top-[14.5%] w-[13%] h-[7%]", kind: "button" },
  { id: "e5", box: "left-[7%] top-[52%] w-[19%] h-[9%]", kind: "button" },
  { id: "e6", box: "left-[7%] top-[68%] w-[27%] h-[18%]", kind: "card" },
  { id: "e7", box: "left-[37%] top-[68%] w-[27%] h-[18%]", kind: "card" },
  { id: "e8", box: "left-[67%] top-[68%] w-[26%] h-[18%]", kind: "card" },
];

function CaptureScene() {
  return (
    <div className="absolute inset-0 bg-[#0f1220]">
      {/* hero heading lines */}
      <div className="absolute left-[7%] top-[29%] h-[7%] w-[52%] rounded bg-white/15" />
      <div className="absolute left-[7%] top-[39%] h-[7%] w-[38%] rounded bg-white/15" />
      <motion.div
        className="absolute left-[6%] top-[27.5%] h-[20%] w-[55%] rounded border-2 border-sky"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      />
      <motion.span
        className="absolute left-[6%] top-[21.5%] rounded bg-sky px-1.5 font-mono text-[clamp(8px,1vw,12px)] font-bold text-white"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        s1
      </motion.span>
      {WIREFRAME.map((b, i) => (
        <div key={b.id} className={`absolute ${b.box}`}>
          <div
            className={`h-full w-full rounded ${
              b.kind === "button" ? "bg-amber/70" : b.kind === "card" ? "bg-white/[0.07]" : b.kind === "logo" ? "bg-white/25" : "bg-white/15"
            }`}
          />
          <motion.div
            className="absolute -inset-[3px] rounded border-2 border-mark"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 + i * 0.16, duration: 0.3 }}
          />
          <motion.span
            className="absolute -top-[1.35em] left-0 rounded bg-mark px-1.5 font-mono text-[clamp(8px,1vw,12px)] font-bold text-white"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.16, duration: 0.3 }}
          >
            {b.id}
          </motion.span>
        </div>
      ))}
      <motion.div
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber to-transparent shadow-[0_0_18px_rgb(255_181_71/0.8)]"
        initial={{ top: "8%" }}
        animate={{ top: "92%" }}
        transition={{ duration: 2.6, ease: "linear" }}
      />
      <span className="absolute bottom-[10%] right-[4%] font-mono text-[clamp(8px,0.9vw,11px)] text-cream-dim">
        8 things to click, 1 section
      </span>
    </div>
  );
}

const SCRIPT = [
  { tag: "HOOK", action: "", line: "Night owls need a journal that stays up too." },
  { tag: "01", action: 'click e5 "Start writing"', line: "Tonight's page opens, ready for the first line." },
  { tag: "02", action: 'type e9 "wrote at 3am again"', line: "Every entry tags its own mood." },
  { tag: "03", action: 'scroll s3 "Your nights"', line: "A month of moods, mapped by the hour." },
  { tag: "CLOSE", action: "", line: "Write your night at nightjar.app." },
];

function ScriptScene() {
  return (
    <div className="absolute inset-0 bg-[#0d0f17] px-[6%] py-[11%]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[clamp(8px,0.95vw,11px)] uppercase tracking-[0.2em] text-cream-faint">Nightjar · trailer script</span>
        <span className="flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 font-mono text-[clamp(8px,0.9vw,11px)] text-amber">
          <span className="rec-dot size-1.5 rounded-full bg-amber" />
          Claude Opus 5.5 writing
        </span>
      </div>
      <div className="mt-[4%] space-y-[2.2%]">
        {SCRIPT.map((s, i) => (
          <motion.div
            key={s.tag}
            className="grid grid-cols-[4.2em_1fr] gap-3 text-[clamp(9px,1.25vw,14px)]"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.42, duration: 0.4 }}
          >
            <span className="font-mono text-amber">{s.tag}</span>
            <span>
              {s.action && <span className="mr-2 font-mono text-cream-faint">[{s.action}]</span>}
              <span className="text-cream">{s.line}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const CAPTION = "Night owls need a journal that stays up too.".split(" ");

function VoiceScene() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setK((v) => Math.min(CAPTION.length, v + 1)), 260);
    return () => clearInterval(id);
  }, []);
  const bars = Array.from({ length: 44 }, (_, i) => i);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[7%] bg-[radial-gradient(circle_at_50%_50%,#1a1622,#0a0b10_70%)]">
      <div className="flex h-[30%] items-center gap-[0.45%]">
        {bars.map((i) => (
          <motion.span
            key={i}
            className="w-[clamp(2px,0.45vw,5px)] rounded-full bg-amber/80"
            animate={{ height: ["18%", `${30 + ((i * 37) % 70)}%`, "24%", `${20 + ((i * 53) % 80)}%`, "18%"] }}
            transition={{ duration: 1.1 + (i % 5) * 0.12, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.05 }}
          />
        ))}
      </div>
      <p className="max-w-[80%] text-center text-[clamp(11px,1.7vw,20px)] font-medium">
        {CAPTION.map((w, i) => (
          <span key={i} className={`transition-colors duration-200 ${i < k ? "text-cream" : "text-cream/25"}`}>
            {w}{" "}
          </span>
        ))}
      </p>
      <span className="font-mono text-[clamp(8px,0.9vw,11px)] uppercase tracking-[0.2em] text-cream-faint">Every word timed for captions</span>
    </div>
  );
}

function PremiereScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#231a10,#08090d_68%)] text-center">
      <span className="font-mono text-[clamp(8px,0.95vw,11px)] uppercase tracking-[0.35em] text-cream-dim">Now showing</span>
      <motion.h3
        className="mt-[2%] font-display text-[clamp(34px,7.5vw,96px)] leading-none tracking-[0.03em] text-cream"
        initial={{ letterSpacing: "0.35em", opacity: 0 }}
        animate={{ letterSpacing: "0.01em", opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      >
        Nightjar
      </motion.h3>
      <motion.p
        className="mt-[1.5%] text-[clamp(12px,1.8vw,22px)] font-semibold text-amber"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        a journal for night owls
      </motion.p>
      <motion.span
        className="absolute bottom-[11%] font-mono text-[clamp(8px,0.9vw,11px)] uppercase tracking-[0.25em] text-cream-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        Made with Premiere
      </motion.span>
    </div>
  );
}

const RENDER: Record<(typeof SCENES)[number]["key"], () => React.JSX.Element> = {
  paste: PasteScene,
  capture: CaptureScene,
  script: ScriptScene,
  voice: VoiceScene,
  premiere: PremiereScene,
};

export function TeaserReel({ variant = "card" }: { variant?: "card" | "screen" }) {
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen) return;
    const id = setInterval(() => setIndex((v) => (v + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(id);
  }, [onScreen]);

  // Timecode at 24 frames a second, written straight to the DOM to avoid re-rendering.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const frames = Math.floor((t % 1) * 24);
      const s = Math.floor(t) % 60;
      const m = Math.floor(t / 60) % 60;
      const pad = (v: number) => String(v).padStart(2, "0");
      if (timecodeRef.current) timecodeRef.current.textContent = `00:${pad(m)}:${pad(s)}:${pad(frames)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scene = SCENES[index]!;
  const Scene = RENDER[scene.key];

  return (
    <div ref={rootRef} className="relative">
      {variant === "card" && (
        <div className="flicker pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-amber/[0.09] blur-3xl" aria-hidden />
      )}
      <div
        className={
          variant === "card"
            ? "relative aspect-video overflow-hidden rounded-2xl border border-line-strong bg-ink-2 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]"
            : "relative aspect-video overflow-hidden bg-ink-2"
        }
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={scene.key}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Scene />
          </motion.div>
        </AnimatePresence>

        {/* Letterbox bars carry the HUD, like a camera monitor. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[8%] items-center justify-between bg-black px-[3%]">
          <span ref={timecodeRef} className="font-mono text-[clamp(8px,0.85vw,11px)] tabular-nums text-cream/70">
            00:00:00:00
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[clamp(8px,0.85vw,11px)] text-cream/70">
            <span className="rec-dot size-1.5 rounded-full bg-rec" />
            REC
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[8%] items-center justify-between bg-black px-[3%]">
          <span className="font-mono text-[clamp(8px,0.85vw,11px)] uppercase tracking-[0.2em] text-cream/60">
            Scene {index + 1} · {scene.label}
          </span>
          <div className="flex gap-1">
          {SCENES.map((s, k) => (
            <span key={s.key} className="h-[3px] w-5 overflow-hidden rounded-full bg-cream/15">
              {k === index && (
                <motion.span
                  className="block h-full bg-amber"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: SCENE_MS / 1000, ease: "linear" }}
                />
              )}
              {k < index && <span className="block h-full w-full bg-cream/45" />}
            </span>
          ))}
          </div>
        </div>
      </div>
      {variant === "card" && <p className="eyebrow mt-4 text-[10px]">Teaser: a sample run for a made-up app</p>}
    </div>
  );
}
