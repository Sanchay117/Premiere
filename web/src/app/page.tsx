import { Nav } from "@/components/chrome";
import { Hero } from "@/components/hero/Hero";
import { Countdown } from "@/components/intro";
import { Access } from "@/components/sections/Access";
import { Credits } from "@/components/sections/Credits";
import { FinalCta } from "@/components/sections/FinalCta";
import { Intermission } from "@/components/sections/Intermission";
import { Marquee } from "@/components/sections/Marquee";
import { Program } from "@/components/sections/Program";
import { Reels } from "@/components/sections/Reels";

export default function Home() {
  return (
    <>
      <Countdown />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Program />
        <Intermission />
        <Reels />
        <Access />
        <FinalCta />
      </main>
      <Credits />
    </>
  );
}
