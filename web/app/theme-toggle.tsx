"use client";
// Sun/moon button: flips data-theme on <html> and remembers the choice. The first paint is set by the script in layout.tsx.
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);
  const flip = () => {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setLight(!light);
  };
  return (
    <button onClick={flip} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} className="press grid size-9 place-items-center rounded-full text-ink/70 hover:text-ink">
      <svg viewBox="0 0 24 24" className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {light ? <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>}
      </svg>
    </button>
  );
}
