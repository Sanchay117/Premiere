// The trailer composition, in two styles.
// Walkthrough: title card, one calm scene per filmed shot with a quiet chapter label, end card.
// Hype: the app name slams in, every shot opens with its punch title on a dark screen, then the
// footage plays inside a floating browser window.
// Both burn in word-timed captions in the chosen look and carry the mastered soundtrack.

import type React from "react";
import { createContext, useContext } from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionStyle } from "../../options";
import { fitTitle } from "./fit";
import { COLORS, gothic, mono, sans, serif } from "./fonts";
import type { AppInfo, CaptionWord, TrailerProps, TrailerSegment } from "./types";

/** The app's own color (render/thumbnail.ts picks it from the footage) for the type, the captions'
 *  highlight and the end card, so each trailer looks like its app. The click spotlight and ripple
 *  stay Premiere's amber: an app-colored ring would vanish against the app's own buttons. */
const Accent = createContext<string>(COLORS.amber);
const useAccent = () => useContext(Accent);

/** The vertical cut (1080 by 1920, for TikTok, Reels and Shorts). The 16:9 footage rides across
 *  the middle as a card, zoomed a little further toward each target so the app reads on a phone;
 *  the app's name sits above it and the captions below, the way vertical screen recordings are
 *  laid out. Titles and end cards are the same scenes, sized to the frame's width. */
const Vertical = createContext(false);
const useVertical = () => useContext(Vertical);
const VW = 1080;
/** Where the footage card's center sits in the vertical frame. */
const CARD_CENTER = 860;
/** The footage card's height at full width: 1920 by 1080 scaled to 1080 wide. */
const CARD_H = (1080 * VW) / 1920;

/** A 1920 by 1080 scene scaled into the vertical frame's card. zoom above 1 lets a scene that
 *  floats inside its frame (the hype window) fill the card's width. */
function VerticalStage({ zoom = 1, rounded = false, children }: { zoom?: number; rounded?: boolean; children: React.ReactNode }) {
  const scale = (VW / W) * zoom;
  return (
    <div
      style={{
        position: "absolute",
        left: VW / 2 - (W * scale) / 2,
        top: CARD_CENTER - (H * scale) / 2,
        width: W,
        height: H,
        transform: `scale(${scale})`,
        transformOrigin: "0 0",
        ...(rounded ? { borderRadius: 26 / scale, overflow: "hidden", boxShadow: "0 60px 140px -30px rgba(0,0,0,0.9)" } : {}),
      }}
    >
      {children}
    </div>
  );
}

/** The app's name and address above the footage card, so the tall frame never sits empty. */
function VerticalHeader({ app }: { app: AppInfo }) {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const name = app.name.toUpperCase();
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: CARD_CENTER - CARD_H / 2 - 300, textAlign: "center", opacity: interpolate(frame, [0, 8], [0, 1], CLAMP) }}>
      <div style={{ fontFamily: gothic, fontSize: fitTitle(name, "gothic", VW - 160, 150), lineHeight: 0.95, color: COLORS.cream }}>{name}</div>
      <div style={{ fontFamily: mono, fontSize: 34, color: accent, marginTop: 14 }}>{app.host}</div>
    </div>
  );
}

const W = 1920;
const H = 1080;
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

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

// ---------------------------------------------------------------------------------------------
// Walkthrough

function TitleCard({ app }: { app: AppInfo }) {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const spacing = interpolate(t, [0, 1.7], [0.3, 0.01], { ...CLAMP, easing: easeOut });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <NightBackdrop glow={`${accent}2e`} />
      <div style={{ position: "relative", textAlign: "center", marginTop: -90 }}>
        <div style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.45em", color: "rgba(243,234,216,0.62)", opacity: interpolate(t, [0, 0.5], [0, 1], CLAMP) }}>
          NOW SHOWING
        </div>
        <div
          style={{
            fontFamily: serif,
            // One line always: the letter spacing animates, and a wrap would come and go with it.
            fontSize: fitTitle(app.name, "serif", Math.min(1700, width - 140), 200, false),
            lineHeight: 1,
            whiteSpace: "nowrap",
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
              color: accent,
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
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pop = interpolate(t, [0.1, 0.55], [0.86, 1], { ...CLAMP, easing: Easing.out(Easing.back(1.6)) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <NightBackdrop glow={`${accent}24`} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginTop: -110 }}>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 66,
            color: COLORS.ink,
            background: accent,
            borderRadius: 999,
            padding: "24px 60px",
            transform: `scale(${pop})`,
            opacity: interpolate(t, [0.05, 0.35], [0, 1], CLAMP),
            boxShadow: `0 30px 90px -20px ${accent}a6`,
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

/** One filmed shot, full frame: virtual camera, ring, cursor and ripple. Time starts with the footage. */
function ShotScene({ segment, frames, base, boost = 1 }: { segment: TrailerSegment; frames: TrailerProps["frames"]; base: string; boost?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const duration = (segment.frames - (segment.punchFrames ?? 0)) / fps;
  const box = segment.box ?? null;
  const actionAt = segment.actionAt ?? 0.7;
  const file = pickFrame(frames, (segment.footageStart ?? 0) + t);

  // Virtual camera: ease toward the target, keep the window inside the frame.
  const zoomTarget = (box ? (box.w < 140 ? 1.5 : box.w < 480 ? 1.32 : box.w < 1000 ? 1.15 : 1.06) : 1.05) * boost;
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
  // The ring marks the thing being used, so only clicks, hovers and typing get one, and only
  // when the target sits wholly in frame and is smaller than most of the screen. A scroll moves
  // the page under any ring, and a ring around the whole screen points at nothing.
  const ringable =
    pointing &&
    box !== null &&
    box.x >= -2 &&
    box.y >= -2 &&
    box.x + box.w <= W + 2 &&
    box.y + box.h <= H + 2 &&
    box.w * box.h < W * H * 0.45;
  const ring = ringable ? ringIn * ringOut : 0;
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
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.3), 0 0 36px rgba(255,181,71,0.7)",
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

/** Walkthrough: the shot's punch title as a chapter label for its first couple of seconds. */
function ShotLabel({ text }: { text: string }) {
  const accent = useAccent();
  const vertical = useVertical();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (!text) return null;
  const opacity = interpolate(t, [0.25, 0.6, 2.4, 2.8], [0, 1, 1, 0], CLAMP);
  const x = interpolate(t, [0.25, 0.7], [-24, 0], { ...CLAMP, easing: easeOut });
  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? 60 : 72,
        top: vertical ? CARD_CENTER - CARD_H / 2 - 100 : 64,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px 14px 22px",
        borderRadius: 999,
        background: "rgba(7,8,12,0.8)",
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: accent }} />
      <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 30, color: COLORS.cream }}>{text}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Hype

/** Slow drifting light behind the whole hype cut. Uses the global frame, so it never jumps. */
function HypeBackdrop() {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const t = frame / 30;
  const a = { x: 30 + 14 * Math.sin(t * 0.31), y: 34 + 9 * Math.cos(t * 0.27) };
  const b = { x: 72 + 11 * Math.cos(t * 0.23), y: 68 + 10 * Math.sin(t * 0.29) };
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${a.x}% ${a.y}%, ${accent}33, transparent 44%), radial-gradient(circle at ${b.x}% ${b.y}%, rgba(96,124,255,0.16), transparent 50%), #06070b`,
      }}
    />
  );
}

function Flash({ at, peak = 0.5 }: { at: number; peak?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame / fps, [at, at + 0.04, at + 0.32], [0, peak, 0], CLAMP);
  return opacity > 0 ? <AbsoluteFill style={{ background: "#fff8ea", opacity }} /> : null;
}

function HypeTitle({ app }: { app: AppInfo }) {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const name = app.name.toUpperCase();
  const slam = interpolate(t, [0.2, 0.44], [1.4, 1], { ...CLAMP, easing: easeOut });
  const shown = interpolate(t, [0.2, 0.28], [0, 1], CLAMP);
  const settle = interpolate(t, [0.44, 4], [1, 1.05], CLAMP);
  const tag = interpolate(t, [0.85, 1.25], [0, 1], { ...CLAMP, easing: easeOut });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginTop: -40, transform: `scale(${settle})` }}>
        <div style={{ fontFamily: gothic, fontSize: fitTitle(name, "gothic", Math.min(1680, width - 120), 330), lineHeight: 0.9, maxWidth: Math.min(1680, width - 120), color: COLORS.cream, transform: `scale(${slam})`, opacity: shown }}>
          {name}
        </div>
        {app.tagline && (
          <div
            style={{
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 46,
              letterSpacing: "0.03em",
              color: accent,
              marginTop: 30,
              opacity: tag,
              transform: `translateY(${(1 - tag) * 18}px)`,
            }}
          >
            {app.tagline}
          </div>
        )}
      </div>
      <Flash at={0.2} peak={0.55} />
    </AbsoluteFill>
  );
}

/** The punch title on a dark screen: words rise out of their own masks, the last one in amber. */
function PunchCard({ text, seconds }: { text: string; seconds: number }) {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const length = words.join(" ").length;
  const size = length <= 10 ? 270 : length <= 18 ? 215 : 170;
  const exit = interpolate(t, [seconds - 0.16, seconds], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - exit }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: "0.2em",
          maxWidth: Math.min(1640, width - 100),
          fontFamily: gothic,
          fontSize: size,
          lineHeight: 0.95,
          transform: `scale(${1 + 0.05 * t + 0.08 * exit})`,
        }}
      >
        {words.map((word, i) => {
          const at = 0.03 + i * 0.07;
          const p = interpolate(t, [at, at + 0.2], [0, 1], { ...CLAMP, easing: easeOut });
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.02em 0 0.04em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 108}%)`, color: i === words.length - 1 ? accent : COLORS.cream }}>
                {word}
              </span>
            </span>
          );
        })}
      </div>
      <Flash at={0} peak={0.22} />
    </AbsoluteFill>
  );
}

export const BAR = 54;

/** The hype cut's browser chrome; the hype thumbnail uses it too. */
export function WindowBar({ host }: { host: string }) {
  return (
    <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 12, padding: "0 22px", background: "#14161d", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {["#ff6159", "#ffbd2e", "#28c941"].map((c) => (
        <div key={c} style={{ width: 15, height: 15, borderRadius: "50%", background: c, opacity: 0.85 }} />
      ))}
      <div
        style={{
          margin: "0 auto",
          padding: "7px 28px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.06)",
          fontFamily: mono,
          fontSize: 22,
          color: "rgba(243,234,216,0.75)",
        }}
      >
        {host}
      </div>
      <div style={{ width: 69 }} />
    </div>
  );
}

/** Hype footage: the filmed shot inside a browser window that flies in tilted and settles. */
function FloatingWindow({ segment, frames, base, index, host }: { segment: TrailerSegment; frames: TrailerProps["frames"]; base: string; index: number; host: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const duration = (segment.frames - (segment.punchFrames ?? 0)) / fps;
  const enter = interpolate(t, [0, 0.5], [0, 1], { ...CLAMP, easing: easeOut });
  const drift = interpolate(t, [0, duration], [0, 1], CLAMP);
  const side = index % 2 === 0 ? 1 : -1;
  const rotateX = 24 * (1 - enter) + 7 - 5 * drift;
  const rotateY = side * (-12 * (1 - enter) - 6 + 4.5 * drift);
  const scale = 0.7 + 0.13 * enter + 0.05 * drift;
  const y = 420 * (1 - enter);
  return (
    <AbsoluteFill style={{ perspective: 2600, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: W,
          height: H + BAR,
          flexShrink: 0,
          borderRadius: 28,
          overflow: "hidden",
          background: "#0d0f15",
          boxShadow: "0 90px 180px -40px rgba(0,0,0,0.9), 0 0 0 2px rgba(255,255,255,0.07)",
          transform: `translateY(${y}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          opacity: enter,
        }}
      >
        <WindowBar host={host} />
        <div style={{ position: "relative", width: W, height: H }}>
          <ShotScene segment={segment} frames={frames} base={base} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function HypeShot({ segment, frames, base, index, host }: { segment: TrailerSegment; frames: TrailerProps["frames"]; base: string; index: number; host: string }) {
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const punchFrames = segment.punchFrames ?? 0;
  return (
    <AbsoluteFill>
      {punchFrames > 0 && (
        <Sequence durationInFrames={punchFrames} layout="none">
          <PunchCard text={segment.title ?? ""} seconds={punchFrames / fps} />
        </Sequence>
      )}
      <Sequence from={punchFrames} layout="none">
        {vertical ? (
          <VerticalStage zoom={1.18}>
            <FloatingWindow segment={segment} frames={frames} base={base} index={index} host={host} />
          </VerticalStage>
        ) : (
          <FloatingWindow segment={segment} frames={frames} base={base} index={index} host={host} />
        )}
      </Sequence>
    </AbsoluteFill>
  );
}

function HypeEnd({ app }: { app: AppInfo }) {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const name = app.name.toUpperCase();
  const rise = (from: number) => interpolate(t, [from, from + 0.35], [0, 1], { ...CLAMP, easing: easeOut });
  const pop = interpolate(t, [0.25, 0.6], [0.8, 1], { ...CLAMP, easing: Easing.out(Easing.back(1.8)) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -100 }}>
        <div style={{ fontFamily: gothic, fontSize: fitTitle(name, "gothic", Math.min(1500, width - 120), 210), lineHeight: 0.9, maxWidth: Math.min(1500, width - 120), textAlign: "center", color: COLORS.cream, opacity: rise(0), transform: `translateY(${(1 - rise(0)) * 30}px)` }}>
          {name}
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 60,
            color: COLORS.ink,
            background: accent,
            borderRadius: 999,
            padding: "22px 58px",
            transform: `scale(${pop})`,
            opacity: rise(0.2),
            boxShadow: `0 30px 90px -20px ${accent}99`,
          }}
        >
          {app.cta}
        </div>
        <div style={{ fontFamily: mono, fontSize: 40, color: COLORS.cream, marginTop: 38, opacity: rise(0.5) }}>{app.host}</div>
        <div style={{ fontFamily: mono, fontSize: 21, letterSpacing: "0.38em", color: "rgba(243,234,216,0.5)", marginTop: 52, opacity: rise(0.9) }}>
          MADE WITH PREMIERE
        </div>
      </div>
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------------------------
// Captions

const OUTLINE = "0 2px 0 rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)";

/** Groups of up to three words, breaking after punctuation, for the bold look. */
function wordGroups(words: CaptionWord[]): CaptionWord[][] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const word of words) {
    current.push(word);
    if (current.length === 3 || /[.,!?;:]$/.test(word.text)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function Captions({ words, look }: { words: CaptionWord[]; look: CaptionStyle }) {
  const accent = useAccent();
  const vertical = useVertical();
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  /** Where the caption block hangs: under the card in the vertical cut (clear of the hype window,
   *  which tilts past the card's edge), along the bottom otherwise. */
  const place = (bottom: number) =>
    vertical ? { justifyContent: "flex-start" as const, paddingTop: CARD_CENTER + CARD_H / 2 + 150 } : { justifyContent: "flex-end" as const, paddingBottom: bottom };
  const t = frame / fps;
  const first = words[0];
  const last = words[words.length - 1];
  if (look === "off" || !first || !last || t < first.start - 0.2) return null;
  const opacity = interpolate(t, [first.start - 0.2, first.start, last.end + 0.5, last.end + 0.8], [0, 1, 1, 0], CLAMP);
  const spoken = (w: CaptionWord) => t >= w.start - 0.03;

  if (look === "bold") {
    const groups = wordGroups(words);
    let index = -1;
    groups.forEach((g, i) => {
      if (t >= g[0]!.start - 0.05) index = i;
    });
    const group = groups[index];
    if (!group) return null;
    const since = t - (group[0]!.start - 0.05);
    const pop = interpolate(since, [0, 0.14], [0.84, 1], { ...CLAMP, easing: Easing.out(Easing.back(2.2)) });
    return (
      <AbsoluteFill style={{ ...place(104), alignItems: "center", opacity }}>
        <div
          style={{
            maxWidth: Math.min(1500, width - 100),
            textAlign: "center",
            fontFamily: gothic,
            fontSize: 128,
            lineHeight: 1,
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            textShadow: "0 6px 0 rgba(0,0,0,0.55), 0 0 32px rgba(0,0,0,0.7)",
            transform: `scale(${pop})`,
          }}
        >
          {group.map((w, i) => (
            <span key={i} style={{ color: spoken(w) ? (i === group.length - 1 ? accent : "#ffffff") : "rgba(255,255,255,0.55)" }}>
              {w.text}{" "}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (look === "karaoke") {
    return (
      <AbsoluteFill style={{ opacity }}>
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.32) 15%, transparent 30%)" }} />
        <AbsoluteFill style={{ ...place(84), alignItems: "center" }}>
          <div style={{ maxWidth: Math.min(1600, width - 100), textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: vertical ? 58 : 52, lineHeight: 1.22, textShadow: OUTLINE }}>
            {words.map((w, i) => {
              const next = words[i + 1];
              const active = spoken(w) && (!next || t < next.start - 0.03);
              return (
                <span key={i} style={{ color: active ? accent : spoken(w) ? "#ffffff" : "rgba(255,255,255,0.62)" }}>
                  {w.text}{" "}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ ...place(76), alignItems: "center", opacity }}>
      <div
        style={{
          maxWidth: Math.min(1640, width - 80),
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
          <span key={i} style={{ color: spoken(w) ? "#ffffff" : "rgba(255,255,255,0.32)" }}>
            {w.text}{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------------------------

export const Trailer: React.FC<TrailerProps> = ({ app, segments, frames, base, soundtrack, style = "walkthrough", captions = "boxed", accent = COLORS.amber, format = "landscape" }) => {
  const hype = style === "hype";
  const vertical = format === "vertical";
  let shotIndex = 0;
  return (
    <Accent.Provider value={accent}>
    <Vertical.Provider value={vertical}>
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      {hype && <HypeBackdrop />}
      {segments.map((segment, i) => {
        const index = segment.kind === "shot" ? shotIndex++ : 0;
        return (
          <Sequence key={i} from={segment.from} durationInFrames={segment.frames} premountFor={20}>
            {hype ? (
              <>
                {segment.kind === "title" && <HypeTitle app={app} />}
                {segment.kind === "end" && <HypeEnd app={app} />}
                {segment.kind === "shot" && (
                  <>
                    {vertical && <VerticalHeader app={app} />}
                    <HypeShot segment={segment} frames={frames} base={base} index={index} host={app.host} />
                  </>
                )}
              </>
            ) : (
              <>
                {segment.kind === "title" && <TitleCard app={app} />}
                {segment.kind === "end" && <EndCard app={app} />}
                {segment.kind === "shot" && (
                  <>
                    {vertical ? (
                      <>
                        <VerticalHeader app={app} />
                        <VerticalStage rounded>
                          <ShotScene segment={segment} frames={frames} base={base} boost={1.25} />
                        </VerticalStage>
                      </>
                    ) : (
                      <ShotScene segment={segment} frames={frames} base={base} />
                    )}
                    <ShotLabel text={segment.title ?? ""} />
                  </>
                )}
              </>
            )}
            <Captions words={segment.words} look={captions} />
          </Sequence>
        );
      })}
      <Audio src={`${base}/${soundtrack}`} />
    </AbsoluteFill>
    </Vertical.Provider>
    </Accent.Provider>
  );
};
