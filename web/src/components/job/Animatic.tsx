"use client";

// Storyboard preview: plays the plan over the captured screenshots like a rough trailer.
// Each shot zooms toward its target element, a cursor moves and clicks, typed text appears,
// and captions reveal word by word. The real trailer uses recorded footage; this is a preview.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { JobResultView, Shot } from "@/lib/types";

const WORDS_PER_SECOND = 2.6;
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const secondsFor = (text: string, min: number) => Math.max(min, words(text).length / WORDS_PER_SECOND + 0.6);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Point {
  x: number;
  y: number;
}

export type Scene =
  | { kind: "title"; start: number; duration: number; caption: string }
  | {
      kind: "shot";
      start: number;
      duration: number;
      caption: string;
      index: number;
      shot: Shot;
      file: string;
      focus: Rect | null;
      label: string;
      from: Point;
      to: Point;
    }
  | { kind: "end"; start: number; duration: number; caption: string };

/** Turns a plan plus its capture into timed scenes, mapping each target to a screenshot region. */
export function buildScenes(result: JobResultView): Scene[] {
  const { capture, plan } = result;
  const vw = capture.viewport.width || 1920;
  const vh = capture.viewport.height || 1080;
  const shots = capture.screenshots;
  const elements = new Map(capture.elements.map((e) => [e.id, e]));
  const sections = new Map(capture.sections.map((s) => [s.id, s]));

  const pickScreenshot = (y: number) => {
    let best = 0;
    let bestDistance = Infinity;
    shots.forEach((s, i) => {
      const top = s.scrollY;
      const bottom = s.scrollY + vh;
      const d = y < top ? top - y : y > bottom ? y - bottom : 0;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return best;
  };
  const fit = (r: Rect): Rect => {
    const w = clamp(r.w, 1, 100);
    const h = clamp(r.h, 1, 100);
    return { x: clamp(r.x, 0, 100 - w), y: clamp(r.y, 0, 100 - h), w, h };
  };

  const scenes: Scene[] = [];
  let t = 0;
  const titleDuration = secondsFor(plan.hook, 3.2);
  scenes.push({ kind: "title", start: t, duration: titleDuration, caption: plan.hook });
  t += titleDuration;

  let current = 0;
  let cursor: Point = { x: 50, y: 62 };
  plan.shots.forEach((shot, index) => {
    let focus: Rect | null = null;
    let label = "";
    const el = shot.target ? elements.get(shot.target) : undefined;
    const section = shot.target ? sections.get(shot.target) : undefined;
    if (el) {
      current = pickScreenshot(el.box.y + el.box.h / 2);
      const top = shots[current]?.scrollY ?? 0;
      focus = fit({ x: (el.box.x / vw) * 100, y: ((el.box.y - top) / vh) * 100, w: (el.box.w / vw) * 100, h: (el.box.h / vh) * 100 });
      label = el.text;
    } else if (section) {
      current = pickScreenshot(section.y + 60);
      const top = shots[current]?.scrollY ?? 0;
      focus = fit({ x: 6, y: ((section.y - top) / vh) * 100 - 3, w: 88, h: 18 });
      label = section.heading;
    } else if (shot.action === "scroll") {
      current = Math.min(current + 1, Math.max(0, shots.length - 1));
    }
    const to = focus ? { x: focus.x + focus.w / 2, y: focus.y + focus.h / 2 } : cursor;
    const duration = secondsFor(shot.narration, 2.8);
    scenes.push({
      kind: "shot",
      start: t,
      duration,
      caption: shot.narration,
      index,
      shot,
      file: shots[current]?.file ?? "",
      focus,
      label,
      from: cursor,
      to,
    });
    cursor = to;
    t += duration;
  });

  const endDuration = secondsFor(plan.close, 3.4);
  scenes.push({ kind: "end", start: t, duration: endDuration, caption: plan.close });
  return scenes;
}

export function runtimeOf(scenes: Scene[]): number {
  const last = scenes[scenes.length - 1];
  return last ? last.start + last.duration : 0;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Caption({ text, p }: { text: string; p: number }) {
  const list = words(text);
  const shown = Math.ceil(list.length * clamp(p * 1.12));
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center px-[6%]">
      <p className="rounded-lg bg-black/65 px-[2.2%] py-[1%] text-center text-[clamp(11px,1.7vw,22px)] font-medium leading-snug backdrop-blur-sm">
        {list.map((w, i) => (
          <span key={i} className={i < shown ? "text-white" : "text-white/30"}>
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

function CursorIcon({ at }: { at: Point }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute w-[2.2%] min-w-3 drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      aria-hidden
    >
      <path d="M4 2l15 9.5-6.6 1.4L9.2 20z" fill="#fff" stroke="#07080c" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ShotFrame({ scene, p, src }: { scene: Extract<Scene, { kind: "shot" }>; p: number; src: string }) {
  const { focus, shot } = scene;
  const zoomIn = easeInOut(clamp(p / 0.7));
  // A virtual camera: pick a scale and a point to center, then clamp the visible window to the
  // image so elements near the edges (nav links, corner buttons) stay in frame.
  let scale = 1.02 + 0.05 * p;
  let centerX = 50;
  let centerY = 50;
  if (focus) {
    const target = focus.w < 12 ? 1.75 : focus.w < 30 ? 1.5 : focus.w < 60 ? 1.3 : 1.15;
    scale = 1.02 + (target - 1.02) * zoomIn;
    centerX = 50 + (focus.x + focus.w / 2 - 50) * zoomIn;
    centerY = 50 + (focus.y + focus.h / 2 - 50) * zoomIn;
  } else if (shot.action === "scroll") {
    scale = 1.1;
    centerY = 46 + 8 * easeInOut(p);
  }
  const span = 100 / scale;
  const left = clamp(centerX - span / 2, 0, 100 - span);
  const top = clamp(centerY - span / 2, 0, 100 - span);
  const pointing = shot.action === "click" || shot.action === "hover" || shot.action === "type";
  const cursorAt = {
    x: scene.from.x + (scene.to.x - scene.from.x) * easeOut(clamp(p / 0.45)),
    y: scene.from.y + (scene.to.y - scene.from.y) * easeOut(clamp(p / 0.45)),
  };
  const ripple = shot.action === "click" ? clamp((p - 0.45) / 0.3) : 0;
  const typed = shot.text ? shot.text.slice(0, Math.round(shot.text.length * clamp((p - 0.3) / 0.45))) : "";

  return (
    <div
      className="absolute inset-0"
      style={{ transform: `translate(${-left * scale}%, ${-top * scale}%) scale(${scale})`, transformOrigin: "0 0" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
      ) : (
        <div className="absolute inset-0 bg-ink-3" />
      )}
      {focus && (
        <div
          className="absolute rounded-md border-2 border-amber"
          style={{
            left: `${focus.x}%`,
            top: `${focus.y}%`,
            width: `${focus.w}%`,
            height: `${focus.h}%`,
            opacity: clamp((p - 0.18) / 0.15),
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.28), 0 0 26px rgb(255 181 71 / 0.75)",
          }}
        />
      )}
      {shot.action === "type" && focus && typed && (
        <div
          className="absolute rounded-md bg-black/80 px-2 py-1 font-mono text-[clamp(9px,1.3vw,16px)] text-white"
          style={{ left: `${focus.x}%`, top: `${Math.min(92, focus.y + focus.h + 1.5)}%` }}
        >
          {typed}
          <span className="caret text-amber">|</span>
        </div>
      )}
      {ripple > 0 && ripple < 1 && (
        <span
          className="absolute aspect-square rounded-full border-2 border-amber"
          style={{
            left: `${cursorAt.x}%`,
            top: `${cursorAt.y}%`,
            width: `${2 + ripple * 9}%`,
            transform: "translate(-50%, -50%)",
            opacity: 1 - ripple,
          }}
        />
      )}
      {pointing && <CursorIcon at={cursorAt} />}
    </div>
  );
}

export interface AnimaticHandle {
  seek: (sceneIndex: number) => void;
}

interface AnimaticProps {
  jobId: string;
  result: JobResultView;
  onScene?: (index: number) => void;
}

export const Animatic = forwardRef<AnimaticHandle, AnimaticProps>(function Animatic({ jobId, result, onScene }, ref) {
  const scenes = useMemo(() => buildScenes(result), [result]);
  const total = runtimeOf(scenes);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const timeRef = useRef(0);
  const fileUrl = (file: string) => (file ? `/api/jobs/${jobId}/files/${file}` : "");

  const sceneIndex = Math.max(
    0,
    scenes.findIndex((s) => time < s.start + s.duration),
  );
  const activeIndex = time >= total ? scenes.length - 1 : sceneIndex;
  const scene = scenes[activeIndex]!;
  const p = clamp((time - scene.start) / scene.duration);

  useImperativeHandle(
    ref,
    () => ({
      seek(index: number) {
        const target = scenes[index];
        if (!target) return;
        timeRef.current = target.start + 0.001;
        setTime(timeRef.current);
        setPlaying(true);
      },
    }),
    [scenes],
  );

  // Autoplay once, shortly after the result arrives.
  useEffect(() => {
    const id = setTimeout(() => setPlaying(true), 700);
    return () => clearTimeout(id);
  }, []);

  // Preload every screenshot so cuts are instant.
  useEffect(() => {
    for (const shot of result.capture.screenshots) {
      const img = new Image();
      img.src = `/api/jobs/${jobId}/files/${shot.file}`;
    }
  }, [jobId, result]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      timeRef.current = Math.min(total, timeRef.current + (now - last) / 1000);
      last = now;
      setTime(timeRef.current);
      if (timeRef.current >= total) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  useEffect(() => {
    onScene?.(activeIndex);
  }, [activeIndex, onScene]);

  // Optional rough narration with the browser's own voice, to judge pacing.
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    synth.cancel();
    if (!voice || !playing) return;
    const utterance = new SpeechSynthesisUtterance(scene.caption);
    utterance.rate = 1.05;
    synth.speak(utterance);
    // Only restart speech when the scene changes, not on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, playing, activeIndex]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const toggle = () => {
    if (time >= total) {
      timeRef.current = 0;
      setTime(0);
    }
    setPlaying((v) => !v);
  };

  const plan = result.plan;
  const host = (() => {
    try {
      return new URL(result.capture.finalUrl).hostname.replace(/^www\./, "");
    } catch {
      return result.capture.finalUrl;
    }
  })();

  return (
    <div>
      <div
        className="group relative aspect-video cursor-pointer overflow-hidden rounded-2xl border border-line-strong bg-black shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pause preview" : "Play preview"}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {scene.kind === "title" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#231a10,#08090d_70%)] text-center">
            <span className="font-mono text-[clamp(8px,0.95vw,12px)] uppercase tracking-[0.35em] text-cream-dim">Now showing</span>
            <h3
              className="mt-[2%] px-[6%] font-display text-[clamp(34px,7vw,96px)] uppercase leading-none tracking-[0.02em] text-cream"
              style={{ letterSpacing: `${0.3 - 0.29 * easeOut(clamp(p / 0.6))}em`, opacity: clamp(p / 0.3) }}
            >
              {plan.appName}
            </h3>
            {plan.tagline && (
              <p className="mt-[1.5%] px-[8%] text-[clamp(12px,1.8vw,24px)] font-semibold text-amber" style={{ opacity: clamp((p - 0.25) / 0.3) }}>
                {plan.tagline}
              </p>
            )}
          </div>
        )}
        {scene.kind === "shot" && <ShotFrame scene={scene} p={p} src={fileUrl(scene.file)} />}
        {scene.kind === "end" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3%] bg-[radial-gradient(circle_at_50%_40%,#1d1710,#07080c_70%)] text-center">
            <span
              className="rounded-full bg-amber px-[3%] py-[1.2%] text-[clamp(12px,1.9vw,26px)] font-medium text-ink"
              style={{ opacity: clamp(p / 0.25), transform: `scale(${0.9 + 0.1 * easeOut(clamp(p / 0.3))})` }}
            >
              {plan.cta}
            </span>
            <span className="font-mono text-[clamp(11px,1.5vw,20px)] text-cream">{host}</span>
            <span className="absolute bottom-[18%] font-mono text-[clamp(8px,0.9vw,11px)] uppercase tracking-[0.3em] text-cream-faint">
              Made with Premiere
            </span>
          </div>
        )}

        <Caption text={scene.caption} p={p} />

        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-100 transition group-hover:bg-black/35">
            <span className="flex size-[clamp(48px,8vw,84px)] items-center justify-center rounded-full bg-amber text-ink shadow-xl">
              <svg viewBox="0 0 24 24" className="ml-1 size-1/3 fill-current" aria-hidden>
                <path d="M6 4l14 8-14 8z" />
              </svg>
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-cream transition hover:border-amber hover:text-amber"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 size-4 fill-current" aria-hidden>
              <path d="M6 4l14 8-14 8z" />
            </svg>
          )}
        </button>
        <div className="flex h-8 flex-1 items-center gap-[3px]">
          {scenes.map((s, i) => {
            const fill = i < activeIndex ? 1 : i === activeIndex ? p : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  timeRef.current = s.start + 0.001;
                  setTime(timeRef.current);
                  setPlaying(true);
                }}
                className="group/seg relative h-1.5 overflow-hidden rounded-full bg-cream/15 transition hover:h-2.5"
                style={{ flexGrow: s.duration, flexBasis: 0 }}
                aria-label={`Jump to ${s.kind === "shot" ? `shot ${s.index + 1}` : s.kind === "title" ? "title card" : "end card"}`}
              >
                <span className="absolute inset-y-0 left-0 bg-amber" style={{ width: `${fill * 100}%` }} />
              </button>
            );
          })}
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-cream-dim">
          {fmt(time)} / {fmt(total)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-cream-dim">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="accent-amber" />
          Read it aloud with the browser&apos;s voice (rough, for pacing)
        </label>
        <span className="text-xs text-cream-faint">Preview from screenshots. The trailer itself will use recorded footage.</span>
      </div>
    </div>
  );
});
