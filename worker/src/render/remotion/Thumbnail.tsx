// Thumbnail still: a frame of the footage behind the title, matching the cut: the serif title of
// a walkthrough, or the poster gothic of a hype trailer.

import type React from "react";
import { AbsoluteFill, Img } from "remotion";
import { COLORS, gothic, mono, sans, serif } from "./fonts";
import type { ThumbnailProps } from "./types";

export const Thumbnail: React.FC<ThumbnailProps> = ({ base, app, frame, style = "walkthrough" }) => {
  const hype = style === "hype";
  const name = hype ? app.name.toUpperCase() : app.name;
  const perChar = hype ? 0.36 : 0.46;
  const nameSize = Math.round(Math.max(110, Math.min(hype ? 260 : 210, 1150 / Math.max(1, name.length * perChar))));
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      {frame && <Img src={`${base}/frames/${frame}`} style={{ width: 1920, height: 1080, objectFit: "cover" }} />}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(7,8,12,0.97) 0%, rgba(7,8,12,0.88) 36%, rgba(7,8,12,0.35) 72%, rgba(7,8,12,0.15) 100%)",
        }}
      />
      <AbsoluteFill style={{ padding: "0 130px", justifyContent: "center" }}>
        <div style={{ fontFamily: mono, fontSize: 28, letterSpacing: "0.38em", color: COLORS.amber }}>NOW SHOWING</div>
        <div style={{ fontFamily: hype ? gothic : serif, fontSize: nameSize, lineHeight: hype ? 0.9 : 0.95, color: COLORS.cream, marginTop: 24, maxWidth: 1150 }}>
          {name}
        </div>
        {app.tagline &&
          (hype ? (
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 58, lineHeight: 1.15, color: COLORS.amber, marginTop: 28, maxWidth: 1050 }}>
              {app.tagline}
            </div>
          ) : (
            <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 64, lineHeight: 1.1, color: COLORS.amber, marginTop: 26, maxWidth: 1050 }}>
              {app.tagline}
            </div>
          ))}
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 64 }}>
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: "50%",
              background: COLORS.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 20px 60px -10px rgba(255,181,71,0.6)",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 46, height: 46, marginLeft: 8 }}>
              <path d="M6 4l14 8-14 8z" fill={COLORS.ink} />
            </svg>
          </div>
          <div style={{ fontFamily: mono, fontSize: 30, letterSpacing: "0.22em", color: COLORS.cream }}>WATCH THE TRAILER</div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 70,
          bottom: 56,
          fontFamily: mono,
          fontSize: 24,
          letterSpacing: "0.3em",
          color: COLORS.cream,
          background: "rgba(7,8,12,0.78)",
          padding: "12px 22px",
          borderRadius: 999,
        }}
      >
        MADE WITH PREMIERE
      </div>
    </AbsoluteFill>
  );
};
