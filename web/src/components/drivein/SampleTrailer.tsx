"use client";

// The big screen's feature: a real trailer Premiere made of Fundable, Vibestarter's fundability
// scorer, from nothing but its link (job 2f64e7e4, re-encoded to 720p for the page). It plays muted
// and on a loop, like a drive-in screen seen from the road; the sound button starts it over with
// the speaker on. With reduced motion it waits on its poster until asked.

import { useEffect, useRef, useState } from "react";

const SRC = "/sample/fundable-trailer.mp4";
const POSTER = "/sample/fundable-poster.jpg";

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
      {on ? (
        <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" strokeLinecap="round" />
      ) : (
        <path d="M17 9l5 6M22 9l-5 6" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function SampleTrailer() {
  const ref = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.muted = true;
    // Browsers that refuse even muted autoplay leave the poster up and the sound button to start it.
    video.play().catch(() => {});
  }, []);

  function toggleSound() {
    const video = ref.current;
    if (!video) return;
    if (sound) {
      video.muted = true;
      setSound(false);
      return;
    }
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(() => {});
    setSound(true);
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <video
        ref={ref}
        src={SRC}
        poster={POSTER}
        loop
        muted
        playsInline
        preload="metadata"
        aria-label="A launch trailer Premiere made of Fundable from its link alone"
        className="block h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={toggleSound}
        className="absolute right-[2.5%] top-[4%] flex items-center gap-1.5 rounded-full border border-cream/25 bg-ink/75 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cream backdrop-blur-sm transition hover:border-amber hover:text-amber"
      >
        <SpeakerIcon on={sound} />
        {sound ? "Sound off" : "Sound on"}
      </button>
    </div>
  );
}
