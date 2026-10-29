// Frosted sticky nav and footer, shared by every page.
import { NavShell } from "./nav-shell";

// Three overlapping seats: the group.
export function LogoMark({ className = "h-4 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 16" className={className} aria-hidden>
      <circle cx="6" cy="8" r="6" fill="currentColor" opacity=".3" />
      <circle cx="14" cy="8" r="6" fill="currentColor" opacity=".6" />
      <circle cx="22" cy="8" r="6" fill="currentColor" />
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
  return <NavShell logo={<Logo />} />;
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="container-x flex flex-col gap-4 pb-24 pt-10 text-sm sm:pb-10 sm:flex-row sm:items-center sm:justify-between">
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
