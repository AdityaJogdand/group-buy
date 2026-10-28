"use client";
// "Group lens": a shopping list priced solo. Under the lens, every price becomes the group price.
// Two identical text layers are stacked; the top one shows group prices and is clipped to a circle that follows
// the pointer (CSS clip-path, no re-layout). Each price is one grid cell holding both values, so both layers
// lay out the same and nothing moves. Touch drags the lens; the button reveals everything for keyboards.
// Prices are the catalog's best tiers (lib/deals.ts).
import { useEffect, useRef, useState } from "react";

type Part = string | { solo: number; group: number };
const LIST: Part[] = [
  "This month I'm buying noise-cancelling headphones for ", { solo: 350, group: 270 },
  ", a 75% mechanical keyboard for ", { solo: 150, group: 115 },
  ", a 27-inch 4K monitor for ", { solo: 400, group: 330 },
  " and the UX design course for ", { solo: 200, group: 160 }, ".",
];
const prices = LIST.filter((p): p is { solo: number; group: number } => typeof p !== "string");
const total = { solo: prices.reduce((a, p) => a + p.solo, 0), group: prices.reduce((a, p) => a + p.group, 0) };


function Text({ group }: { group: boolean }) {
  // Both values share one grid cell; the hidden one keeps the width so the two layers match exactly.
  const price = (p: { solo: number; group: number }) => (
    <span data-price className="inline-grid align-baseline tabular-nums">
      <span className={`[grid-area:1/1] ${group ? "invisible" : ""}`}>${p.solo}</span>
      {/* Negative margin = padding, so the tag never widens the cell (no gap before the comma). */}
      <span className={`[grid-area:1/1] -mx-1.5 rounded-md px-1.5 text-center ${group ? "bg-ink font-medium text-black" : "invisible"}`}>${p.group}</span>
    </span>
  );
  return (
    <div className="text-[clamp(1.5rem,3vw,2.5rem)] font-medium leading-[1.6] tracking-tight">
      <p>{LIST.map((part, i) => (typeof part === "string" ? <span key={i}>{part}</span> : <span key={i}>{price(part)}</span>))}</p>
      <p className="mt-6 border-t border-line pt-6 text-muted">
        Total <span className="text-ink">{price(total)}</span>
        <span className={group ? "" : "invisible"}> · you keep ${total.solo - total.group}</span>
      </p>
    </div>
  );
}

export function Lens() {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [all, setAll] = useState(false);

  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setAt({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  // Resting spot before the first touch: centred on the first price, so the idea shows on its own.
  const [rest, setRest] = useState({ x: 0, y: 0, r: 80 });
  useEffect(() => {
    const place = () => {
      const b = box.current, first = b?.querySelector("[data-price]");
      if (!b || !first) return;
      const [br, fr] = [b.getBoundingClientRect(), first.getBoundingClientRect()];
      setRest({ x: fr.left - br.left + fr.width / 2, y: fr.top - br.top + fr.height / 2, r: Math.min(92, Math.max(56, br.width * 0.12)) });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, []);
  const pos = at ?? rest;
  const r = rest.r;
  const clip = all ? "none" : `circle(${r}px at ${pos.x}px ${pos.y}px)`;

  return (
    <div className="card reveal p-6 sm:p-10">
      <div ref={box} onPointerMove={move} onPointerDown={e => { move(e); (e.target as Element).setPointerCapture?.(e.pointerId); }}
        className="relative cursor-none touch-none select-none">
        <Text group={false} />
        {/* Group-price layer, visible only inside the lens. */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ clipPath: clip }}>
          {/* No backdrop needed: each white tag covers the solo price beneath it, and the rest of the text is identical. */}
          <Text group />
        </div>
        {/* The lens rim. */}
        {!all && (
          <span aria-hidden className="pointer-events-none absolute rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.55),0_0_0_1px_rgba(0,0,0,0.6),0_18px_40px_rgba(0,0,0,0.6)]"
            style={{ width: r * 2, height: r * 2, left: pos.x - r, top: pos.y - r }} />
        )}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
        <span className="hidden sm:inline">Move over the list to see what the group pays.</span>
        <span className="sm:hidden">Drag over the list to see what the group pays.</span>
        <button type="button" onClick={() => setAll(a => !a)} aria-pressed={all} className="btn-ghost press px-4 py-2 text-ink">
          {all ? "Show solo prices" : "Show all group prices"}
        </button>
      </div>
      {/* Screen readers get the comparison directly. */}
      <p className="sr-only">
        Solo total ${total.solo}; group total ${total.group}. {prices.map(p => `$${p.solo} becomes $${p.group}`).join(", ")}.
      </p>
    </div>
  );
}
