"use client";

// The film-leader countdown (3, 2, 1, iris out) that opens the site on a first visit, and a
// tiny context so the hero waits for it before animating in.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const IntroContext = createContext<{ ready: boolean; finish: () => void }>({ ready: true, finish: () => {} });

export function IntroProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (document.documentElement.dataset.leader !== "play") setReady(true);
  }, []);
  const finish = useCallback(() => {
    const html = document.documentElement;
    if (html.dataset.leader === "play") html.dataset.leader = "done";
    try {
      sessionStorage.setItem("premiere-leader", "1");
    } catch {
      // storage can be blocked; the intro then simply plays again next visit
    }
    setReady(true);
  }, []);
  return <IntroContext.Provider value={{ ready, finish }}>{children}</IntroContext.Provider>;
}

export function useIntroReady(): boolean {
  return useContext(IntroContext).ready;
}

export function Countdown() {
  const { finish } = useContext(IntroContext);
  const [n, setN] = useState(3);
  const [iris, setIris] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.leader !== "play") return;
    const timers = [
      setTimeout(() => setN(2), 330),
      setTimeout(() => setN(1), 660),
      setTimeout(() => setIris(true), 990),
      setTimeout(finish, 1480),
    ];
    return () => timers.forEach(clearTimeout);
  }, [finish]);

  return (
    <div
      className="leader fixed inset-0 z-[80] cursor-pointer items-center justify-center bg-ink"
      onClick={finish}
      style={{
        clipPath: iris ? "circle(0% at 50% 50%)" : "circle(150% at 50% 50%)",
        transition: "clip-path 480ms cubic-bezier(0.7, 0, 0.3, 1)",
      }}
      aria-hidden
    >
      <div className="relative aspect-square w-[min(62vw,62vh)]">
        <div className="absolute inset-0 rounded-full border border-cream/25" />
        <div className="absolute inset-[9%] rounded-full border border-cream/15" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-cream/20" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-cream/20" />
        <div
          className="leader-sweep absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, rgb(255 181 71 / 0.28), transparent 70deg)" }}
        />
        <span
          key={n}
          className="absolute inset-0 flex items-center justify-center font-serif text-[min(34vw,34vh)] leading-none text-cream"
        >
          {n}
        </span>
      </div>
      <span className="eyebrow absolute bottom-8">Click to skip</span>
    </div>
  );
}
