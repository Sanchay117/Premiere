"use client";

// The box office ticket: the app's link, then the cut, the narrator and the captions, printed like
// an order form on ticket stock. Until 16 Nov trailers are free; once payments are on, the same
// ticket takes USDC from the visitor's wallet over x402. Claude Opus writes every script.

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_OPTIONS, FREE_UNTIL_LABEL } from "@/lib/options";
import type { CaptionStyle, Pricing, TrailerLength, TrailerStyle, VoiceChoice } from "@/lib/types";
import { LetterboxClose } from "./Letterbox";
import { CaptionPicker, FormLabel, LengthPicker, NarratorDial, StylePicker } from "./pickers";

export function UrlForm({ url = "", onUrlChange: setUrl }: { url?: string; onUrlChange: (url: string) => void }) {
  const router = useRouter();
  const [style, setStyle] = useState<TrailerStyle>(DEFAULT_OPTIONS.style);
  const [length, setLength] = useState<TrailerLength>(DEFAULT_OPTIONS.length);
  const [voice, setVoice] = useState<VoiceChoice>(DEFAULT_OPTIONS.voice);
  const [captions, setCaptions] = useState<CaptionStyle>(DEFAULT_OPTIONS.captions);
  const [gallery, setGallery] = useState(true);
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [serial, setSerial] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "closing">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSerial(String(Math.floor(1000 + Math.random() * 9000)));
    fetch("/api/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Pricing | null) => p && setPricing(p))
      .catch(() => {});
  }, []);

  const paid = pricing !== null && !pricing.free;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Write your app's link on the ticket first.");
      return;
    }
    setState("sending");
    const order = { url, style, length, voice, captions, gallery, code: code.trim() || undefined };
    let id: string | undefined;
    try {
      if (paid && pricing) {
        const { payAndOrder } = await import("@/lib/checkout");
        id = (await payAndOrder(pricing, order)).id;
      } else {
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(order),
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string; needsCode?: boolean };
        if (data.needsCode) setNeedsCode(true);
        if (!response.ok || !data.id) throw new Error(data.error ?? "Could not start the trailer.");
        id = data.id;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the box office. Is the server running?");
      setState("idle");
      return;
    }
    setState("closing");
    setTimeout(() => router.push(`/jobs/${id}`), 620);
  }

  const showScheme = !/^https?:\/\//i.test(url.trim());

  return (
    <form id="make" onSubmit={submit} noValidate className="paper relative mt-7 scroll-mt-28 shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)]">
      <div aria-hidden className="perf-x absolute inset-x-0 -top-1" />
      <div className="flex items-center justify-between border-b-2 border-dashed border-paper-ink/25 px-5 pb-2.5 pt-4 sm:px-6">
        <span className="font-display text-[1.9rem] leading-none tracking-[0.06em] text-ticket">ADMIT ONE</span>
        <span className="font-mono text-[12px] font-bold tracking-[0.12em] text-ticket">
          SERIES 02 · Nº <span className="inline-block w-[4ch]">{serial}</span>
        </span>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <label htmlFor="url">
            <FormLabel>Your app&apos;s link</FormLabel>
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-0">
            <div className="flex flex-1 items-center border-2 border-paper-ink bg-[#fbf6ea] focus-within:border-ticket">
              {showScheme && <span className="hidden pl-3 font-mono text-paper-dim sm:inline">https://</span>}
              <input
                id="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="yourapp.xyz"
                autoComplete="url"
                inputMode="url"
                spellCheck={false}
                className={`w-full min-w-0 bg-transparent py-3 pr-3 font-mono text-[1.05rem] font-bold text-paper-ink outline-none placeholder:font-normal placeholder:text-paper-dim/70 ${showScheme ? "pl-3 sm:pl-0.5" : "pl-3"}`}
              />
            </div>
            <button
              type="submit"
              disabled={state !== "idle"}
              className="flex shrink-0 items-center justify-center gap-2.5 bg-ticket px-6 py-2.5 font-display text-[1.75rem] leading-none tracking-[0.06em] text-paper transition hover:bg-ticket-deep disabled:cursor-wait disabled:opacity-80"
            >
              <span className="rec-dot size-2 rounded-full bg-paper" />
              {state === "idle" ? (paid ? `PAY $${pricing?.priceUsd} · ROLL` : "ROLL CAMERA") : "ROLLING"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2.5 text-sm font-semibold text-ticket">
              {error}
            </p>
          )}
          {needsCode && (
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="code">
                <FormLabel>Access code</FormLabel>
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 border-b-2 border-paper-ink/40 bg-transparent py-1 font-mono text-sm font-bold tracking-[0.12em] text-paper-ink outline-none focus:border-ticket"
              />
            </div>
          )}
        </div>

        <StylePicker value={style} onChange={setStyle} />
        <LengthPicker value={length} onChange={setLength} />
        <NarratorDial value={voice} onChange={setVoice} />
        <CaptionPicker value={captions} onChange={setCaptions} />

        <div className="border-t-2 border-dashed border-paper-ink/25 pt-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-paper-ink">
            <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} className="size-4 accent-[#c8372d]" />
            Show it in the gallery
          </label>
        </div>
      </div>

      <div className="border-t-2 border-dashed border-paper-ink/25 px-5 py-3 font-mono text-[12px] font-bold text-paper-dim sm:px-6">
        {paid && pricing
          ? `$${pricing.priceUsd} in USDC on ${pricing.networkName}, paid from your wallet. Two or three minutes a trailer.`
          : `Free until ${FREE_UNTIL_LABEL}, then a few USDC. Two or three minutes a trailer.`}
      </div>
      <LetterboxClose active={state === "closing"} />
    </form>
  );
}
