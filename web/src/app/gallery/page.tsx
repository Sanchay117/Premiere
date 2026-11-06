import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/chrome";
import { NightSky } from "@/components/drivein/NightSky";
import { EmptyLobby, LobbyCard } from "@/components/sections/Gallery";
import type { GalleryEntry } from "@/lib/types";
import { workerJson } from "@/lib/worker";

export const metadata: Metadata = {
  title: "Gallery: trailers made by Premiere",
  description: "Launch trailers Premiere made for other apps, shown with their makers' permission.",
};

export default async function GalleryPage() {
  const gallery = await workerJson<{ trailers: GalleryEntry[] }>("/gallery");
  const entries = gallery?.trailers ?? [];
  return (
    <>
      <Nav />
      <main className="relative isolate min-h-screen overflow-hidden pb-24 pt-32">
        <NightSky />
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <Link href="/" className="font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-cream-dim hover:text-amber">
            Back to the front gate
          </Link>
          <h1 className="mt-6 font-display text-[clamp(3.4rem,8vw,7rem)] leading-[0.9] tracking-[0.01em]">THE LOBBY</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-cream-dim">
            Every trailer here was made by Premiere from nothing but a link, and is shown with its maker&apos;s permission.
          </p>
          <div className="mt-14">
            {entries.length === 0 ? (
              <EmptyLobby />
            ) : (
              <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry, i) => (
                  <LobbyCard key={entry.id} entry={entry} i={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
