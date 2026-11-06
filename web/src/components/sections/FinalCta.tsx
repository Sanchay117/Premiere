import { NightSky } from "@/components/drivein/NightSky";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden py-28 md:py-40">
      <NightSky />
      <div
        aria-hidden
        className="flicker pointer-events-none absolute bottom-0 left-1/2 -z-10 h-full w-[120%] -translate-x-1/2"
        style={{
          background:
            "conic-gradient(from -20deg at 50% 100%, transparent 0deg, rgb(255 214 150 / 0.07) 12deg, rgb(255 236 200 / 0.11) 20deg, rgb(255 214 150 / 0.07) 28deg, transparent 40deg)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
        <Reveal>
          <p className="neon font-script text-[clamp(2.6rem,6vw,4.4rem)] leading-none">Last show</p>
          <h2 className="mt-5 font-display text-[clamp(3.4rem,9vw,8.2rem)] leading-[0.9] tracking-[0.01em]">
            ONE MORE FEATURE
            <br />
            BEFORE SUNRISE?
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-cream-dim">The projector is still warm. Bring your link.</p>
          <a
            href="#make"
            className="mt-10 inline-flex items-center gap-3 bg-ticket px-8 py-3.5 font-display text-[1.9rem] leading-none tracking-[0.06em] text-paper transition hover:bg-ticket-deep"
          >
            <span className="rec-dot size-2 rounded-full bg-paper" />
            ROLL CAMERA
          </a>
        </Reveal>
      </div>
    </section>
  );
}
