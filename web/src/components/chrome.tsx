// Site chrome: the neon sign over the gate, navigation and footer. Server components.

import Link from "next/link";

/** "Premiere" in sign-painter script, lit like a neon tube. */
export function Wordmark({ className = "text-[2.1rem]" }: { className?: string }) {
  return <span className={`neon neon-flicker font-script leading-none ${className}`}>Premiere</span>;
}

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

const LINKS = [
  { href: "/#program", label: "Program" },
  { href: "/gallery", label: "Gallery" },
  { href: "/#box-office", label: "Box office" },
  { href: "/#agents", label: "For agents" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="absolute inset-0 -z-10 bg-ink/85 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3 md:px-8">
        <Link href="/" aria-label="Premiere, back to the front gate" className="pt-1">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-cream-dim lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-amber">
              {l.label}
            </a>
          ))}
        </nav>
        <span className="hidden font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-amber sm:block">Open all night</span>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <Wordmark className="text-2xl" />
          <span className="text-sm text-cream-faint">Launch trailers, made by an agent.</span>
        </Link>
        <p className="font-mono text-xs text-cream-faint">Open all night. No account, no subscription.</p>
      </div>
    </footer>
  );
}
