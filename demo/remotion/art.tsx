// The drive-in, drawn for the screen: the night sky, the lot with its cars, the big screen on its
// posts, the projector beam, the roadside marquee, the neon sign and a film leader. The shapes
// follow the website's own (web/src/components/drivein), so the video and the site match.

import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, gothic, H, neonGlow, script, seeded, W } from "./theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The night sky: a deep gradient and a field of twinkling stars. drift moves the stars sideways. */
export function Sky({ drift = 0, glow = 0 }: { drift?: number; glow?: number }) {
  const frame = useCurrentFrame();
  const stars = useMemo(() => {
    const r = seeded(17);
    return Array.from({ length: 260 }, () => ({ x: r() * W, y: r() * H * 0.72, s: 0.5 + r() * r() * 2.2, p: r() * 6.28, sp: 0.03 + r() * 0.08 }));
  }, []);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#030409 0%, #070913 42%, #121228 74%, #1e1733 100%)" }}>
      {glow > 0 && (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 45% at 50% 42%, rgba(255,206,140,${0.16 * glow}), transparent 70%)` }} />
      )}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {stars.map((st, i) => {
          const x = (((st.x + drift * (0.3 + st.s * 0.25)) % W) + W) % W;
          return <circle key={i} cx={x} cy={st.y} r={st.s} fill="#fff6e0" opacity={0.25 + 0.6 * (0.5 + 0.5 * Math.sin(frame * st.sp + st.p))} />;
        })}
      </svg>
    </AbsoluteFill>
  );
}

function treeLine(width: number, base: number, seed: number, amplitude: number): string {
  const rand = seeded(seed);
  let d = `M0 ${base}`;
  for (let x = 0; x <= width; x += 14 + rand() * 18) {
    const h = base - amplitude * (0.35 + rand() * 0.65);
    d += ` Q${x + 6} ${h - 10 * rand()} ${x + 14} ${h + 6}`;
  }
  return `${d} L${width} ${base} L${width} 300 L0 300 Z`;
}

const HILLS = "M0 120 C 180 70, 330 95, 480 80 S 800 40, 1000 75 S 1300 60, 1440 90 L1440 300 L0 300 Z";
const TREES = treeLine(1440, 150, 7, 46);

const CAR_BODY = [
  "M8 74 Q8 58 22 54 L44 51 Q60 24 100 23 Q140 24 156 51 L178 54 Q192 58 192 74 L192 86 Q192 90 187 90 L13 90 Q8 90 8 86 Z",
  "M10 76 Q10 62 22 58 L38 55 Q56 34 100 33 Q144 34 162 55 L178 58 Q190 62 190 76 L190 86 Q190 90 185 90 L15 90 Q10 90 10 86 Z",
  "M6 72 L6 58 Q8 52 18 52 L58 52 L66 30 Q70 26 80 26 L122 26 Q132 26 136 32 L142 52 L182 52 Q192 52 194 58 L194 86 Q194 90 189 90 L11 90 Q6 90 6 86 Z",
];
const CAR_ROOF = ["M44 51 Q60 24 100 23 Q140 24 156 51", "M38 55 Q56 34 100 33 Q144 34 162 55", "M66 30 Q70 26 80 26 L122 26 Q132 26 136 32"];

function Car({ x, y, scale, variant, rim }: { x: number; y: number; scale: number; variant: 0 | 1 | 2; rim: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={CAR_BODY[variant]} fill="#04050a" />
      {variant === 0 && <path d="M12 64 L20 44 L28 58 Z M188 64 L180 44 L172 58 Z" fill="#04050a" />}
      <path d={CAR_ROOF[variant]} fill="none" stroke="#ffe2b0" strokeWidth="1.8" strokeLinecap="round" opacity={rim} />
    </g>
  );
}

/** Hills, trees and two rows of parked cars facing the screen, their rooflines catching its light.
 *  light (0 to 1) is how bright the screen is. */
export function Lot({ light = 1, height = 360 }: { light?: number; height?: number }) {
  const back = useMemo(() => {
    const r = seeded(42);
    return Array.from({ length: 9 }, (_, i) => ({ x: i * 168 - 30 + r() * 30, variant: (i % 3) as 0 | 1 | 2, tint: r() }));
  }, []);
  const front = useMemo(() => {
    const r = seeded(99);
    return Array.from({ length: 6 }, (_, i) => ({ x: i * 260 - 60 + r() * 50, variant: ((i + 1) % 3) as 0 | 1 | 2, tint: r() }));
  }, []);
  return (
    <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" width={W} height={height} style={{ position: "absolute", left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0d17" />
          <stop offset="1" stopColor="#05060a" />
        </linearGradient>
        <radialGradient id="pool" cx="0.5" cy="0.05" r="0.65">
          <stop offset="0" stopColor="#ffb547" stopOpacity={0.2 * light} />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={HILLS} fill="#0c0f1f" />
      <path d={TREES} transform="translate(0 -40)" fill="#070912" />
      <rect x="0" y="110" width="1440" height="190" fill="url(#ground)" />
      <rect x="0" y="110" width="1440" height="190" fill="url(#pool)" />
      {back.map((c, i) => (
        <g key={`b${i}`}>
          <Car x={c.x} y={126} scale={0.62} variant={c.variant} rim={(0.12 + c.tint * 0.2) * light} />
          <rect x={c.x + 139} y={150} width="2" height="36" fill="#04050a" />
          <rect x={c.x + 134.5} y={146} width="11" height="7" rx="1.5" fill="#04050a" />
        </g>
      ))}
      {front.map((c, i) => (
        <Car key={`f${i}`} x={c.x} y={176} scale={1.05} variant={c.variant} rim={(0.16 + c.tint * 0.24) * light} />
      ))}
    </svg>
  );
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The big screen on its posts. light (0 to 1) is the projector's brightness on it. */
export function BigScreen({ rect, light, children }: { rect: Rect; light: number; children?: React.ReactNode }) {
  const post = Math.max(10, rect.w * 0.014);
  return (
    <>
      {/* Posts and cross beam, behind the screen. */}
      <div style={{ position: "absolute", left: rect.x + rect.w * 0.16, top: rect.y + rect.h, width: post, height: 700, background: "linear-gradient(#1a1c26, #07080d 40%)" }} />
      <div style={{ position: "absolute", left: rect.x + rect.w * 0.84 - post, top: rect.y + rect.h, width: post, height: 700, background: "linear-gradient(#1a1c26, #07080d 40%)" }} />
      <div
        style={{
          position: "absolute",
          left: rect.x - rect.w * 0.012,
          top: rect.y - rect.w * 0.012,
          width: rect.w * 1.024,
          height: rect.h + rect.w * 0.024,
          background: "#0b0c12",
          borderRadius: 4,
          boxShadow: `0 0 ${80 + 120 * light}px rgba(255,214,150,${0.1 + 0.22 * light}), 0 0 ${260 * light}px rgba(255,181,71,${0.12 * light})`,
        }}
      />
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", background: "#0a0907" }}>
        {children}
        {/* The light itself: the screen surface brightens and its edges fall off like a projection. */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.45))", pointerEvents: "none" }} />
        <AbsoluteFill style={{ background: "#000", opacity: 1 - light }} />
      </div>
    </>
  );
}

/** The projector beam: a soft cone from behind the lot up to the screen, with dust drifting in it. */
export function Beam({ to, light, from = { x: W * 0.5, y: H + 260 } }: { to: Rect; light: number; from?: { x: number; y: number } }) {
  const frame = useCurrentFrame();
  const motes = useMemo(() => {
    const r = seeded(5);
    return Array.from({ length: 70 }, () => ({ u: r(), v: r(), s: 0.6 + r() * 1.6, sp: 0.2 + r() * 0.6, p: r() * 6.28 }));
  }, []);
  const flicker = 0.92 + 0.08 * Math.sin(frame * 1.7) * Math.sin(frame * 0.37);
  const pts = `${from.x - 6},${from.y} ${to.x},${to.y} ${to.x + to.w},${to.y} ${to.x + to.w},${to.y + to.h} ${to.x},${to.y + to.h} ${from.x + 6},${from.y}`;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: light * flicker }}>
      <defs>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff2d6" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#ffd48f" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={pts} fill="url(#beam)" />
      {motes.map((m, i) => {
        // A point inside the cone: lerp from the lens toward a spot on the screen.
        const t = (m.v + frame * 0.0015 * m.sp) % 1;
        const tx = to.x + to.w * m.u;
        const ty = to.y + to.h * (0.5 + 0.4 * Math.sin(m.p + frame * 0.01));
        const x = from.x + (tx - from.x) * t + Math.sin(frame * 0.05 + m.p) * 6;
        const y = from.y + (ty - from.y) * t;
        return <circle key={i} cx={x} cy={y} r={m.s} fill="#fff4dc" opacity={0.35 * (0.5 + 0.5 * Math.sin(frame * 0.2 + m.p))} />;
      })}
    </svg>
  );
}

/** The roadside marquee: black letters on a lit panel, ringed by chasing bulbs. Each row reveals its
 *  letters one by one, from its `at` frame, a few frames apart, each hanging a little crooked. */
export function Marquee({
  rows,
  rect,
  power,
  label,
}: {
  rows: { text: string; at: number; size: number }[];
  rect: { x: number; y: number; w: number };
  power: number;
  label?: { text: string; at: number };
}) {
  const frame = useCurrentFrame();
  const bulbs = (count: number, offset: number) =>
    Array.from({ length: count }, (_, i) => {
      const lit = (i + offset + Math.floor(frame / 4)) % 3 === 0;
      const on = power * (lit ? 1 : 0.45);
      return (
        <span
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 99,
            background: on > 0.6 ? "#ffe9bf" : `rgba(255,200,120,${0.25 + 0.4 * on})`,
            boxShadow: on > 0.6 ? "0 0 10px #ffc66b, 0 0 24px rgba(255,170,60,0.7)" : "none",
          }}
        />
      );
    });
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w }}>
      <div
        style={{
          borderRadius: 16,
          background: "linear-gradient(#1d160c,#120d07)",
          padding: 14,
          boxShadow: "0 60px 120px -50px rgba(0,0,0,0.95), inset 0 0 0 2px #3e2c12",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px" }}>{bulbs(34, 0)}</div>
        <div
          style={{
            margin: "14px 0",
            borderRadius: 4,
            padding: "26px 40px 22px",
            textAlign: "center",
            color: "#16110a",
            background: `linear-gradient(rgba(255,246,224,${0.55 + 0.45 * power}), rgba(246,232,200,${0.5 + 0.45 * power}))`,
            boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 14px 40px rgba(255,255,255,${0.6 * power}), 0 0 ${90 * power}px rgba(255,236,200,${0.3 * power})`,
          }}
        >
          {label && (
            <div
              style={{
                fontFamily: script,
                fontSize: 64,
                lineHeight: 1,
                color: "#c8372d",
                marginBottom: 6,
                opacity: interpolate(frame, [label.at, label.at + 6], [0, 1], CLAMP),
              }}
            >
              {label.text}
            </div>
          )}
          {rows.map((row, r) => {
            const rand = seeded(r * 31 + 7);
            return (
              <div key={r} style={{ fontFamily: gothic, fontSize: row.size, lineHeight: 1.04, whiteSpace: "nowrap", perspective: 600 }}>
                {Array.from(row.text).map((ch, i) => {
                  const tilt = (rand() - 0.5) * 3.6;
                  const drop = (rand() - 0.5) * 0.05;
                  const start = row.at + i * 2;
                  const p = interpolate(frame, [start, start + 5], [0, 1], CLAMP);
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        width: ch === " " ? "0.32em" : undefined,
                        transform: `translateY(${drop}em) rotate(${tilt}deg) rotateX(${(1 - p) * -95}deg)`,
                        transformOrigin: "50% 0%",
                        opacity: p,
                      }}
                    >
                      {ch === " " ? "" : ch}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px" }}>{bulbs(34, 1)}</div>
      </div>
    </div>
  );
}

/** Flicker for a neon tube switching on at `at`: a few stutters, then steady. */
export function neonPower(frame: number, at: number): number {
  const t = frame - at;
  if (t < 0) return 0;
  const pattern = [1, 0, 0, 1, 1, 0, 1, 0.3, 1, 1, 0, 1];
  if (t < pattern.length) return pattern[t]!;
  // A rare buzz after it settles.
  return t % 97 === 0 ? 0.7 : 1;
}

/** The neon wordmark, with its glow, a dark tube when off, and a soft reflection below. */
export function NeonWordmark({ size, power, reflection = true }: { size: number; power: number; reflection?: boolean }) {
  const lit = power > 0.05;
  const style: React.CSSProperties = {
    fontFamily: script,
    fontSize: size,
    lineHeight: 1,
    color: lit ? `rgba(255,227,176,${0.35 + 0.65 * power})` : "#2a2018",
    textShadow: lit ? neonGlow : "none",
    opacity: lit ? 0.4 + 0.6 * power : 1,
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={style}>Premiere</div>
      {reflection && (
        <div style={{ ...style, position: "absolute", top: "100%", left: 0, transform: "scaleY(-1)", opacity: (lit ? 0.16 : 0) * power, filter: "blur(6px)", maskImage: "linear-gradient(transparent 40%, black)" }}>
          Premiere
        </div>
      )}
    </div>
  );
}

/** An Academy-style film leader: crosshairs, rings and a sweeping hand around a big number. */
export function Leader({ number, sweep }: { number: string; sweep: number }) {
  const frame = useCurrentFrame();
  const weave = { x: Math.sin(frame * 2.1) * 1.5, y: Math.cos(frame * 1.3) * 1.2 };
  const r = seeded(frame + 3);
  const scratches = Array.from({ length: 3 }, () => ({ x: r() * W, o: r() * 0.25 }));
  const dust = Array.from({ length: 6 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 4 }));
  return (
    <AbsoluteFill style={{ background: "#d8cfbb", transform: `translate(${weave.x}px, ${weave.y}px)`, filter: `brightness(${0.94 + r() * 0.08})` }}>
      <AbsoluteFill style={{ background: `conic-gradient(from 0deg, rgba(40,32,22,0.55) ${sweep * 360}deg, transparent ${sweep * 360}deg)`, maskImage: "radial-gradient(circle at 50% 50%, black 0 400px, transparent 401px)" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#2b2318" strokeWidth={3} />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#2b2318" strokeWidth={3} />
        <circle cx={W / 2} cy={H / 2} r={400} fill="none" stroke="#2b2318" strokeWidth={5} />
        <circle cx={W / 2} cy={H / 2} r={340} fill="none" stroke="#2b2318" strokeWidth={3} />
        {scratches.map((s, i) => (
          <line key={i} x1={s.x} y1={0} x2={s.x + 4} y2={H} stroke="#1a140d" strokeWidth={1.2} opacity={s.o} />
        ))}
        {dust.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.s} fill="#1a140d" opacity={0.5} />
        ))}
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: gothic, fontSize: 520, lineHeight: 1, color: "#221b12", marginTop: 40 }}>{number}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(20,14,8,0.55))" }} />
    </AbsoluteFill>
  );
}

/** A drawn pointer (headless browsers record none) with a ripple when it clicks. */
export function Cursor({ x, y, scale = 1, press = 0 }: { x: number; y: number; scale?: number; press?: number }) {
  return (
    <svg
      width={30 * scale}
      height={34 * scale}
      viewBox="0 0 30 34"
      style={{ position: "absolute", left: x - 3 * scale, top: y - 2 * scale, overflow: "visible", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.55))", transform: `scale(${1 - press * 0.12})`, transformOrigin: "3px 2px" }}
    >
      <path d="M3 2 L3 26 L9.5 20.5 L13.8 30 L18 28.2 L13.8 18.8 L22.5 18.8 Z" fill="#fffaf0" stroke="#15110b" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

export function Ripple({ x, y, p, scale = 1 }: { x: number; y: number; p: number; scale?: number }) {
  if (p <= 0 || p >= 1) return null;
  const r = (10 + 46 * p) * scale;
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: 999,
        border: `${3 * scale}px solid ${C.amber}`,
        opacity: 1 - p,
        boxShadow: `0 0 ${20 * scale}px rgba(255,181,71,0.6)`,
      }}
    />
  );
}

/** Fine film grain for the trailer, moving every frame. Kept faint so text stays sharp. */
export function Grain({ opacity = 0.08 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const seed = frame % 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
      <svg width={W} height={H}>
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 -0.1" />
        </filter>
        <rect width={W} height={H} filter={`url(#grain${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}
