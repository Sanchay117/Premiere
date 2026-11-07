// The motion graphic beats after the screen recording: the formats, the agent route, the close,
// and the poster the thumbnails are rendered from. Each is timed to its narration's words.

import { AbsoluteFill, Img, interpolate, OffthreadVideo, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Lot, Marquee, NeonWordmark, neonPower, Sky } from "./art";
import { C, gothic, mono, sans, screenGlow } from "./theme";
import type { IntroProps, Line } from "./types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The frame (within the beat) at which the narrator says a word, or a fallback. */
function wordFrame(line: Line | undefined, beatStart: number, fps: number, word: string, fallback: number): number {
  const w = line?.words.find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(word));
  return w && line ? Math.round((line.at - beatStart + w.start) * fps) : fallback;
}

function Stub({ big, small, at, rotate }: { big: string; small: string; at: number; rotate: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 170 } });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: C.paper,
        color: C.paperInk,
        boxShadow: "0 30px 60px -25px rgba(0,0,0,0.9)",
        transform: `translateX(${(1 - p) * -560}px) rotate(${rotate}deg)`,
        opacity: frame >= at ? 1 : 0,
        width: 520,
      }}
    >
      <div style={{ alignSelf: "stretch", width: 18, background: C.red }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "16px 28px", borderLeft: `3px dashed ${C.ink}` }}>
        <span style={{ fontFamily: gothic, fontSize: 104, lineHeight: 0.9 }}>{big}</span>
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: "0.14em", color: C.red }}>{small}</span>
      </div>
    </div>
  );
}

/** Fifteen, thirty and forty-five second cuts, and the vertical one playing on a phone. */
export function Formats({ base, vertical, wide, line, start }: { base: string; vertical: string | null; wide: string | null; line?: Line; start: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fifteen = wordFrame(line, start, fps, "fifteen", 20);
  const thirty = wordFrame(line, start, fps, "thirty", 40);
  const vert = wordFrame(line, start, fps, "vertical", 100);
  const phone = spring({ frame: frame - vert + 4, fps, config: { damping: 16, stiffness: 110 } });
  const screen = easeOut(interpolate(frame, [2, 16], [0, 1], CLAMP));
  return (
    <AbsoluteFill>
      <Sky drift={frame * 0.4} glow={0.45} />
      <div style={{ position: "absolute", left: 120, top: 120 }}>
        <div style={{ fontFamily: gothic, fontSize: 118, lineHeight: 0.95, color: C.cream, textShadow: screenGlow }}>ANY RUNNING TIME.</div>
        <div style={{ fontFamily: gothic, fontSize: 118, lineHeight: 0.95, color: C.amber, textShadow: screenGlow, opacity: interpolate(frame, [vert - 6, vert], [0.25, 1], CLAMP) }}>ANY SCREEN.</div>
      </div>
      <div style={{ position: "absolute", left: 120, top: 420, display: "flex", flexDirection: "column", gap: 26 }}>
        <Stub big="45 S" small="THE TRAILER" at={4} rotate={-1.2} />
        <Stub big="30 S" small="A TEASER" at={fifteen} rotate={0.8} />
        <Stub big="15 S" small="A SPOT" at={Math.max(fifteen + 5, thirty - 4)} rotate={-0.4} />
      </div>
      {wide && (
        <div style={{ position: "absolute", left: 860, top: 170, width: 900, height: 506, borderRadius: 12, overflow: "hidden", boxShadow: "0 60px 120px -40px rgba(0,0,0,0.95), 0 0 0 2px #2a2b35, 0 0 120px rgba(255,214,150,0.12)", opacity: screen, transform: `translateY(${(1 - screen) * 40}px)` }}>
          <OffthreadVideo src={`${base}/${wide}`} muted startFrom={Math.round(19 * fps)} style={{ width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", left: 16, top: 14, fontFamily: mono, fontWeight: 700, fontSize: 20, letterSpacing: "0.14em", color: C.cream, background: "rgba(7,8,12,0.7)", padding: "6px 12px", borderRadius: 6 }}>16:9 · 1920 × 1080</div>
        </div>
      )}
      {vertical && (
        <div
          style={{
            position: "absolute",
            left: 1500,
            top: 330 + (1 - phone) * 820,
            width: 320,
            height: 668,
            padding: 12,
            borderRadius: 48,
            background: "#0d0e13",
            boxShadow: "0 60px 120px -30px rgba(0,0,0,0.95), inset 0 0 0 2px #30313b",
            transform: "rotate(5deg)",
          }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 38, overflow: "hidden", background: "#000" }}>
            <OffthreadVideo src={`${base}/${vertical}`} muted startFrom={Math.round(6 * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", left: 12, top: 12, fontFamily: mono, fontWeight: 700, fontSize: 16, letterSpacing: "0.12em", color: C.cream, background: "rgba(7,8,12,0.7)", padding: "4px 9px", borderRadius: 5 }}>9:16</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

const TERMINAL = [
  { kind: "prompt", text: "> Make a launch trailer of https://yourapp.xyz" },
  { kind: "tool", text: "● premiere · make_trailer" },
  { kind: "out", text: "  url: https://yourapp.xyz, style: hype, length: 45" },
  { kind: "out", text: "  Ordered. A trailer takes about 2 to 3 minutes." },
  { kind: "tool", text: "● premiere · trailer_status (wait_seconds: 180)" },
  { kind: "out", text: '  Status: done. "Your App", 44.6 s. Narrator: Atlas.' },
  { kind: "link", text: "  Trailer: …/files/trailer.mp4" },
  { kind: "link", text: "  Thumbnail: …/files/thumbnail-1920.png" },
  { kind: "link", text: "  Captions (SRT): …/files/captions.srt" },
] as const;

/** A coding agent ordering a trailer through the MCP server, and the one x402 request under it. */
export function Agents({ line, start }: { line?: Line; start: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineAt = (i: number) => 4 + i * 13;
  const x402 = wordFrame(line, start, fps, "x402", 100);
  const mcp = wordFrame(line, start, fps, "mcp", 190);
  const card = easeOut(interpolate(frame, [x402 - 14, x402 + 4], [0, 1], CLAMP));
  const win = easeOut(interpolate(frame, [0, 12], [0, 1], CLAMP));
  return (
    <AbsoluteFill>
      <Sky drift={frame * 0.3} glow={0.3} />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 140,
          width: 1100,
          height: 740,
          borderRadius: 18,
          background: "#0e0f15",
          boxShadow: `0 60px 120px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08), 0 0 ${interpolate(frame, [mcp - 6, mcp + 6], [0, 90], CLAMP)}px rgba(255,181,71,0.25)`,
          overflow: "hidden",
          opacity: win,
          transform: `translateY(${(1 - win) * 40}px)`,
        }}
      >
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: "#171822", fontFamily: mono, fontSize: 22, color: C.creamDim }}>
          {[0, 1, 2].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: "#3a3b46" }} />
          ))}
          <span style={{ marginLeft: 18 }}>terminal · coding agent · premiere mcp</span>
        </div>
        <div style={{ padding: "34px 40px", fontFamily: mono, fontSize: 31, lineHeight: 1.62, whiteSpace: "pre" }}>
          {TERMINAL.map((l, i) => {
            const at = lineAt(i);
            if (frame < at) return null;
            const chars = l.kind === "prompt" ? Math.max(0, Math.floor((frame - at) * 2.6)) : l.text.length;
            const color = l.kind === "prompt" ? C.cream : l.kind === "tool" ? C.amber : l.kind === "link" ? "#9fd0ff" : C.creamDim;
            return (
              <div key={i} style={{ color, fontWeight: l.kind === "prompt" || l.kind === "tool" ? 700 : 400, opacity: interpolate(frame - at, [0, 3], [0, 1], CLAMP) }}>
                {l.text.slice(0, chars)}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1260,
          top: 330,
          width: 560,
          padding: "34px 36px",
          background: C.paper,
          color: C.paperInk,
          boxShadow: "0 50px 100px -30px rgba(0,0,0,0.95)",
          transform: `rotate(2deg) translateY(${(1 - card) * 760}px)`,
        }}
      >
        <div style={{ fontFamily: gothic, fontSize: 64, lineHeight: 1 }}>ANY AGENT, ONE REQUEST</div>
        <div style={{ marginTop: 22, fontFamily: mono, fontSize: 25, fontWeight: 700, lineHeight: 1.6, whiteSpace: "pre" }}>
          {"POST /api/x402/trailers\n{ \"url\": \"https://yourapp.xyz\" }\n\n→ 202 { id, status, page }"}
        </div>
        <div style={{ marginTop: 18, fontFamily: sans, fontSize: 23, fontWeight: 600, color: "#6b5a44" }}>Paid in USDC on Base, once trailers cost money.</div>
      </div>
    </AbsoluteFill>
  );
}

/** The last word: the drive-in again, the neon sign, the price on the marquee, then the promise. */
export function Close({ duration, line, start }: { duration: number; line?: Line; start: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const power = neonPower(frame, 6);
  const then = wordFrame(line, start, fps, "then", 80);
  const paste = wordFrame(line, start, fps, "paste", 190);
  const get = wordFrame(line, start, fps, "get", 236);
  const swapped = frame >= paste - 4;
  const fade = interpolate(frame, [duration - 30, duration], [0, 1], CLAMP);
  const push = 1 + 0.05 * ease(Math.min(1, frame / duration));
  const marqueePower = interpolate(frame, [2, 8], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Sky drift={frame * 0.25} glow={0.55} />
      <Lot light={0.75} height={360} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 64, display: "flex", justifyContent: "center" }}>
        <NeonWordmark size={210} power={power} reflection={false} />
      </div>
      {!swapped ? (
        <Marquee
          rect={{ x: 300, y: 330, w: 1320 }}
          power={marqueePower}
          rows={[
            { text: "FREE UNTIL 16 NOV", at: 10, size: 150 },
            { text: "THEN A FEW USDC ON BASE", at: then, size: 112 },
          ]}
        />
      ) : (
        <Marquee
          rect={{ x: 300, y: 330, w: 1320 }}
          power={1}
          rows={[
            { text: "PASTE A URL.", at: paste - 2, size: 150 },
            { text: "GET A LAUNCH TRAILER.", at: get - 2, size: 124 },
          ]}
        />
      )}
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
    </AbsoluteFill>
  );
}

/** The thumbnail: the neon sign over the drive-in, with the promise. */
export function Poster({ base, apps }: IntroProps) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sky glow={0.8} />
      {apps[0] && (
        <div style={{ position: "absolute", left: 1150, top: 380, width: 660, height: 371, borderRadius: 12, overflow: "hidden", transform: "perspective(1600px) rotateY(-14deg)", boxShadow: "0 0 80px rgba(255,214,150,0.25), 0 60px 120px -40px rgba(0,0,0,0.95)" }}>
          <Img src={`${base}/${apps[0].file}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </div>
      )}
      <Lot light={0.9} height={300} />
      <div style={{ position: "absolute", left: 110, top: 170 }}>
        <NeonWordmark size={250} power={1} reflection={false} />
        <div style={{ marginTop: 50, fontFamily: gothic, fontSize: 124, lineHeight: 0.95, color: C.cream, textShadow: "0 0 30px rgba(255,181,71,0.25)" }}>
          PASTE A URL.
          <br />
          <span style={{ color: C.amber }}>GET A LAUNCH TRAILER.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
