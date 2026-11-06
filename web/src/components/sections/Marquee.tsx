const ITEMS = [
  "Real footage",
  "45 seconds",
  "Narrated",
  "Captioned",
  "Scored",
  "Thumbnails included",
  "Made by an agent",
  "Night shift",
];

export function Marquee() {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden}>
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-10">
          <span className="font-serif text-[clamp(1.6rem,3.4vw,2.8rem)] italic text-cream/85">{item}</span>
          <span className="text-amber">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink-2 py-6">
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink-2 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink-2 to-transparent" />
    </div>
  );
}
