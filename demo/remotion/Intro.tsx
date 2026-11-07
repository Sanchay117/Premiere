// The opening trailer: 34 seconds of motion graphics cut to a 120 bpm score (a beat is 15 frames,
// a bar 60). A film leader counts down, the drive-in screen lights up, a marquee spells out the
// promise, a montage shows the agent at work, a wall of real apps, then the neon sign.

import { AbsoluteFill, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Beam, BigScreen, Cursor, Grain, Leader, Lot, Marquee, NeonWordmark, neonPower, Ripple, Sky, type Rect } from "./art";
import { C, gothic, mono, sans, screenGlow, seeded, W, H } from "./theme";
import { wordFrame } from "./timing";
import type { IntroProps, Word } from "./types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A word or line that slams in: oversized and blurred, then snapping to size. */
function Slam({ text, at, size, color = C.cream, origin = "50% 50%", style }: { text: string; at: number; size: number; color?: string; origin?: string; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 260, mass: 0.7 } });
  return (
    <div
      style={{
        fontFamily: gothic,
        fontSize: size,
        lineHeight: 0.92,
        color,
        transform: `scale(${1.4 - 0.4 * s})`,
        transformOrigin: origin,
        opacity: interpolate(frame - at, [0, 3], [0, 1], CLAMP),
        filter: `blur(${interpolate(frame - at, [0, 4], [8, 0], CLAMP)}px)`,
        textShadow: screenGlow,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** A decaying shake after each hit frame. */
function shake(frame: number, hits: number[], amount = 14) {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 12) continue;
    const k = amount * Math.pow(1 - t / 12, 2);
    x += Math.sin(t * 2.7 + h) * k;
    y += Math.cos(t * 3.3 + h) * k * 0.7;
  }
  return `translate(${x}px, ${y}px)`;
}

/** A flash of projector light on the cut, fading over a few frames. */
function Flash({ hits }: { hits: { at: number; strength: number }[] }) {
  const frame = useCurrentFrame();
  let o = 0;
  for (const h of hits) {
    const t = frame - h.at;
    if (t >= 0 && t < 6) o = Math.max(o, h.strength * Math.pow(1 - t / 6, 2));
  }
  return o > 0 ? <AbsoluteFill style={{ background: "#fff4de", opacity: o, pointerEvents: "none" }} /> : null;
}

const SCREEN: Rect = { x: 330, y: 92, w: 1260, h: 709 };

function Countdown() {
  const frame = useCurrentFrame();
  if (frame < 15) return <AbsoluteFill style={{ background: "#000" }} />;
  const n = Math.min(2, Math.floor((frame - 15) / 30));
  const local = (frame - 15 - n * 30) / 30;
  const flash = interpolate(frame, [104, 108, 120], [0, 1, 0.6], CLAMP);
  return (
    <AbsoluteFill>
      <Leader number={["3", "2", "1"][n]!} sweep={Math.min(1, local)} />
      <AbsoluteFill style={{ background: "#fff8ea", opacity: flash }} />
    </AbsoluteFill>
  );
}

function EveryApp() {
  const frame = useCurrentFrame();
  // The projector warms up with a stutter, then holds.
  const light = interpolate(frame, [0, 3, 5, 7, 12], [0.2, 0.9, 0.35, 1, 1], CLAMP);
  const push = 1 + 0.07 * ease(Math.min(1, frame / 120));
  return (
    <AbsoluteFill style={{ transform: `${shake(frame, [0], 10)} scale(${push})`, transformOrigin: "50% 42%" }}>
      <Sky glow={light} drift={frame * 0.2} />
      <Beam to={SCREEN} light={light} />
      <BigScreen rect={SCREEN} light={light * (0.97 + 0.03 * Math.sin(frame * 2.3) * Math.sin(frame * 0.71))}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 38%, #221d14, #0b0906 75%)", alignItems: "center", paddingTop: 150, gap: 10, transform: `scale(${1 + frame * 0.0004})` }}>
          <Slam text="EVERY APP" at={10} size={190} />
          <Slam text="NEEDS A TRAILER." at={33} size={190} color={C.amber} />
        </AbsoluteFill>
      </BigScreen>
      <Lot light={light} height={480} />
    </AbsoluteFill>
  );
}

function Clock({ spin }: { spin: number }) {
  return (
    <svg width={480} height={480} viewBox="-240 -240 480 480">
      <circle r={222} fill="rgba(0,0,0,0.2)" stroke={C.cream} strokeWidth={10} />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const major = i % 5 === 0;
        return <line key={i} x1={Math.sin(a) * (major ? 168 : 186)} y1={-Math.cos(a) * (major ? 168 : 186)} x2={Math.sin(a) * 200} y2={-Math.cos(a) * 200} stroke={C.cream} strokeWidth={major ? 9 : 3} opacity={major ? 1 : 0.6} />;
      })}
      <line x1={0} y1={20} x2={0} y2={-160} stroke={C.cream} strokeWidth={9} strokeLinecap="round" transform={`rotate(${spin * 360})`} />
      <line x1={0} y1={14} x2={0} y2={-105} stroke={C.cream} strokeWidth={15} strokeLinecap="round" transform={`rotate(${spin * 30})`} />
      <circle r={15} fill={C.red} />
    </svg>
  );
}

function SkipIt({ trailerLines }: IntroProps) {
  const frame = useCurrentFrame();
  const skipAt = wordFrame(trailerLines, "t-skip", "skip", 8, 27);
  const orAt = wordFrame(trailerLines, "t-skip", "or", 8, 58);
  const makingAt = wordFrame(trailerLines, "t-skip", "making", 8, 78);
  // The clock gathers speed through the scene: a day goes by in four seconds.
  const spin = Math.pow(frame / 120, 2.2) * 24;
  const second = frame >= orAt;
  const progress = interpolate(frame, [60, 120], [0.02, 0.05], CLAMP);
  const r = seeded(frame);
  const drift = interpolate(frame, [0, 120], [0, -30], CLAMP);
  return (
    <AbsoluteFill style={{ background: C.teal }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 38% 45%, rgba(255,255,255,0.09), transparent 60%), radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55))" }} />
      <AbsoluteFill style={{ opacity: 0.94 + r() * 0.06, transform: `translateX(${drift}px)` }}>
        <div style={{ position: "absolute", left: 180, top: 290 }}>
          <Clock spin={spin} />
        </div>
        <div style={{ position: "absolute", left: 790, top: 330, display: "flex", flexDirection: "column", gap: 10 }}>
          {!second ? (
            <>
              <Slam text="MOST FOUNDERS" at={10} size={180} origin="0% 50%" />
              <Slam text="SKIP IT." at={skipAt} size={180} color={C.amber} origin="0% 50%" />
            </>
          ) : (
            <>
              <Slam text="OR LOSE A DAY" at={orAt} size={180} origin="0% 50%" />
              <Slam text="MAKING ONE." at={makingAt} size={180} color={C.amber} origin="0% 50%" />
            </>
          )}
        </div>
        {second && (
          <div style={{ position: "absolute", left: 795, top: 790, width: 860, opacity: interpolate(frame, [62, 70], [0, 1], CLAMP) }}>
            <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: C.creamDim, letterSpacing: "0.14em" }}>EXPORTING · {Math.round(progress * 100)}% · ABOUT 9 HOURS LEFT</div>
            <div style={{ marginTop: 14, height: 12, background: "rgba(243,234,216,0.15)" }}>
              <div style={{ width: `${progress * 100}%`, height: "100%", background: C.cream }} />
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function PasteALink() {
  const frame = useCurrentFrame();
  const power = interpolate(frame, [0, 2, 4, 6, 9], [0, 1, 0.3, 1, 1], CLAMP);
  const push = 1 + 0.06 * ease(Math.min(1, frame / 120));
  return (
    <AbsoluteFill style={{ transform: `${shake(frame, [0], 16)} scale(${push})` }}>
      <Sky drift={frame * 0.3} glow={0.35 * power} />
      <Lot light={0.5 * power} height={380} />
      <Marquee
        rect={{ x: 250, y: 140, w: 1420 }}
        power={power}
        label={{ text: "Tonight", at: 11 }}
        rows={[
          { text: "PASTE A LINK.", at: 32, size: 230 },
          { text: "GET A TRAILER.", at: 77, size: 230 },
        ]}
      />
    </AbsoluteFill>
  );
}

function Label({ text, at, x, y, size = 150 }: { text: string; at: number; x: number; y: number; size?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <Slam text={text} at={at} size={size} origin="0% 50%" />
    </div>
  );
}

/** Browser chrome around an app frame. */
function Window({ src, rect, tilt = 0, glow = "transparent" }: { src: string; rect: Rect; tilt?: number; glow?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 16,
        overflow: "hidden",
        background: "#15161c",
        boxShadow: `0 70px 140px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08), 0 0 120px ${glow}`,
        transform: `perspective(1800px) rotateY(${tilt}deg) rotateX(${tilt * 0.25}deg)`,
      }}
    >
      <div style={{ height: 42, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#1b1c24" }}>
        {[0, 1, 2].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: "#3a3b46" }} />
        ))}
      </div>
      <Img src={src} style={{ width: "100%", height: rect.h - 42, objectFit: "cover", objectPosition: "top" }} />
    </div>
  );
}

function AgentTitle({ base, apps }: IntroProps) {
  const frame = useCurrentFrame();
  const track = interpolate(frame, [0, 40], [0.34, 0.02], { ...CLAMP, easing: easeOut });
  const scale = interpolate(frame, [0, 45], [1.08, 1], { ...CLAMP, easing: easeOut });
  return (
    <AbsoluteFill style={{ background: "#07080c" }}>
      {/* The apps it is about to open, out of focus behind the words. */}
      <AbsoluteFill style={{ opacity: 0.28, filter: "blur(16px)", transform: `scale(${1.15 - frame * 0.002})` }}>
        {apps.slice(0, 6).map((app, i) => (
          <Img key={i} src={`${base}/${app.file}`} style={{ position: "absolute", left: (i % 3) * 640, top: Math.floor(i / 3) * 540, width: 640, height: 540, objectFit: "cover" }} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(7,8,12,0.4), rgba(7,8,12,0.92) 70%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `${shake(frame, [0], 18)} scale(${scale})` }}>
        <div style={{ fontFamily: gothic, fontSize: 340, lineHeight: 0.9, color: C.cream, letterSpacing: `${track}em`, textShadow: screenGlow, opacity: interpolate(frame, [0, 4], [0, 1], CLAMP), marginRight: `-${track}em` }}>AN AI AGENT</div>
        <div style={{ marginTop: 16, height: 10, width: interpolate(frame, [6, 22], [0, 940], { ...CLAMP, easing: ease }), background: C.amber, boxShadow: "0 0 30px rgba(255,181,71,0.8)" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function OpensYourApp({ base, apps }: IntroProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fly = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const rect = { x: 760, y: 120 + (1 - fly) * 260, w: 1060, h: 640 };
  const click = 16;
  const target = { x: rect.x + rect.w * 0.3, y: rect.y + 42 + (rect.h - 42) * 0.72 };
  const cx = interpolate(frame, [0, click], [1880, target.x], { ...CLAMP, easing: ease });
  const cy = interpolate(frame, [0, click], [1040, target.y], { ...CLAMP, easing: ease });
  return (
    <AbsoluteFill>
      <Sky drift={frame} glow={0.3} />
      <Window src={`${base}/${apps[0]!.file}`} rect={rect} tilt={-10 * (1 - fly) - 5} glow="rgba(94,203,77,0.12)" />
      <div style={{ position: "absolute", left: target.x - 90, top: target.y - 34, width: 180, height: 68, borderRadius: 10, border: `3px solid ${C.amber}`, boxShadow: "0 0 30px rgba(255,181,71,0.55)", opacity: interpolate(frame, [click - 6, click], [0, 1], CLAMP) }} />
      <Ripple x={target.x} y={target.y} p={(frame - click) / 12} scale={1.4} />
      <Cursor x={cx} y={cy} scale={1.8} press={frame >= click && frame < click + 4 ? 1 : 0} />
      <Label text="OPENS" at={0} x={120} y={330} size={190} />
      <Label text="YOUR APP" at={4} x={120} y={510} size={190} />
    </AbsoluteFill>
  );
}

function WritesTheScript({ script: lines }: IntroProps) {
  const frame = useCurrentFrame();
  const text = [
    "TITLE CARD",
    `NARRATOR: ${lines.hook}`,
    "",
    "SHOT 01 · HOVER",
    `NARRATOR: ${lines.lines[0] ?? ""}`,
    "",
    "SHOT 02 · TYPE",
    `NARRATOR: ${lines.lines[1] ?? ""}`,
  ].join("\n");
  const shown = text.slice(0, Math.floor(frame * 9));
  return (
    <AbsoluteFill style={{ background: "#0b0c12" }}>
      <div
        style={{
          position: "absolute",
          left: 880,
          top: 110,
          width: 900,
          height: 860,
          padding: "64px 70px",
          background: C.paper,
          color: C.paperInk,
          boxShadow: "0 60px 120px -30px rgba(0,0,0,0.9)",
          transform: `rotate(2deg) translateY(${(1 - easeOut(Math.min(1, frame / 8))) * 80}px)`,
          fontFamily: mono,
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {shown}
        <span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>▌</span>
      </div>
      <Label text="WRITES" at={0} x={120} y={300} size={190} />
      <Label text="THE SCRIPT" at={4} x={120} y={480} size={190} />
      <div style={{ position: "absolute", left: 126, top: 690, fontFamily: mono, fontSize: 30, fontWeight: 700, color: C.amber, letterSpacing: "0.14em" }}>ONE CALL · CLAUDE OPUS 5.5</div>
    </AbsoluteFill>
  );
}

function FilmsTheRealThing({ base, apps }: IntroProps) {
  const frame = useCurrentFrame();
  const cell = { w: 560, h: 315 };
  const shift = frame * 16;
  const strip = apps.slice(1, 9);
  const timecode = `00:00:${String(19 + Math.floor(frame / 30)).padStart(2, "0")}:${String(frame % 30).padStart(2, "0")}`;
  return (
    <AbsoluteFill style={{ background: "#08090e" }}>
      <div style={{ position: "absolute", left: -120 - shift, top: 120, height: cell.h + 120, width: (cell.w + 40) * strip.length * 2, background: "#141118", display: "flex", alignItems: "center", gap: 40, padding: "0 20px", transform: "rotate(-3deg)", boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9)" }}>
        {[...strip, ...strip].map((app, i) => (
          <div key={i} style={{ position: "relative", width: cell.w, height: cell.h, flexShrink: 0, borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 2px #2a2530" }}>
            <Img src={`${base}/${app.file}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, top: 18, height: 26, backgroundImage: "repeating-linear-gradient(90deg, #f3ead8 0 26px, transparent 26px 64px)", opacity: 0.85 }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, height: 26, backgroundImage: "repeating-linear-gradient(90deg, #f3ead8 0 26px, transparent 26px 64px)", opacity: 0.85 }} />
      </div>
      <div style={{ position: "absolute", right: 120, top: 640, display: "flex", alignItems: "center", gap: 16, fontFamily: mono, fontSize: 38, fontWeight: 700, color: C.cream }}>
        <span style={{ width: 24, height: 24, borderRadius: 99, background: C.red, opacity: frame % 20 < 12 ? 1 : 0.25, boxShadow: "0 0 18px #c8372d" }} />
        REC {timecode}
      </div>
      <Label text="FILMS THE REAL THING" at={0} x={120} y={790} size={170} />
    </AbsoluteFill>
  );
}

/** Waveform bars for a track, seeded so it does not shimmer frame to frame. */
function Wave({ seed, width, height, color, reveal }: { seed: number; width: number; height: number; color: string; reveal: number }) {
  const r = seeded(seed);
  const bars = Math.floor(width / 9);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height, width, overflow: "hidden" }}>
      {Array.from({ length: bars }, (_, i) => {
        const h = (0.15 + 0.85 * Math.pow(r(), 1.6)) * height;
        return <span key={i} style={{ width: 6, height: i / bars < reveal ? h : 0, background: color, borderRadius: 2, flexShrink: 0 }} />;
      })}
    </div>
  );
}

function CutsIt({ base, apps, cutWords, cutAt }: IntroProps & { cutWords: Word[]; cutAt: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wordAt = (w: string) => {
    const found = cutWords.find((x) => x.text.toLowerCase().startsWith(w));
    return Math.round((cutAt + (found?.start ?? 0)) * fps);
  };
  const voiceAt = wordAt("voice");
  const captionsAt = wordAt("captions");
  const musicAt = wordAt("music");
  const left = 330;
  const trackW = 1480;
  const tracks = [
    { name: "PICTURE", at: 2, color: C.amber },
    { name: "VOICE", at: voiceAt, color: "#f3ead8" },
    { name: "CAPTIONS", at: captionsAt, color: "#e2c48f" },
    { name: "MUSIC", at: musicAt, color: "#d58b5a" },
  ];
  const playhead = interpolate(frame, [10, 135], [0, 1], CLAMP);
  const caption = "WITH A VOICE, CAPTIONS AND MUSIC".split(" ");
  const words = cutWords.slice(-caption.length);
  const monitorIn = easeOut(Math.min(1, frame / 10));
  return (
    <AbsoluteFill style={{ background: "#0a0b10" }}>
      {/* A preview monitor with the caption lighting word by word on the voice. */}
      <div style={{ position: "absolute", left: 860, top: 60, width: 940, height: 529, borderRadius: 12, overflow: "hidden", boxShadow: "0 0 0 2px #23242e, 0 40px 90px -30px rgba(0,0,0,0.9)", opacity: monitorIn, transform: `translateY(${(1 - monitorIn) * 40}px)` }}>
        <Img src={`${base}/${apps[3]!.file}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", filter: "brightness(0.6)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 36, textAlign: "center", fontFamily: gothic, fontSize: 68, letterSpacing: "0.02em" }}>
          {caption.map((w, i) => {
            const at = words[i] ? Math.round((cutAt + words[i]!.start) * fps) : 1e9;
            return (
              <span key={i} style={{ color: frame >= at ? C.amber : C.cream, margin: "0 10px", opacity: frame >= voiceAt - 8 ? 1 : 0, textShadow: "0 3px 14px rgba(0,0,0,0.8)" }}>
                {w}
              </span>
            );
          })}
        </div>
      </div>
      {/* The timeline: a ruler and four tracks filling in as the narrator names them. */}
      <div style={{ position: "absolute", left, top: 630, width: trackW, height: 24, backgroundImage: "repeating-linear-gradient(90deg, rgba(243,234,216,0.35) 0 2px, transparent 2px 74px)" }} />
      {tracks.map((t, i) => {
        const y = 668 + i * 92;
        const show = interpolate(frame, [t.at - 4, t.at + 4], [0, 1], CLAMP);
        return (
          <div key={t.name} style={{ position: "absolute", left: 110, top: y, display: "flex", alignItems: "center", gap: 20, opacity: 0.3 + 0.7 * show }}>
            <div style={{ width: 200, fontFamily: mono, fontWeight: 700, fontSize: 28, color: show > 0.5 ? C.cream : C.creamDim, letterSpacing: "0.12em" }}>{t.name}</div>
            <div style={{ position: "relative", width: trackW, height: 72, background: "#13141b", borderRadius: 6, overflow: "hidden" }}>
              {t.name === "PICTURE" ? (
                <div style={{ display: "flex", gap: 6, height: "100%" }}>
                  {apps.slice(0, 6).map((app, j) => {
                    const p = spring({ frame: frame - (2 + j * 5), fps, config: { damping: 16, stiffness: 200 } });
                    return (
                      <div key={j} style={{ width: 242, height: "100%", flexShrink: 0, transform: `translateY(${(1 - p) * 90}px)`, opacity: p, borderRadius: 4, overflow: "hidden", boxShadow: `inset 0 0 0 3px ${C.amber}` }}>
                        <Img src={`${base}/${app.file}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                      </div>
                    );
                  })}
                </div>
              ) : t.name === "CAPTIONS" ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", height: "100%", padding: "0 10px" }}>
                  {Array.from({ length: 16 }, (_, j) => (
                    <span key={j} style={{ width: 62 + ((j * 37) % 50), height: 30, background: j * 3 < frame - t.at ? t.color : "transparent", borderRadius: 4, opacity: 0.85 }} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: "0 10px" }}>
                  <Wave seed={i * 13} width={trackW - 20} height={72} color={t.color} reveal={interpolate(frame, [t.at, t.at + 30], [0, 1], CLAMP)} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: left + playhead * trackW, top: 624, width: 4, height: 400, background: C.red, boxShadow: "0 0 14px #c8372d" }} />
      <div style={{ position: "absolute", left: 110, top: 120 }}>
        <Slam text="THEN" at={0} size={200} origin="0% 50%" />
        <Slam text="CUTS IT." at={7} size={200} color={C.amber} origin="0% 50%" />
      </div>
    </AbsoluteFill>
  );
}

function AnyApp({ base, apps, trailerLines }: IntroProps) {
  const frame = useCurrentFrame();
  const anyAt = wordFrame(trailerLines, "t-any", "any", 26, 16);
  const aboutAt = wordFrame(trailerLines, "t-any", "about", 26, 35);
  const cols = 4;
  const rows = 3;
  const gap = 26;
  const cw = (W - 160 - gap * (cols - 1)) / cols;
  const ch = cw * 0.5625;
  const zoom = interpolate(frame, [0, 110], [1.55, 1], { ...CLAMP, easing: ease });
  const turn = interpolate(frame, [0, 110], [-6, 0], { ...CLAMP, easing: ease });
  const flash = interpolate(frame, [104, 119], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ background: "#06070b" }}>
      <AbsoluteFill style={{ transform: `perspective(2400px) rotateY(${turn}deg) scale(${zoom})` }}>
        {apps.slice(0, cols * rows).map((app, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const at = ((i * 7) % 12) * 2;
          const p = interpolate(frame, [at, at + 7], [0, 1], { ...CLAMP, easing: ease });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 80 + c * (cw + gap),
                top: (H - (ch * rows + gap * (rows - 1))) / 2 + r * (ch + gap),
                width: cw,
                height: ch,
                borderRadius: 10,
                overflow: "hidden",
                transform: `perspective(1400px) rotateY(${(1 - p) * 90}deg)`,
                opacity: p,
                boxShadow: `0 0 0 2px ${app.accent}55, 0 30px 60px -30px rgba(0,0,0,0.9)`,
              }}
            >
              <Img src={`${base}/${app.file}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(6,7,11,0.85) 22%, rgba(6,7,11,0.35) 72%)", alignItems: "center", justifyContent: "center" }}>
        <Slam text="ANY APP." at={anyAt} size={280} />
        <Slam text="ABOUT TWO MINUTES." at={aboutAt} size={150} color={C.amber} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff8ea", opacity: flash }} />
    </AbsoluteFill>
  );
}

function Title() {
  const frame = useCurrentFrame();
  const power = neonPower(frame, 2);
  const tag = interpolate(frame, [32, 48], [0, 1], { ...CLAMP, easing: ease });
  const out = interpolate(frame, [106, 120], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ background: "#040508" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 50% 40% at 50% 45%, rgba(255,150,60,${0.15 * power}), transparent 70%)` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `${shake(frame, [0], 12)} scale(${1 + frame * 0.0006})` }}>
        <div style={{ marginTop: -70 }}>
          <NeonWordmark size={330} power={power} />
        </div>
        <div style={{ marginTop: 40, fontFamily: gothic, fontSize: 70, letterSpacing: `${0.24 - 0.1 * tag}em`, color: C.cream, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
          PASTE A URL. GET A LAUNCH TRAILER.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, transparent, #fff3dc 50%, transparent)", opacity: out * 0.9, transform: `translateX(${(out - 0.5) * 140}%)` }} />
    </AbsoluteFill>
  );
}

export function Intro(props: IntroProps) {
  const { fps } = useVideoConfig();
  const at = (s: number) => Math.round(s * fps);
  const cut = props.trailerLines.find((l) => l.key === "t-cut");
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: sans }}>
      <Sequence from={0} durationInFrames={at(4)}>
        <Countdown />
      </Sequence>
      <Sequence from={at(4)} durationInFrames={at(4)}>
        <EveryApp />
      </Sequence>
      <Sequence from={at(8)} durationInFrames={at(4)}>
        <SkipIt {...props} />
      </Sequence>
      <Sequence from={at(12)} durationInFrames={at(4)}>
        <PasteALink />
      </Sequence>
      <Sequence from={at(16)} durationInFrames={at(1.5)}>
        <AgentTitle {...props} />
      </Sequence>
      <Sequence from={at(17.5)} durationInFrames={at(1)}>
        <OpensYourApp {...props} />
      </Sequence>
      <Sequence from={at(18.5)} durationInFrames={at(1)}>
        <WritesTheScript {...props} />
      </Sequence>
      <Sequence from={at(19.5)} durationInFrames={at(2)}>
        <FilmsTheRealThing {...props} />
      </Sequence>
      <Sequence from={at(21.5)} durationInFrames={at(4.5)}>
        <CutsIt {...props} cutWords={cut?.words ?? []} cutAt={(cut?.at ?? 21.2) - 21.5} />
      </Sequence>
      <Sequence from={at(26)} durationInFrames={at(4)}>
        <AnyApp {...props} />
      </Sequence>
      <Sequence from={at(30)} durationInFrames={at(4)}>
        <Title />
      </Sequence>
      <Flash
        hits={[
          { at: at(12), strength: 0.5 },
          { at: at(16), strength: 0.7 },
          { at: at(17.5), strength: 0.25 },
          { at: at(18.5), strength: 0.25 },
          { at: at(19.5), strength: 0.25 },
          { at: at(21.5), strength: 0.4 },
          { at: at(26), strength: 0.35 },
          { at: at(30), strength: 0.8 },
        ]}
      />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

export { SCREEN };
