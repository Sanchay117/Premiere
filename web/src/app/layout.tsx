import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { IntroProvider } from "@/components/intro";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const marquee = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-marquee", display: "swap" });

export const metadata: Metadata = {
  title: "Premiere: paste a URL, get a launch trailer",
  description:
    "An AI agent opens your app, clicks through its main flow, writes a script and records real footage, then returns a 45 second narrated trailer with captions, music and thumbnails.",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
};

// Runs before first paint: play the film-leader intro once per session, on the home page only,
// and never when the visitor prefers reduced motion.
const leaderScript = `(function(){try{var d=document.documentElement;var seen=sessionStorage.getItem("premiere-leader");var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(!seen&&!reduce&&location.pathname==="/"){d.dataset.leader="play";}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} ${marquee.variable}`} suppressHydrationWarning>
      <body className="min-h-screen overflow-x-hidden">
        <Script id="premiere-leader" strategy="beforeInteractive">
          {leaderScript}
        </Script>
        <IntroProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </IntroProvider>
      </body>
    </html>
  );
}
