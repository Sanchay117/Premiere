// The drive-in lot: distant hills and a tree line on the horizon, then rows of parked cars
// (seen from behind, facing the screen) with speaker posts between them. Pure SVG.

import { seeded } from "./rng";

function treeLine(width: number, base: number, seed: number, amplitude: number): string {
  const rand = seeded(seed);
  let d = `M0 ${base}`;
  for (let x = 0; x <= width; x += 14 + rand() * 18) {
    const h = base - amplitude * (0.35 + rand() * 0.65);
    d += ` Q${x + 6} ${h - 10 * rand()} ${x + 14} ${h + 6}`;
  }
  return `${d} L${width} ${base} L${width} 200 L0 200 Z`;
}

const HILLS = "M0 120 C 180 70, 330 95, 480 80 S 800 40, 1000 75 S 1300 60, 1440 90 L1440 200 L0 200 Z";
const TREES = treeLine(1440, 150, 7, 46);

/** A 1950s car from behind, as a silhouette against the screen, its roofline rimmed with light. */
function Car({ x, y, scale, variant, tint }: { x: number; y: number; scale: number; variant: 0 | 1 | 2; tint: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {variant === 2 ? (
        // pickup
        <path d="M6 72 L6 58 Q8 52 18 52 L58 52 L66 30 Q70 26 80 26 L122 26 Q132 26 136 32 L142 52 L182 52 Q192 52 194 58 L194 86 Q194 90 189 90 L11 90 Q6 90 6 86 Z" fill="#05060b" />
      ) : (
        <path
          d={
            variant === 0
              ? "M8 74 Q8 58 22 54 L44 51 Q60 24 100 23 Q140 24 156 51 L178 54 Q192 58 192 74 L192 86 Q192 90 187 90 L13 90 Q8 90 8 86 Z"
              : "M10 76 Q10 62 22 58 L38 55 Q56 34 100 33 Q144 34 162 55 L178 58 Q190 62 190 76 L190 86 Q190 90 185 90 L15 90 Q10 90 10 86 Z"
          }
          fill="#05060b"
        />
      )}
      {/* tail fins */}
      {variant === 0 && <path d="M12 64 L20 44 L28 58 Z M188 64 L180 44 L172 58 Z" fill="#05060b" />}
      {/* the screen's light catching the roofline */}
      <path
        d={variant === 2 ? "M66 30 Q70 26 80 26 L122 26 Q132 26 136 32" : variant === 0 ? "M44 51 Q60 24 100 23 Q140 24 156 51" : "M38 55 Q56 34 100 33 Q144 34 162 55"}
        fill="none"
        stroke="#ffe2b0"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.16 + tint * 0.16}
      />
    </g>
  );
}

function Speaker({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-1.5" y="0" width="3" height="60" fill="#05060b" />
      <rect x="-9" y="-6" width="18" height="12" rx="2" fill="#05060b" />
    </g>
  );
}

const BACK_ROW = (() => {
  const rand = seeded(42);
  return Array.from({ length: 9 }, (_, i) => ({ x: i * 168 - 30 + rand() * 30, variant: (i % 3) as 0 | 1 | 2, tint: rand() }));
})();
const FRONT_ROW = (() => {
  const rand = seeded(99);
  return Array.from({ length: 6 }, (_, i) => ({ x: i * 260 - 60 + rand() * 50, variant: ((i + 1) % 3) as 0 | 1 | 2, tint: rand() }));
})();

export function Lot() {
  return (
    <div aria-hidden className="pointer-events-none relative h-[clamp(150px,24vw,300px)] w-full">
      <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="screen-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd28a" />
            <stop offset="1" stopColor="#7a5a2a" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0d17" />
            <stop offset="1" stopColor="#07080c" />
          </linearGradient>
          <radialGradient id="beam-pool" cx="0.62" cy="0.1" r="0.6">
            <stop offset="0" stopColor="#ffb547" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="parallax-mid">
          <path d={HILLS} transform="translate(0 0)" fill="#0d1020" />
          <path d={TREES} transform="translate(0 -40)" fill="#080a14" />
        </g>
        <rect x="0" y="110" width="1440" height="190" fill="url(#ground)" />
        <rect x="0" y="110" width="1440" height="190" fill="url(#beam-pool)" />
        <g className="parallax-near">
          {BACK_ROW.map((c, i) => (
            <g key={`b${i}`}>
              <Car x={c.x} y={126} scale={0.62} variant={c.variant} tint={c.tint} />
              <Speaker x={c.x + 140} y={150} scale={0.6} />
            </g>
          ))}
          {FRONT_ROW.map((c, i) => (
            <Car key={`f${i}`} x={c.x} y={176} scale={1.05} variant={c.variant} tint={c.tint} />
          ))}
        </g>
      </svg>
    </div>
  );
}
