// Past trailers, hung like lobby cards: the poster frame of each trailer on card stock with a
// typed caption. Only approved trailers whose makers opted in reach this wall. Server component.

import Link from "next/link";
import type { GalleryEntry } from "@/lib/types";

function seconds(s: number): string {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function LobbyCard({ entry, i }: { entry: GalleryEntry; i: number }) {
  return (
    <Link
      href={`/jobs/${entry.id}`}
      className="paper group block p-2.5 pb-3 shadow-[0_24px_50px_-24px_rgb(0_0_0/0.95)] transition duration-300 hover:-translate-y-1"
      style={{ rotate: `${(i % 3) - 1}deg` }}
    >
      <div className="relative aspect-video overflow-hidden bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/jobs/${entry.id}/files/thumbnail-1280.png`}
          alt={`${entry.appName} trailer poster`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 px-1">
        <p className="truncate font-display text-[1.6rem] leading-none tracking-[0.04em]">{entry.appName.toUpperCase()}</p>
        <p className="shrink-0 font-mono text-[12px] font-bold text-ticket">{seconds(entry.duration)}</p>
      </div>
      <p className="mt-1 truncate px-1 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-paper-dim">
        {entry.host} · {entry.style}
        {entry.narrator ? ` · ${entry.narrator}` : ""}
      </p>
    </Link>
  );
}

export function EmptyLobby() {
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:items-center">
      <div className="paper p-2.5 pb-3 opacity-90 shadow-[0_24px_50px_-24px_rgb(0_0_0/0.95)]" style={{ rotate: "-1deg" }}>
        <div className="flex aspect-video items-center justify-center border-2 border-dashed border-paper-ink/30 bg-[#e8dcbd]">
          <span className="font-display text-[2rem] tracking-[0.05em] text-paper-ink/45">YOUR APP HERE</span>
        </div>
        <p className="mt-2.5 px-1 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-paper-dim">Coming soon</p>
      </div>
      <p className="max-w-md text-lg leading-relaxed text-cream-dim">
        The lobby is bare tonight. Make a trailer, keep &ldquo;Show it in the gallery&rdquo; ticked, and it will hang right here.
      </p>
    </div>
  );
}

export function Gallery({ entries }: { entries: GalleryEntry[] }) {
  const shown = entries.slice(0, 6);
  return (
    <section id="gallery" className="relative scroll-mt-24 py-24 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-[clamp(3.2rem,7vw,6.2rem)] leading-[0.92] tracking-[0.01em]">
              PREVIOUSLY ON
              <br />
              THE BIG SCREEN
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-dim">Trailers Premiere made for other apps, hung here by the people who ordered them.</p>
          </div>
          {entries.length > shown.length && (
            <Link href="/gallery" className="font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-amber hover:underline">
              The whole lobby, {entries.length} trailers
            </Link>
          )}
        </div>
        <div className="mt-12">
          {shown.length === 0 ? (
            <EmptyLobby />
          ) : (
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((entry, i) => (
                <LobbyCard key={entry.id} entry={entry} i={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
