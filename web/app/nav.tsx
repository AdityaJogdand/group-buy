// Frosted sticky nav and footer, shared by every page.

// Three overlapping seats: the group.
export function LogoMark({ className = "h-4 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 16" className={className} aria-hidden>
      <circle cx="6" cy="8" r="6" fill="#fff" opacity=".3" />
      <circle cx="14" cy="8" r="6" fill="#fff" opacity=".6" />
      <circle cx="22" cy="8" r="6" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
      <LogoMark /> Group Buy
    </a>
  );
}

export function Nav() {
  return (
    <header className="material sticky top-0 z-50 border-b border-line">
      <nav className="container-x flex h-14 items-center justify-between gap-4" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-7 text-sm text-ink/70 md:flex">
          <a href="/#how" className="hover:text-ink">How it works</a>
          <a href="/listed-product" className="hover:text-ink">Groups</a>
          <a href="/#claude" className="hover:text-ink">Use with Claude</a>
          <a href="/seller" className="hover:text-ink">Sell</a>
        </div>
        <a href="/listed-product" className="btn press whitespace-nowrap px-4 py-1.5 text-sm">Join a group</a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="container-x flex flex-col gap-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-muted">
          <span>Payments held by PayPal</span>
          <span>Sandbox demo · no real money</span>
          <span>© 2026 Group Buy</span>
        </p>
      </div>
    </footer>
  );
}

// Section header: tag pill, left-aligned title fading grey to white, one line under it.
export function Head({ tag, title, sub, center }: { tag: string; title: React.ReactNode; sub: string; center?: boolean }) {
  return (
    <div className={`reveal max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <span className="tag"><LogoMark className="h-2.5 w-4" /> {tag}</span>
      <h2 className="display text-fade mt-5 pb-1 text-[clamp(2.25rem,4.6vw,3.5rem)]">{title}</h2>
      <p className={`mt-3 max-w-xl text-muted ${center ? "mx-auto" : ""}`}>{sub}</p>
    </div>
  );
}
