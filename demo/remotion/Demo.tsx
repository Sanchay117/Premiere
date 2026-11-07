// The whole demo: the opening trailer, then the screen recording of the real site on a stage, with
// an eased camera, a drawn pointer, captions for the guide's narration, reel tabs and time-lapse
// badges, the finished trailer over the page's player, and the motion graphic beats to close.

import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Cursor, Ripple } from "./art";
import { Agents, Close, Formats } from "./Graphics";
import { Intro } from "./Intro";
import { C, gothic, H, mono, sans, W } from "./theme";
import type { CameraKey, DemoProps, Line, RecPart, Recording } from "./types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The page's width on screen when the camera shows all of it, and the window bar above it. */
const STAGE_W = 1600;
const BAR = 40;
/** How long a camera move takes. */
const MOVE = 1.1;

/** Recording time for a moment of the video, through the parts that map one onto the other. */
function recTimeAt(T: number, parts: RecPart[]): number {
  let current = parts[0];
  for (const p of parts) if (T >= p.outStart) current = p;
  if (!current) return 0;
  const span = current.outEnd - current.outStart;
  const u = span > 0 ? clamp((T - current.outStart) / span, 0, 1) : 1;
  return current.recStart + u * (current.recEnd - current.recStart);
}

function frameAt(rec: Recording, t: number): string {
  const frames = rec.frames;
  let lo = 0;
  let hi = frames.length - 1;
  if (hi < 0) return "";
  if (t <= frames[0]!.t) return frames[0]!.file;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo]!.file;
}

/** Where the pointer is: each move eases along a gentle curve, the way a hand moves a mouse. */
function pointerAt(rec: Recording, t: number): { x: number; y: number; idle: number } {
  const moves = rec.moves;
  let i = 0;
  while (i < moves.length && moves[i]!.t <= t) i++;
  const cur = moves[Math.max(0, i - 1)]!;
  const before = moves[Math.max(0, i - 2)] ?? cur;
  if (!cur) return { x: 720, y: 405, idle: 99 };
  if (t >= cur.until || cur.until <= cur.t) return { x: cur.x, y: cur.y, idle: t - cur.until };
  const p = easeInOut((t - cur.t) / (cur.until - cur.t));
  const dx = cur.x - before.x;
  const dy = cur.y - before.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(70, len * 0.16);
  const cx = (before.x + cur.x) / 2 - (dy / len) * bend;
  const cy = (before.y + cur.y) / 2 + (dx / len) * bend;
  const x = (1 - p) * (1 - p) * before.x + 2 * (1 - p) * p * cx + p * p * cur.x;
  const y = (1 - p) * (1 - p) * before.y + 2 * (1 - p) * p * cy + p * p * cur.y;
  return { x, y, idle: 0 };
}

interface View {
  z: number;
  cx: number;
  cy: number;
  /** Where the point of interest sits on screen, as a fraction of the height. */
  fy: number;
}

/** Most framings keep the point of interest a little above center, clear of the captions. */
const FOCUS_Y = 0.44;

function cameraAt(T: number, keys: CameraKey[], follow: (T: number) => { x: number; y: number }, vp: { width: number; height: number }): View {
  const whole = { z: 1, cx: vp.width / 2, cy: vp.height / 2, fy: 0.5 };
  let state: View = whole;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (key.at > T) break;
    const fy = key.focusY ?? FOCUS_Y;
    const target: View = key.follow
      ? { z: key.z, cx: follow(T).x, cy: follow(T).y, fy }
      : key.cx === undefined
        ? { ...whole, z: key.z, fy: key.focusY ?? 0.5 }
        : { z: key.z, cx: key.cx, cy: key.cy ?? vp.height / 2, fy };
    const next = keys[i + 1];
    const until = next && next.at <= T ? next.at : T;
    const u = easeInOut(clamp((until - key.at) / MOVE, 0, 1));
    state = { z: Math.exp(lerp(Math.log(state.z), Math.log(target.z), u)), cx: lerp(state.cx, target.cx, u), cy: lerp(state.cy, target.cy, u), fy: lerp(state.fy, target.fy, u) };
  }
  return state;
}

/** Page pixels to screen pixels for a camera view: the page's scale and where its top left lands. */
function mapping(view: View, vp: { width: number; height: number }) {
  const k = (STAGE_W / vp.width) * view.z;
  const pw = vp.width * k;
  const ph = vp.height * k;
  const bar = BAR * view.z;
  // Keep the window on screen while it fits; once it is larger than the screen, leave no empty edge.
  const ox = pw <= W ? clamp(W / 2 - view.cx * k, 0, W - pw) : clamp(W / 2 - view.cx * k, W - pw, 0);
  const natural = H * view.fy + bar / 2 - view.cy * k;
  // Zoomed in, the window may rise to show some of the dark stage under it, so a point low on the
  // page can still sit clear of the captions.
  const rise = clamp((view.z - 1) * 900, 0, 340);
  const oy = ph + bar <= H ? clamp(natural, bar, H - ph) : clamp(natural, H - ph - rise, bar);
  return { k, pw, ph, bar, ox, oy };
}

function Walkthrough(props: DemoProps & { offset: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = (frame + props.offset) / fps;
  const { rec, parts, camera, base } = props;
  const vp = rec.viewport;
  const recT = recTimeAt(T, parts);
  // The camera follows a smoothed pointer when asked to, so it glides rather than jumps.
  const follow = (at: number) => {
    let x = 0;
    let y = 0;
    for (let s = -4; s <= 4; s++) {
      const p = pointerAt(rec, recTimeAt(at + s * 0.12, parts));
      x += p.x;
      y += p.y;
    }
    return { x: x / 9, y: y / 9 };
  };
  const view = cameraAt(T, camera, follow, vp);
  const m = mapping(view, vp);
  const pointer = pointerAt(rec, recT);
  const pointerOpacity = pointer.idle > 2.2 ? interpolate(pointer.idle, [2.2, 2.6], [1, 0], CLAMP) : 1;
  const lastClick = rec.clicks.filter((c) => c.t <= recT).at(-1);
  const clickAge = lastClick ? recT - lastClick.t : 99;
  // The title's light sweep hands over to the window: it arrives bright and settles.
  const enter = interpolate(frame, [0, 18], [0, 1], { ...CLAMP, easing: easeInOut });
  const glare = interpolate(frame, [0, 12], [0.75, 0], CLAMP);
  const radius = 14 * view.z;

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {/* The stage: night ink, a warm light behind the window, a few stars. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 60% at 50% 48%, #1b1710 0%, #0b0c11 55%, #050609 100%)" }} />
      <div
        style={{
          position: "absolute",
          left: m.ox,
          top: m.oy - m.bar,
          width: m.pw,
          height: m.ph + m.bar,
          borderRadius: radius,
          overflow: "hidden",
          background: "#0f1015",
          boxShadow: `0 ${50 * view.z}px ${130 * view.z}px -${30 * view.z}px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.07), 0 0 160px rgba(255,181,71,0.07)`,
          transform: `scale(${1.05 - 0.05 * enter})`,
        }}
      >
        <div style={{ height: m.bar, display: "flex", alignItems: "center", padding: `0 ${18 * view.z}px`, gap: 9 * view.z, background: "#16171e" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12 * view.z, height: 12 * view.z, borderRadius: 99, background: "#34353f" }} />
          ))}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15 * view.z, color: "rgba(243,234,216,0.5)", padding: `${4 * view.z}px ${16 * view.z}px`, background: "#0f1015", borderRadius: 99, letterSpacing: "0.08em" }}>
              premiere · open all night
            </span>
          </div>
          <span style={{ width: 54 * view.z }} />
        </div>
        <Img src={`${base}/${frameAt(rec, recT)}`} style={{ position: "absolute", left: 0, top: m.bar, width: m.pw, height: m.ph }} />
        {props.overlays.map((o, i) => (
          <Sequence key={i} from={Math.round(o.start * fps) - props.offset} durationInFrames={Math.round((o.end - o.start) * fps)} layout="none">
            <div style={{ position: "absolute", left: o.box.x * m.k, top: m.bar + o.box.y * m.k, width: o.box.w * m.k, height: o.box.h * m.k, background: "#000" }}>
              <OffthreadVideo src={`${base}/${o.file}`} startFrom={Math.round(o.from * fps)} style={{ width: "100%", height: "100%" }} />
            </div>
          </Sequence>
        ))}
      </div>
      <AbsoluteFill style={{ background: "#fff4de", opacity: glare, pointerEvents: "none" }} />
      <div style={{ opacity: pointerOpacity * enter }}>
        <Ripple x={m.ox + pointer.x * m.k} y={m.oy + pointer.y * m.k} p={clickAge / 0.5} scale={0.9 * view.z} />
        <Cursor x={m.ox + pointer.x * m.k} y={m.oy + pointer.y * m.k} scale={1.25 * view.z} press={clickAge < 0.12 ? 1 : 0} />
      </div>
    </AbsoluteFill>
  );
}

/** The guide's words, with what has been said in full cream, the word being said in amber, and
 *  what is still to come dimmed. */
function Captions({ lines, offset }: { lines: Line[]; offset: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = (frame + offset) / fps;
  const line = lines.find((l) => T >= l.at - 0.1 && T <= l.at + l.duration + 0.3);
  if (!line) return null;
  const local = T - line.at;
  const opacity = interpolate(T, [line.at - 0.1, line.at + 0.1, line.at + line.duration + 0.1, line.at + line.duration + 0.3], [0, 1, 1, 0], CLAMP);
  const words = line.words.length ? line.words : line.text.split(" ").map((w, i, all) => ({ text: w, start: (i / all.length) * line.duration, end: ((i + 1) / all.length) * line.duration }));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 54, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1460,
          padding: "16px 30px 18px",
          borderRadius: 14,
          background: "rgba(7,8,12,0.78)",
          boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 38,
          lineHeight: 1.32,
          letterSpacing: "-0.005em",
          opacity,
          transform: `translateY(${(1 - opacity) * 10}px)`,
        }}
      >
        {words.map((w, i) => {
          const said = local >= w.end;
          const saying = local >= w.start - 0.04 && local < w.end;
          return (
            <span key={i} style={{ color: saying ? C.amber : said ? C.cream : "rgba(243,234,216,0.42)" }}>
              {w.text}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** A ticket stub in the top left naming the reel: which part of the night this is. */
function ChapterTab({ chapters, offset }: { chapters: DemoProps["chapters"]; offset: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = (frame + offset) / fps;
  return (
    <>
      {chapters.map((c) => {
        if (T < c.at - 0.1 || T > c.until + 0.6) return null;
        const inP = spring({ frame: Math.round((T - c.at) * fps), fps, config: { damping: 18, stiffness: 140 } });
        const outP = interpolate(T, [c.until - 0.1, c.until + 0.4], [0, 1], { ...CLAMP, easing: easeInOut });
        const x = -420 * (1 - inP) - 420 * outP;
        return (
          <div key={c.reel} style={{ position: "absolute", left: 56 + x, top: 46, display: "flex", alignItems: "stretch", boxShadow: "0 18px 40px -16px rgba(0,0,0,0.9)" }}>
            <div style={{ background: C.red, color: C.paper, fontFamily: mono, fontWeight: 700, fontSize: 18, letterSpacing: "0.16em", padding: "0 14px", display: "flex", alignItems: "center", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              REEL {c.reel}
            </div>
            <div style={{ background: C.paper, color: C.paperInk, padding: "10px 22px 8px 18px", borderLeft: `3px dashed ${C.ink}` }}>
              <div style={{ fontFamily: gothic, fontSize: 46, lineHeight: 1, letterSpacing: "0.03em" }}>{c.title}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Timelapse({ spans, offset }: { spans: DemoProps["timelapses"]; offset: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = (frame + offset) / fps;
  const span = spans.find((s) => T >= s.start && T < s.end);
  if (!span) return null;
  const opacity = interpolate(T, [span.start, span.start + 0.2, span.end - 0.2, span.end], [0, 1, 1, 0], CLAMP);
  const real = span.realStart >= 0 ? span.realStart + (T - span.start) * span.speed : -1;
  const clock = real >= 0 ? `${Math.floor(real / 60)}:${String(Math.floor(real % 60)).padStart(2, "0")}` : null;
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        top: 50,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 20px",
        borderRadius: 999,
        background: "rgba(7,8,12,0.82)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: "0.12em",
        color: C.cream,
        opacity,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 99, background: C.red, boxShadow: "0 0 10px #c8372d", opacity: frame % 24 < 14 ? 1 : 0.3 }} />
      TIME-LAPSE ×{span.speed}
      {clock && <span style={{ color: C.amber, marginLeft: 6 }}>{clock} SINCE THE ORDER</span>}
    </div>
  );
}

/** A graphic beat arriving over whatever came before: a quick fade with a settle. */
function Arrive({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 12], [0, 1], { ...CLAMP, easing: easeInOut });
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.03 - 0.03 * p})` }}>{children}</AbsoluteFill>;
}

export function Demo(props: DemoProps) {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const introF = f(props.introSeconds);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sequence durationInFrames={introF + 8}>
        <Intro {...props} />
      </Sequence>
      <Sequence from={introF} durationInFrames={f(props.walkEnd) - introF + 14}>
        <Walkthrough {...props} offset={introF} />
      </Sequence>
      {props.graphics.map((g) => {
        const line = props.guideLines.find((l) => l.key === g.key);
        return (
          <Sequence key={g.key} from={f(g.start)} durationInFrames={f(g.end - g.start) + (g.key === "close" ? 0 : 14)}>
            <Arrive>
              {g.key === "formats" ? (
                <Formats base={props.base} vertical={props.vertical} wide={props.wide} line={line} start={g.start} />
              ) : g.key === "agents" ? (
                <Agents line={line} start={g.start} />
              ) : (
                <Close duration={f(g.end - g.start)} line={line} start={g.start} />
              )}
            </Arrive>
          </Sequence>
        );
      })}
      <Sequence from={introF}>
        <ChapterTab chapters={props.chapters} offset={introF} />
        <Timelapse spans={props.timelapses} offset={introF} />
        <Captions lines={props.guideLines} offset={introF} />
      </Sequence>
      {props.soundtrack && <Audio src={`${props.base}/${props.soundtrack}`} />}
    </AbsoluteFill>
  );
}
