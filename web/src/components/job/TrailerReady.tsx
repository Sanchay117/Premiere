"use client";

// The finished trailer on a lit drive-in screen, with the four take-home files.

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { JobView } from "@/lib/types";

const TICKET =
  "ticket group flex items-center gap-3 rounded-xl border border-line-strong bg-ink-2/80 px-4 py-2.5 text-left transition hover:border-amber/70";

function TicketText({ label, note }: { label: string; note: string }) {
  return (
    <span>
      <span className="block font-display text-2xl leading-none tracking-[0.05em] text-cream group-hover:text-amber">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream-faint">{note}</span>
    </span>
  );
}

/** Copies through a hidden text field, for browsers that refuse the clipboard API (some in-app
 *  browsers and embedded views deny clipboard-write). */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Post the screening room on X, or copy its link for anywhere else (on a phone, the share sheet).
 *  The link unfurls with the trailer's poster (app/jobs/[id]/layout.tsx). */
function ShareTickets({ appName }: { appName: string }) {
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    setUrl(window.location.href.split("#")[0]!);
    setPhone(typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const text = `The launch trailer for ${appName}, made by Premiere from nothing but a link.`;
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  async function copy() {
    if (phone) {
      // Closing the sheet without sharing rejects; nothing to report then.
      await navigator.share({ title: `${appName}: the launch trailer`, text, url }).catch(() => {});
      return;
    }
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      ok = legacyCopy(url);
    }
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2400);
  }

  const label = phone ? "Share" : state === "copied" ? "Link copied" : state === "failed" ? "Could not copy" : "Copy link";
  const note = phone ? "Messages, Discord, anywhere" : state === "failed" ? "Copy it from the address bar" : "For Discord, Slack, anywhere";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <a href={intent} target="_blank" rel="noopener noreferrer" className={TICKET}>
        <svg viewBox="0 0 24 24" className="size-4 text-amber" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <TicketText label="Post on X" note="With the poster attached" />
      </a>
      <button type="button" onClick={copy} className={TICKET}>
        <svg viewBox="0 0 24 24" className="size-4 text-amber" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <TicketText label={label} note={note} />
      </button>
    </div>
  );
}

const DOWNLOADS = [
  { key: "video", label: "Trailer", note: "MP4, 1920 × 1080" },
  { key: "thumb1920", label: "Poster", note: "PNG, 1920 × 1080" },
  { key: "thumb1280", label: "Lobby card", note: "PNG, 1280 × 720" },
  { key: "captions", label: "Subtitles", note: "SRT, word-timed" },
] as const;

export function TrailerReady({ job }: { job: JobView }) {
  const trailer = job.result!.trailer!;
  const file = (name: string, download = false) => `/api/jobs/${job.id}/files/${name}${download ? "?download=1" : ""}`;
  const names: Record<(typeof DOWNLOADS)[number]["key"], string | undefined> = {
    video: trailer.video,
    thumb1920: trailer.thumbnails[0],
    thumb1280: trailer.thumbnails[1],
    captions: trailer.captions,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="mt-14"
    >
      <p className="eyebrow flex items-center gap-2">
        <span className="rec-dot size-1.5 rounded-full bg-amber" />
        Now showing
      </p>
      <div className="relative mt-6">
        <div aria-hidden className="flicker pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber/[0.08] blur-3xl" />
        <div className="bg-[#16130e] p-[0.9%] shadow-[0_0_70px_rgb(255_214_150/0.2),0_0_220px_rgb(255_181_71/0.12)]">
          <video
            controls
            playsInline
            preload="metadata"
            poster={names.thumb1920 ? file(names.thumb1920) : undefined}
            src={file(trailer.video)}
            className="block aspect-video w-full bg-black"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {DOWNLOADS.map((d) => {
          const name = names[d.key];
          if (!name) return null;
          return (
            <a key={d.key} href={file(name, true)} className={TICKET}>
              <svg viewBox="0 0 24 24" className="size-4 text-amber" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <TicketText label={d.label} note={d.note} />
            </a>
          );
        })}
      </div>
      <ShareTickets appName={job.result!.plan.appName} />
      <p className="mt-4 font-mono text-xs text-cream-faint">
        {Math.round(trailer.duration)} s · {trailer.shotsFilmed} shots filmed
        {trailer.shotsSkipped.length > 0 && ` · ${trailer.shotsSkipped.length} skipped (never faked)`}
      </p>
    </motion.section>
  );
}
