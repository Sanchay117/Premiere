"use client";

// The choices on the box office ticket, drawn like a printed order form: tick boxes for the cut,
// a car radio for the narrator (drive-ins played the soundtrack over FM), little frames for the
// caption looks.

import { useEffect, useRef, useState } from "react";
import { CAPTIONS, NARRATORS, STYLES } from "@/lib/options";
import type { CaptionStyle, TrailerStyle, VoiceChoice } from "@/lib/types";

export function FormLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-paper-dim">{children}</span>;
}

/** A printed tick box that gets a red cross when chosen. */
function TickBox({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="relative inline-block size-4 shrink-0 border-2 border-paper-ink">
      {on && (
        <svg viewBox="0 0 16 16" className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-ticket">
          <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function StylePicker({ value, onChange }: { value: TrailerStyle; onChange: (v: TrailerStyle) => void }) {
  return (
    <fieldset>
      <legend>
        <FormLabel>The cut</FormLabel>
      </legend>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
        {STYLES.map((s) => {
          const on = s.id === value;
          return (
            <label
              key={s.id}
              className={`cursor-pointer border-2 px-3 py-2.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ticket ${
                on ? "border-ticket bg-ticket/[0.06]" : "border-paper-ink/20 hover:border-paper-ink/50"
              }`}
            >
              <input type="radio" name="style" value={s.id} checked={on} onChange={() => onChange(s.id)} className="sr-only" />
              <span className="flex items-center gap-2.5 font-display text-[1.7rem] leading-none tracking-wide">
                <TickBox on={on} />
                {s.name.toUpperCase()}
              </span>
              <span className="mt-1.5 block text-[13px] leading-snug text-paper-dim">{s.line}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const DIAL = { from: 87.5, to: 108 };
const dialAt = (freq: string) => ((Number(freq) - DIAL.from) / (DIAL.to - DIAL.from)) * 100;

export function NarratorDial({ value, onChange }: { value: VoiceChoice; onChange: (v: VoiceChoice) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const station = NARRATORS.find((n) => n.id === value);
  const needle = station ? dialAt(station.freq) : 50;

  useEffect(() => {
    audio.current?.pause();
    setPlaying(false);
  }, [value]);

  function hear() {
    if (!station) return;
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    const el = new Audio(`/voices/${station.id}.mp3`);
    audio.current = el;
    el.onended = () => setPlaying(false);
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  return (
    <fieldset>
      <legend>
        <FormLabel>The narrator</FormLabel>
      </legend>
      <div className="mt-2 rounded-[3px] border-2 border-paper-ink bg-[linear-gradient(#20180e,#140f08)] p-3 text-cream shadow-[inset_0_2px_10px_rgb(0_0_0/0.6)]">
        {/* The dial window: FM scale, backlit, with a red needle on the chosen station. */}
        <div className="relative h-11 overflow-hidden rounded-[2px] bg-[radial-gradient(ellipse_at_center,#3a2a10,#1a1209)] ring-1 ring-black/60">
          <div
            aria-hidden
            className="absolute inset-x-2 top-1.5 h-3"
            style={{ backgroundImage: "repeating-linear-gradient(to right, rgb(255 210 140 / 0.55) 0 1px, transparent 1px 10px)" }}
          />
          <div aria-hidden className="absolute inset-x-2 bottom-1 flex justify-between font-mono text-[10px] font-bold text-[#ffd59a]/80">
            {[88, 92, 96, 100, 104, 108].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          <span
            aria-hidden
            className="absolute top-0 h-full w-[2px] bg-[#ff4b36] shadow-[0_0_8px_#ff4b36] transition-[left] duration-500 ease-out"
            style={{ left: `calc(0.5rem + (100% - 1rem) * ${needle / 100})` }}
          />
        </div>
        <div className="mt-2.5 flex min-h-12 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[1.65rem] leading-none tracking-wide text-amber">
              {station ? `${station.freq}  ${station.name.toUpperCase()}` : "AUTO"}
            </p>
            <p className="mt-1 truncate text-[13px] text-cream-dim">{station ? station.note : "We pick a voice that suits your app"}</p>
          </div>
          {station && (
            <button
              type="button"
              onClick={hear}
              className="shrink-0 rounded-sm border border-amber/50 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-amber transition hover:bg-amber/10"
            >
              {playing ? "Stop" : "Hear it"}
            </button>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Narrator">
          {[{ id: "auto" as const, name: "Auto" }, ...NARRATORS].map((n) => {
            const on = n.id === value;
            return (
              <button
                key={n.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(n.id)}
                className={`rounded-[2px] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                  on ? "bg-amber text-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.3)]" : "bg-white/[0.07] text-cream-dim hover:bg-white/[0.14] hover:text-cream"
                }`}
              >
                {n.name}
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function CaptionSample({ id }: { id: CaptionStyle }) {
  if (id === "off") return <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">SRT only</span>;
  if (id === "bold") {
    return (
      <span className="font-display text-[1.35rem] leading-none text-white [text-shadow:0_2px_0_rgb(0_0_0/0.6)]">
        GO <span className="text-amber">LIVE</span>
      </span>
    );
  }
  if (id === "boxed") return <span className="rounded-[3px] bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">Your app, tonight</span>;
  return (
    <span className="text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
      Your app, <span className="text-amber">tonight</span>
    </span>
  );
}

export function CaptionPicker({ value, onChange }: { value: CaptionStyle; onChange: (v: CaptionStyle) => void }) {
  return (
    <fieldset>
      <legend>
        <FormLabel>Captions</FormLabel>
      </legend>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {CAPTIONS.map((c) => {
          const on = c.id === value;
          return (
            <label key={c.id} className="group cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ticket" title={c.line}>
              <input type="radio" name="captions" value={c.id} checked={on} onChange={() => onChange(c.id)} className="sr-only" />
              <span
                className={`flex aspect-video items-end justify-center border-2 bg-[linear-gradient(160deg,#2b3042,#11131b)] pb-[10%] transition ${
                  on ? "border-ticket" : "border-paper-ink/20 group-hover:border-paper-ink/50"
                }`}
              >
                <CaptionSample id={c.id} />
              </span>
              <span className={`mt-1 block text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${on ? "text-ticket" : "text-paper-dim"}`}>
                {c.name}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
