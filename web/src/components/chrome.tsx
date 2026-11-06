// Site chrome: logo, navigation and footer. Server components.

import Link from "next/link";

export function Logo({ className = "size-6" }: { className?: string }) {
  // A film reel with an amber hub.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="#f3ead8" strokeWidth="2" />
      <circle cx="16" cy="16" r="3.2" fill="#ffb547" />
      {[0, 72, 144, 216, 288].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return <circle key={deg} cx={16 + 8 * Math.sin(rad)} cy={16 - 8 * Math.cos(rad)} r="2.6" fill="#f3ead8" />;
      })}
    </svg>
  );
}

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="absolute inset-0 -z-10 bg-ink/70 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-serif text-[1.65rem] leading-none tracking-tight">Premiere</span>
        </Link>
        <nav className="hidden items-center gap-8 whitespace-nowrap text-sm text-cream-dim lg:flex">
          <a href="/#program" className="transition hover:text-cream">Program</a>
          <a href="/#story" className="transition hover:text-cream">Intermission</a>
          <a href="/#deliverables" className="transition hover:text-cream">Take-home reels</a>
          <a href="/#access" className="transition hover:text-cream">Box office</a>
        </nav>
        <span className="eyebrow hidden items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[10px] sm:inline-flex">
          <svg viewBox="0 0 16 16" className="size-3 fill-amber" aria-hidden>
            <path d="M10.5 1.5a6.5 6.5 0 1 0 4 11.6A7 7 0 0 1 10.5 1.5z" />
          </svg>
          Vibeathon 02 · Night shift
        </span>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2.5">
          <Logo className="size-5" />
          <span className="font-serif text-xl">Premiere</span>
          <span className="ml-3 text-sm text-cream-faint">Launch trailers, made by an agent.</span>
        </div>
        <p className="font-mono text-xs text-cream-faint">Made for Vibestarter Vibeathon 02: Night shift</p>
      </div>
    </footer>
  );
}
