// Thumbnail still: the app itself, in the app's own color, laid out like the cut it advertises.
// Hype: the poster gothic title beside the app in a tilted browser window, over a blur of the same
// frame so the whole poster takes on the app's palette. Walkthrough: the app full frame and
// unobscured, with the serif title along the bottom. The frame and the accent color are picked
// per job (render/thumbnail.ts), so no two apps get the same poster.

import type React from "react";
import { AbsoluteFill, Img } from "remotion";
import { COLORS, gothic, mono, sans, serif } from "./fonts";
import { BAR, WindowBar } from "./Trailer";
import type { ThumbnailProps } from "./types";

const W = 1920;
const H = 1080;

/** Display size that fits a name into a column. perChar is the face's average width in em. */
function fit(name: string, max: number, min: number, width: number, perChar: number): number {
  return Math.round(Math.max(min, Math.min(max, width / Math.max(1, name.length * perChar))));
}

/** At most `lines` lines; anything longer ends in an ellipsis instead of crowding the poster. */
const clamp = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

function MadeWith() {
  return (
    <div
      style={{
        position: "absolute",
        right: 64,
        bottom: 52,
        fontFamily: mono,
        fontSize: 22,
        letterSpacing: "0.28em",
        color: "rgba(243,234,216,0.88)",
        background: "rgba(7,8,12,0.72)",
        padding: "11px 20px",
        borderRadius: 999,
      }}
    >
      MADE WITH PREMIERE
    </div>
  );
}

function HypePoster({ src, app, accent }: { src: string; app: ThumbnailProps["app"]; accent: string }) {
  const name = app.name.toUpperCase();
  // The window is the trailer's own browser window at 60%, centered on this point.
  const cx = 1282;
  const cy = 548;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, overflow: "hidden" }}>
      {src && (
        <Img
          src={src}
          style={{ position: "absolute", left: -220, top: -130, width: W + 440, height: H + 260, objectFit: "cover", filter: "blur(70px) saturate(1.7) brightness(0.5)" }}
        />
      )}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 50% 62% at ${(cx / W) * 100}% 50%, ${accent}47 0%, transparent 72%)` }} />
      <AbsoluteFill
        style={{ background: "linear-gradient(90deg, rgba(7,8,12,0.92) 0%, rgba(7,8,12,0.74) 30%, rgba(7,8,12,0.2) 56%, rgba(7,8,12,0) 76%)" }}
      />
      <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: `${cx}px ${cy}px` }}>
        <div
          style={{
            position: "absolute",
            left: cx - W / 2,
            top: cy - (H + BAR) / 2,
            width: W,
            height: H + BAR,
            borderRadius: 30,
            overflow: "hidden",
            background: "#0d0f15",
            boxShadow: `0 150px 300px -60px rgba(0,0,0,0.95), 0 0 0 3px rgba(255,255,255,0.08), 0 0 280px -30px ${accent}99`,
            transform: "rotateY(-13deg) rotateX(5deg) rotateZ(-1deg) scale(0.6)",
          }}
        >
          <WindowBar host={app.host} />
          {src && <Img src={src} style={{ width: W, height: H, display: "block" }} />}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 110 }}>
        <div style={{ width: 540 }}>
          <div style={{ width: 84, height: 8, background: accent, marginBottom: 34 }} />
          <div
            style={{
              fontFamily: gothic,
              fontSize: fit(name, 260, 110, 540, 0.36),
              lineHeight: 0.88,
              color: COLORS.cream,
              textShadow: "0 12px 50px rgba(0,0,0,0.55)",
              overflowWrap: "anywhere",
            }}
          >
            {name}
          </div>
          {app.tagline && (
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 46, lineHeight: 1.14, color: accent, marginTop: 30, ...clamp(3) }}>{app.tagline}</div>
          )}
        </div>
      </AbsoluteFill>
      <MadeWith />
    </AbsoluteFill>
  );
}

function WalkthroughPoster({ src, app, accent }: { src: string; app: ThumbnailProps["app"]; accent: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      {src && <Img src={src} style={{ width: W, height: H, objectFit: "cover" }} />}
      {/* The app stays sharp up top; under the title it softens and darkens, so the type never
          fights the interface behind it. */}
      <AbsoluteFill
        style={{
          backdropFilter: "blur(16px)",
          maskImage: "linear-gradient(180deg, transparent 42%, black 66%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 42%, black 66%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(7,8,12,0) 32%, rgba(7,8,12,0.66) 54%, rgba(7,8,12,0.9) 70%, rgba(7,8,12,0.96) 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(7,8,12,0.5) 0%, rgba(7,8,12,0) 58%)" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 110px 98px" }}>
        <div style={{ width: 84, height: 7, background: accent, marginBottom: 28 }} />
        <div style={{ fontFamily: serif, fontSize: fit(app.name, 170, 104, 1300, 0.46), lineHeight: 0.95, color: COLORS.cream, maxWidth: 1300, ...clamp(2) }}>
          {app.name}
        </div>
        {app.tagline && (
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 58, lineHeight: 1.1, color: accent, marginTop: 14, maxWidth: 1250, ...clamp(2) }}>
            {app.tagline}
          </div>
        )}
      </AbsoluteFill>
      <MadeWith />
    </AbsoluteFill>
  );
}

export const Thumbnail: React.FC<ThumbnailProps> = ({ base, app, frame, style = "walkthrough", accent = COLORS.amber }) => {
  const src = frame ? `${base}/frames/${frame}` : "";
  return style === "hype" ? <HypePoster src={src} app={app} accent={accent} /> : <WalkthroughPoster src={src} app={app} accent={accent} />;
};
