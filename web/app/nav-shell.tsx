"use client";
// The nav. Full-width bar at the top; once the page scrolls it glides to the bottom and narrows into a floating glass pill.
// One box moves (translate, width, corner radius); the frosted and glass skins cross-fade; the two layouts cross-fade.
// The hamburger opens the same links in a panel (below the bar at the top, above the pill at the bottom).
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [["/#how", "How it works"], ["/#groups", "Groups"], ["/#claude", "Use with Claude"], ["/#faq", "FAQ"]];
const MOVE = "duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

function Burger({ open, onClick }: { open: boolean; onClick: () => void }) {
  const bar = "absolute inset-x-0 h-[1.5px] rounded bg-current transition-transform duration-300";
  return (
    <button onClick={onClick} aria-expanded={open} aria-controls="nav-menu" aria-label={open ? "Close menu" : "Open menu"} className="press grid size-9 place-items-center rounded-full">
      <span className="relative block h-[10px] w-[18px]" aria-hidden>
        <span className={`${bar} top-0`} style={{ transform: open ? "translateY(4.25px) rotate(45deg)" : "none" }} />
        <span className={`${bar} bottom-0`} style={{ transform: open ? "translateY(-4.25px) rotate(-45deg)" : "none" }} />
      </span>
    </button>
  );
}

export function NavShell({ logo }: { logo: React.ReactNode }) {
  const [on, setOn] = useState(false); // scrolled: docked pill
  const [open, setOpen] = useState(false); // menu panel
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const f = () => setOn(scrollY > 80);
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  useEffect(() => setOpen(false), [on]); // the panel changes sides when the bar moves, so close it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc); };
  }, [open]);

  const join = <a href="/#groups" className="btn press whitespace-nowrap px-4 py-1.5 text-sm">Join a group</a>;
  // A layout fades out at once and the other fades in after the box has mostly moved.
  const layer = (show: boolean) => ({ opacity: show ? 1 : 0, transitionDelay: show ? "320ms" : "0ms" });
  const fadeCls = "col-start-1 row-start-1 transition-opacity duration-300";

  return (
    <>
      <div className="h-14" /> {/* the bar is fixed, so keep its room in the page */}
      {/* Refraction for the glass (Chromium; other browsers keep the plain blur). */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <header className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-transform ${MOVE}`}
        style={{ transform: on ? "translateY(calc(100svh - 100% - 1.25rem))" : "none" }}>
        <div ref={box} className={`pointer-events-auto relative w-full transition-[max-width,margin] ${MOVE} ${on ? "mx-4 max-w-[26rem]" : "mx-0 max-w-[100vw]"}`}>
          <nav aria-label="Main" className={`relative transition-[border-radius] ${MOVE} ${on ? "rounded-2xl" : "rounded-none"}`}>
            <span aria-hidden className="material absolute inset-0 rounded-[inherit] border-b border-line transition-opacity duration-500" style={{ opacity: on ? 0 : 1 }} />
            <span aria-hidden className="glass absolute inset-0 rounded-[inherit] transition-opacity duration-500" style={{ opacity: on ? 1 : 0 }} />
            <div className="relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[inherit]">
              <div className={`container-x flex h-14 w-full items-center justify-between gap-4 ${fadeCls} ${on ? "pointer-events-none" : ""}`} style={layer(!on)} inert={on}>
                {logo}
                <div className="hidden items-center gap-7 text-sm text-ink/70 md:flex">
                  {LINKS.slice(0, 3).map(([href, label]) => <a key={href} href={href} className="hover:text-ink">{label}</a>)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden md:block"><ThemeToggle /></span>
                  {join}
                  <span className="md:hidden"><Burger open={open} onClick={() => setOpen(o => !o)} /></span>
                </div>
              </div>
              {/* Docked: the logo sits in the middle, the sides balance it. */}
              <div className={`grid h-14 w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 ${fadeCls} ${on ? "" : "pointer-events-none"}`} style={layer(on)} inert={!on}>
                <div className="flex"><Burger open={open} onClick={() => setOpen(o => !o)} /></div>
                {logo}
                <div className="flex justify-end">{/* concentric with the pill: its 16px corner minus the ~10px gap */}<a href="/#groups" style={{ borderRadius: 9 }} className="btn press whitespace-nowrap px-4 py-1.5 text-sm">Join a group</a></div>
              </div>
            </div>
          </nav>

          <div id="nav-menu" inert={!open} className={`glass absolute z-10 rounded-2xl p-2 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            on ? "inset-x-0 bottom-full mb-2 origin-bottom" : "right-4 top-full mt-2 w-64 origin-top-right md:right-6"} ${
            open ? "translate-y-0 scale-100 opacity-100" : `pointer-events-none scale-95 opacity-0 ${on ? "translate-y-2" : "-translate-y-2"}`}`}>
            <ul>
              {LINKS.map(([href, label]) => (
                <li key={href}><a href={href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 hover:bg-white/10">{label}</a></li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between border-t border-line px-4 pb-1 pt-2 text-sm text-muted">
              Theme <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
