import type { Metadata, Viewport } from "next";
import { Courier_Prime, League_Gothic, Libre_Franklin, Permanent_Marker, Yellowtail } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { IntroProvider } from "@/components/intro";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const league = League_Gothic({ subsets: ["latin"], variable: "--font-league", display: "swap" });
const yellowtail = Yellowtail({ subsets: ["latin"], weight: "400", variable: "--font-yellowtail", display: "swap" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker-hand", display: "swap" });

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
  const fonts = [league, yellowtail, franklin, courier, marker].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts} suppressHydrationWarning>
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
