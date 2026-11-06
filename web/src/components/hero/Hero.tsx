"use client";

// The hero is a drive-in at night: the marquee carries the headline and spells the app being
// typed, the box office ticket takes the order, the big screen plays a real trailer, and the lot of
// parked cars sits under the projector beam. Entrances are CSS, so the page reads without JS.

import { useRef, useState, type PointerEvent } from "react";
import { BigScreen } from "@/components/drivein/BigScreen";
import { Lot } from "@/components/drivein/Lot";
import { MarqueeSign } from "@/components/drivein/MarqueeSign";
import { NightSky } from "@/components/drivein/NightSky";
import { UrlForm } from "./UrlForm";

export function Hero() {
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
    <section ref={ref} onPointerMove={onPointerMove} className="relative isolate overflow-hidden pt-24 md:pt-28">
      <NightSky moon={false} />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="rise">
          <MarqueeSign url={url} />
        </div>

        <div className="mt-6 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14">
          <div className="rise relative z-10" style={{ ["--delay" as string]: "0.15s" }}>
            <p className="max-w-xl text-[1.12rem] leading-relaxed text-cream-dim">
              Leave your link at the box office. An agent drives in, clicks through your app, writes the script and films real
              footage. A couple of minutes later your trailer is up on the big screen, narrated, captioned and scored.
            </p>
            <UrlForm url={url} onUrlChange={setUrl} />
          </div>

          <div className="rise lg:sticky lg:top-24 lg:pt-4" style={{ ["--delay" as string]: "0.3s" }}>
            <BigScreen />
          </div>
        </div>
      </div>

      <div className="-mt-[clamp(40px,6vw,90px)]">
        <Lot />
      </div>
    </section>
  );
}
