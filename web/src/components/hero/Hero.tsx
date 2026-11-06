"use client";

// The hero is a drive-in at night: the headline in the sky, the box office on the left, the big
// screen playing the teaser on the right, a marquee spelling the app being typed, and the lot.

import { motion } from "motion/react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BigScreen } from "@/components/drivein/BigScreen";
import { Lot } from "@/components/drivein/Lot";
import { MarqueeSign } from "@/components/drivein/MarqueeSign";
import { NightSky } from "@/components/drivein/NightSky";
import { useIntroReady } from "@/components/intro";
import { UrlForm } from "./UrlForm";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Letters rise into place one after another. */
function SplitLine({ text, play, delay = 0, inline = false }: { text: string; play: boolean; delay?: number; inline?: boolean }) {
  return (
    <span className={inline ? "inline-block" : "block"} aria-label={text} role="text">
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "115%" }}
            animate={play ? { y: "0%" } : { y: "115%" }}
            transition={{ duration: 0.95, ease: EASE, delay: delay + i * 0.03 }}
          >
            {ch === " " ? <>&nbsp;</> : ch}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function FadeIn({ play, delay = 0, y = 18, children, className }: { play: boolean; delay?: number; y?: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const ready = useIntroReady();
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLElement>(null);

  // Gentle mouse parallax: far stars barely move, the cars move most.
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--px", (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--py", (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  };

  return (
    <section ref={ref} onPointerMove={onPointerMove} className="relative isolate overflow-hidden pt-28 md:pt-32">
      <NightSky />

      <div className="mx-auto grid max-w-7xl items-start gap-14 px-5 md:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
        <div className="relative z-10">
          <FadeIn play={ready}>
            <p className="eyebrow flex items-center gap-3">
              <span className="rec-dot size-1.5 rounded-full bg-amber" />
              Open all night · launch trailers, made by an agent
            </p>
          </FadeIn>
          <h1 className="mt-6 font-serif text-[clamp(3.1rem,7.2vw,7.1rem)] leading-[0.92] tracking-[-0.02em]">
            <SplitLine text="Paste a URL." play={ready} delay={0.1} />
            <span className="block">
              <SplitLine text="Get a " play={ready} delay={0.5} inline />
              <motion.em
                className="sweep inline-block pr-[0.08em] italic"
                initial={{ clipPath: "inset(0 100% 0 0)" }}
                animate={ready ? { clipPath: "inset(0 0% 0 0)" } : { clipPath: "inset(0 100% 0 0)" }}
                transition={{ duration: 1.15, ease: [0.65, 0, 0.35, 1], delay: 0.78 }}
              >
                trailer.
              </motion.em>
            </span>
          </h1>
          <FadeIn play={ready} delay={0.95}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream-dim">
              Leave your link at the box office. An agent drives in, clicks through your app, writes the script and films
              real footage. A few minutes later your 45 second trailer is up on the big screen.
            </p>
            <UrlForm url={url} onUrlChange={setUrl} />
          </FadeIn>
        </div>

        <FadeIn play={ready} delay={1.1} y={40} className="relative lg:pt-16">
          <BigScreen />
          <div className="relative z-10 -mt-[clamp(40px,7vw,96px)] flex justify-start pl-[2%]">
            <MarqueeSign url={url} />
          </div>
        </FadeIn>
      </div>

      <div className="-mt-[clamp(70px,10vw,150px)]">
        <Lot />
      </div>
    </section>
  );
}
