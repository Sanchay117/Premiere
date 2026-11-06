import { Nav } from "@/components/chrome";
import { Hero } from "@/components/hero/Hero";
import { Countdown } from "@/components/intro";
import { Access } from "@/components/sections/Access";
import { Credits } from "@/components/sections/Credits";
import { FinalCta } from "@/components/sections/FinalCta";
import { Gallery } from "@/components/sections/Gallery";
import { Intermission } from "@/components/sections/Intermission";
import { Program } from "@/components/sections/Program";
import { Reels } from "@/components/sections/Reels";
import type { GalleryEntry } from "@/lib/types";
import { workerJson } from "@/lib/worker";

export default async function Home() {
  const gallery = await workerJson<{ trailers: GalleryEntry[] }>("/gallery");
  return (
    <>
      <Countdown />
      <Nav />
      <main>
        <Hero />
        <Program />
        <Gallery entries={gallery?.trailers ?? []} />
        <Intermission />
        <Reels />
        <Access />
        <FinalCta />
      </main>
      <Credits />
    </>
  );
}
