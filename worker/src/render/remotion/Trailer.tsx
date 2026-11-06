// The trailer composition: title card, one scene per filmed shot, end card, word-timed captions
// burned in, and the mastered soundtrack.

import type React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, mono, sans, serif } from "./fonts";
import type { AppInfo, CaptionWord, TrailerProps, TrailerSegment } from "./types";

const W = 1920;
const H = 1080;
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Latest recorded frame at or before recording time t. */
function pickFrame(frames: TrailerProps["frames"], t: number): string {
  let lo = 0;
  let hi = frames.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.t <= t) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return frames[best]?.file ?? "";
}

/** Display size that keeps long app names on one line. */
function titleSize(name: string, max: number, width: number): number {
  return Math.round(Math.max(max * 0.45, Math.min(max, width / Math.max(1, name.length * 0.46))));
}

const STARS = (() => {
  let s = 1913;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: 110 }, () => ({ x: rand() * 100, y: Math.pow(rand(), 1.3) * 80, r: 1 + rand() * 2.2, phase: rand() * 6.28 }));
})();

function NightBackdrop({ glow }: { glow: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 46%, ${glow} 0%, #0b0b12 52%, #040508 100%)` }}>
      {STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.r,
            height: star.r,
            borderRadius: "50%",
            background: "#eef1ff",
            opacity: 0.35 + 0.45 * Math.abs(Math.sin(frame / 22 + star.phase)),
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

function TitleCard({ app }: { app: AppInfo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const spacing = interpolate(t, [0, 1.7], [0.3, 0.01], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <NightBackdrop glow="#2a1d0c" />
      <div style={{ position: "relative", textAlign: "center", marginTop: -90 }}>
        <div style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.45em", color: "rgba(243,234,216,0.62)", opacity: interpolate(t, [0, 0.5], [0, 1], CLAMP) }}>
          NOW SHOWING
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: titleSize(app.name, 200, 1700),
            lineHeight: 1,
            color: COLORS.cream,
            letterSpacing: `${spacing}em`,
            marginTop: 28,
            opacity: interpolate(t, [0, 0.7], [0, 1], CLAMP),
          }}
        >
          {app.name}
        </div>
        {app.tagline && (
          <div
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: 58,
              color: COLORS.amber,
              marginTop: 26,
              opacity: interpolate(t, [0.7, 1.4], [0, 1], CLAMP),
            }}
          >
            {app.tagline}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function EndCard({ app }: { app: AppInfo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pop = interpolate(t, [0.1, 0.55], [0.86, 1], { ...CLAMP, easing: Easing.out(Easing.back(1.6)) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <NightBackdrop glow="#1f1709" />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: -110 }}>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 66,
            color: COLORS.ink,
            background: COLORS.amber,
            borderRadius: 999,
            padding: "24px 60px",
            transform: `scale(${pop})`,
            opacity: interpolate(t, [0.05, 0.35], [0, 1], CLAMP),
            boxShadow: "0 30px 90px -20px rgba(255,181,71,0.65)",
          }}
        >
          {app.cta}
        </div>
        <div style={{ fontFamily: mono, fontSize: 42, color: COLORS.cream, marginTop: 40, opacity: interpolate(t, [0.4, 0.8], [0, 1], CLAMP) }}>{app.host}</div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 22,
            letterSpacing: "0.38em",
            color: "rgba(243,234,216,0.5)",
            marginTop: 54,
            opacity: interpolate(t, [0.8, 1.2], [0, 1], CLAMP),
          }}
        >
          MADE WITH PREMIERE
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Pointer({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ position: "absolute", left: x, top: y, width: 46, height: 46, transform: `scale(${scale})`, transformOrigin: "top left", filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.55))" }}
    >
      <path d="M4 2l15 9.5-6.6 1.4L9.2 20z" fill="#ffffff" stroke="#111111" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

function ShotScene({ segment, frames, base }: { segment: TrailerSegment; frames: TrailerProps["frames"]; base: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const duration = segment.frames / fps;
  const box = segment.box ?? null;
  const actionAt = segment.actionAt ?? 0.7;
  const file = pickFrame(frames, (segment.footageStart ?? 0) + t);

  // Virtual camera: ease toward the target, keep the window inside the frame.
  const zoomTarget = box ? (box.w < 140 ? 1.5 : box.w < 480 ? 1.32 : box.w < 1000 ? 1.15 : 1.06) : 1.05;
  const progress = interpolate(t, [0, Math.max(0.5, actionAt + 0.5), duration], [0, 0.82, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  const scale = 1 + (zoomTarget - 1) * progress;
  const cx = box ? W / 2 + (box.x + box.w / 2 - W / 2) * progress : W / 2;
  const cy = box ? H / 2 + (box.y + box.h / 2 - H / 2) * progress : H / 2;
  const spanW = W / scale;
  const spanH = H / scale;
  const left = Math.min(Math.max(cx - spanW / 2, 0), W - spanW);
  const top = Math.min(Math.max(cy - spanH / 2, 0), H - spanH);
  const toScreen = (px: number, py: number) => ({ x: (px - left) * scale, y: (py - top) * scale });

  const pointing = Boolean(box) && (segment.action === "click" || segment.action === "hover" || segment.action === "type");
  const target = box ? { x: box.x + box.w * 0.55, y: box.y + box.h * 0.6 } : null;
  const startAt = target ? { x: Math.min(W - 60, target.x + 280), y: Math.min(H - 60, target.y + 200) } : null;
  const travel = interpolate(t, [0.05, actionAt], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });
  const cursor = target && startAt ? toScreen(startAt.x + (target.x - startAt.x) * travel, startAt.y + (target.y - startAt.y) * travel) : null;
  const press = segment.action === "click" ? interpolate(t, [actionAt - 0.06, actionAt + 0.04, actionAt + 0.2], [1, 0.8, 1], CLAMP) : 1;
  const ripple = segment.action === "click" || segment.action === "type" ? interpolate(t, [actionAt, actionAt + 0.6], [0, 1], CLAMP) : 0;
  const ringIn = interpolate(t, [actionAt - 0.4, actionAt], [0, 1], CLAMP);
  // A click often changes the page under the target, so the ring lets go soon after it.
  const ringOut = segment.action === "click" ? interpolate(t, [actionAt + 0.5, actionAt + 0.95], [1, 0], CLAMP) : 1;
  const ring = box ? ringIn * ringOut : 0;
  const rippleAt = target ? toScreen(target.x, target.y) : null;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000", opacity: interpolate(frame, [0, 6], [0, 1], CLAMP) }}>
      <div style={{ position: "absolute", width: W, height: H, transformOrigin: "0 0", transform: `translate(${-left * scale}px, ${-top * scale}px) scale(${scale})` }}>
        {file && <Img src={`${base}/frames/${file}`} style={{ width: W, height: H, display: "block" }} />}
        {box && ring > 0 && (
          <div
            style={{
              position: "absolute",
              left: box.x - 8,
              top: box.y - 8,
              width: box.w + 16,
              height: box.h + 16,
              borderRadius: 12,
              border: "3px solid #ffb547",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.16), 0 0 36px rgba(255,181,71,0.7)",
              opacity: ring * 0.95,
            }}
          />
        )}
      </div>
      {rippleAt && ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: "absolute",
            left: rippleAt.x,
            top: rippleAt.y,
            width: 30 + ripple * 170,
            height: 30 + ripple * 170,
            marginLeft: -(15 + ripple * 85),
            marginTop: -(15 + ripple * 85),
            borderRadius: "50%",
            border: "4px solid #ffb547",
            opacity: 1 - ripple,
          }}
        />
      )}
      {pointing && cursor && <Pointer x={cursor.x} y={cursor.y} scale={press} />}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.32) 100%)" }} />
    </AbsoluteFill>
  );
}

function Captions({ words }: { words: CaptionWord[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last || t < first.start - 0.2) return null;
  const opacity = interpolate(t, [first.start - 0.2, first.start, last.end + 0.5, last.end + 0.8], [0, 1, 1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 76, opacity }}>
      <div
        style={{
          maxWidth: 1640,
          padding: "16px 34px",
          borderRadius: 20,
          background: "rgba(7,8,12,0.74)",
          fontFamily: sans,
          fontWeight: 700,
          fontSize: 46,
          lineHeight: 1.25,
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{ color: t >= w.start - 0.03 ? "#ffffff" : "rgba(255,255,255,0.32)" }}>
            {w.text}{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

export const Trailer: React.FC<TrailerProps> = ({ app, segments, frames, base, soundtrack }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      {segments.map((segment, i) => (
        <Sequence key={i} from={segment.from} durationInFrames={segment.frames} premountFor={20}>
          {segment.kind === "title" && <TitleCard app={app} />}
          {segment.kind === "end" && <EndCard app={app} />}
          {segment.kind === "shot" && <ShotScene segment={segment} frames={frames} base={base} />}
          <Captions words={segment.words} />
        </Sequence>
      ))}
      <Audio src={`${base}/${soundtrack}`} />
    </AbsoluteFill>
  );
};
