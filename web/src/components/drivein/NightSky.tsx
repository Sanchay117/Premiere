// The sky over the drive-in: deep night gradient, twinkling stars, a crescent moon and the odd
// shooting star. Pure SVG and CSS; the star field is seeded so it renders identically everywhere.

import { seeded } from "./rng";

const STARS = (() => {
  const rand = seeded(1913);
  return Array.from({ length: 140 }, () => {
    const big = rand() > 0.9;
    return {
      x: rand() * 100,
      y: Math.pow(rand(), 1.4) * 72,
      r: big ? 1.1 + rand() * 0.8 : 0.35 + rand() * 0.6,
      delay: rand() * 6,
      duration: 2.5 + rand() * 4,
      warm: rand() > 0.82,
    };
  });
})();

export function NightSky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#04050a_0%,#070915_45%,#11152a_78%,#1a1a2c_100%)]" />
      {/* faint milky band */}
      <div className="absolute -left-1/4 top-[8%] h-[38%] w-[150%] -rotate-[14deg] bg-[radial-gradient(ellipse_at_center,rgb(111_130_190/0.10),transparent_65%)] blur-2xl" />
      <svg className="parallax-far absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill={s.warm ? "#ffe2b0" : "#eef1ff"}
            className="twinkle"
            style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
          />
        ))}
      </svg>
      {/* moon */}
      <div className="parallax-mid absolute right-[4%] top-[8.5%] size-[clamp(44px,5vw,78px)]">
        <div className="absolute -inset-[140%] rounded-full bg-[radial-gradient(circle,rgb(255_236_200/0.16),transparent_60%)]" />
        <svg viewBox="0 0 100 100" className="relative h-full w-full">
          <defs>
            <mask id="crescent">
              <rect width="100" height="100" fill="white" />
              <circle cx="66" cy="38" r="42" fill="black" />
            </mask>
          </defs>
          <circle cx="50" cy="50" r="44" fill="#f6e7c8" mask="url(#crescent)" />
        </svg>
      </div>
      <span className="shooting-star absolute left-[12%] top-[10%] h-px w-28 bg-gradient-to-r from-transparent via-white to-transparent" />
    </div>
  );
}
