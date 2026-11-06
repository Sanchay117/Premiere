import { NightSky } from "@/components/drivein/NightSky";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden py-32 md:py-44">
      <NightSky />
      <div
        aria-hidden
        className="flicker pointer-events-none absolute bottom-0 left-1/2 -z-10 h-full w-[120%] -translate-x-1/2"
        style={{
          background:
            "conic-gradient(from -20deg at 50% 100%, transparent 0deg, rgb(255 181 71 / 0.08) 12deg, rgb(255 214 150 / 0.12) 20deg, rgb(255 181 71 / 0.08) 28deg, transparent 40deg)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
        <Reveal>
          <p className="eyebrow">Last show of the night</p>
          <h2 className="mt-6 font-serif text-[clamp(3rem,8.5vw,8rem)] leading-[0.92] tracking-[-0.02em]">
            Your app deserves
            <br />a <em className="sweep italic">premiere.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-cream-dim">The screen is warm and the projector is running. Bring your link.</p>
          <a
            href="#make"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-amber px-7 py-4 font-medium text-ink transition hover:bg-[#ffc670]"
          >
            <span className="rec-dot size-2 rounded-full bg-rec" />
            Make my trailer
          </a>
        </Reveal>
      </div>
    </section>
  );
}
