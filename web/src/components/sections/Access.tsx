// The box office: prices on a felt letter board by the ticket window, and, beside it, the typed
// card for AI agents that order over x402. Server component.

import { FREE_UNTIL_LABEL } from "@/lib/options";
import { Reveal } from "./Reveal";

function BoardRow({ left, right, note }: { left: string; right: string; note?: string }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline gap-3">
        <span>{left}</span>
        <span aria-hidden className="flex-1 translate-y-[-0.28em] border-b-[3px] border-dotted border-white/25" />
        <span className="text-[#ffe2a8]">{right}</span>
      </div>
      {note && <p className="mt-0.5 text-[0.55em] tracking-[0.14em] text-white/55">{note}</p>}
    </div>
  );
}

export function Access() {
  return (
    <section id="box-office" className="relative scroll-mt-24 border-t border-line py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <h2 className="font-display text-[clamp(3.2rem,7vw,6.2rem)] leading-[0.92] tracking-[0.01em]">BOX OFFICE</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-dim">
            No account, no subscription. Free while Vibeathon 02 runs, then a few USDC a trailer.
          </p>
        </Reveal>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div className="rounded-[6px] border-[12px] border-[#2b1d10] bg-[#2b1d10] shadow-[0_40px_80px_-40px_rgb(0_0_0/0.95),inset_0_0_0_2px_#3d2a16]">
              <div className="letterboard px-6 py-7 font-display text-[clamp(1.55rem,3vw,2.35rem)] uppercase leading-[1.18] tracking-[0.07em] text-white/90 sm:px-9">
                <p className="mb-3 text-center text-[1.15em] tracking-[0.18em] text-[#ffe2a8]">ADMISSION</p>
                <BoardRow left="EVERYONE" right="FREE" note={`UNTIL VIBEATHON 02 ENDS, ${FREE_UNTIL_LABEL.toUpperCase()}`} />
                <BoardRow left="AFTER THAT" right="A FEW USDC" note="PER TRAILER, PAID ON BASE" />
                <BoardRow left="AI AGENTS" right="ONE X402 CALL" note="SAME PRICE, NO SIGN UP" />
                <p className="mt-4 text-center text-[0.55em] tracking-[0.16em] text-white/55">FAIR USE: A FEW FREE TRAILERS A DAY PER VISITOR</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div id="agents" className="paper scroll-mt-28 px-6 py-6 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] sm:px-8">
              <p className="font-display text-[2.1rem] leading-none tracking-[0.05em]">FOR AI AGENTS</p>
              <p className="mt-3 text-[15px] leading-relaxed text-paper-ink/85">
                One HTTP request orders a trailer. It is free during the Vibeathon; after that, the first answer is a 402 with x402
                payment requirements. Sign the USDC authorization and send the same request again with a PAYMENT-SIGNATURE header.
              </p>
              <pre className="mt-4 overflow-x-auto border-2 border-paper-ink/80 bg-[#fbf6ea] p-4 font-mono text-[13px] leading-relaxed text-paper-ink">
                {`POST /api/x402/trailers
{ "url": "https://yourapp.xyz",
  "style": "hype",
  "voice": "atlas",
  "captions": "karaoke" }

202 { "id": "...",
      "status": "/api/jobs/..." }`}
              </pre>
              <p className="mt-3 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-paper-dim">
                Poll the status until result.trailer is set. GET the same route for a description.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
