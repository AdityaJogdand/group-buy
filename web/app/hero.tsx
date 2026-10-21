"use client";
// Hero panel: − / + add buyers, the group price on the right drops at each tier.
// Press feedback on pointer-down; hold a button to keep counting (Apple: respond on press, continuous feedback).
import { useEffect, useRef, useState } from "react";

// Matches the `headphones` product in lib/deals.ts.
const PRODUCT = { name: "Noise-cancelling headphones", seller: "Sound Supply" };
const LIST = 350;
const TIERS = [{ buyers: 10, price: 300 }, { buyers: 25, price: 270 }];
const MAX = 25;
const priceFor = (n: number) => TIERS.reduce((p, t) => (n >= t.buyers ? t.price : p), LIST);

export function Hero() {
  const [buyers, setBuyers] = useState(14);
  const hold = useRef<{ delay?: number; repeat?: number }>({});

  const step = (d: number) => setBuyers(n => Math.min(MAX, Math.max(1, n + d)));
  const stop = () => { clearTimeout(hold.current.delay); clearInterval(hold.current.repeat); };
  const start = (d: number) => {
    stop();
    step(d);
    hold.current.delay = window.setTimeout(() => { hold.current.repeat = window.setInterval(() => step(d), 90); }, 350);
  };
  useEffect(() => stop, []);

  const price = priceFor(buyers);
  const next = TIERS.find(t => t.buyers > buyers);

  // One tick of feedback when a tier unlocks.
  const lastPrice = useRef(price);
  useEffect(() => {
    if (price < lastPrice.current) navigator.vibrate?.(8);
    lastPrice.current = price;
  }, [price]);

  const press = (d: number) => ({
    onPointerDown: (e: React.PointerEvent) => { if (e.button === 0) start(d); },
    onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step(d); } },
  });

  return (
    <div className="grid flex-1 gap-12 pt-12 md:grid-cols-2 md:pt-16">
      {/* Left: message + buyer control */}
      <div className="flex flex-col justify-between gap-12">
        <div>
          <h1 className="condensed text-[clamp(3rem,6.4vw,5.5rem)] uppercase leading-[0.92]">Every buyer<br />shrinks the<br />price.</h1>
          <p className="mt-10 max-w-md text-xl leading-snug md:mt-24">
            Pool with strangers. PayPal holds your max. Everyone pays the group price, or nobody pays.
          </p>
        </div>

        <div className="sm:max-w-md">
        {/* One box per seat in the group; tap a box to jump there. The −/+ buttons are the accessible control. */}
        <div aria-hidden className="mb-8 grid grid-cols-13 gap-1.5">
          {Array.from({ length: MAX }, (_, i) => (
            <span key={i} onClick={() => setBuyers(i + 1)}
              className={`aspect-square cursor-pointer rounded-[22%] border-2 border-ink transition-[background-color,transform] duration-150 active:scale-90 ${
                i < buyers ? "bg-ink" : ""}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <button type="button" aria-label="Remove a buyer" disabled={buyers === 1} {...press(-1)}
            className="press grid size-[4.5rem] shrink-0 select-none place-items-center rounded-full border-2 border-ink text-3xl disabled:opacity-30">−</button>
          <p className="text-center" aria-live="polite">
            <span key={buyers} className="price-in condensed block text-6xl tabular-nums leading-none">{buyers}</span>
            <span className="mt-1 block text-sm font-semibold uppercase tracking-[0.12em]">{buyers === 1 ? "buyer" : "buyers"}</span>
          </p>
          <button type="button" aria-label="Add a buyer" disabled={buyers === MAX} {...press(1)}
            className="press grid size-[4.5rem] shrink-0 select-none place-items-center rounded-full bg-ink text-3xl text-lime disabled:opacity-30">+</button>
        </div>
        </div>
      </div>

      {/* Right: live group price */}
      <div className="flex flex-col items-start justify-between gap-10 md:items-end">
        <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-lime">
          <span className="size-2 animate-pulse rounded-full bg-lime" /> Ends in 2d 14h
        </span>

        <div className="md:text-right">
          <p className="text-lg font-medium">{PRODUCT.name} · {PRODUCT.seller}</p>
          <p className="condensed mt-2 text-[clamp(6.5rem,17vw,15rem)] leading-[0.82] tabular-nums">
            <span key={price} className="price-in inline-block">${price}</span>
          </p>
          <p className="mt-4 text-xl font-semibold">
            {price < LIST ? <>Save ${LIST - price} each · <s className="font-normal opacity-60">${LIST}</s></> : "Solo price"}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 md:justify-end">
            {[{ buyers: 1, price: LIST }, ...TIERS].map(t => (
              <li key={t.buyers}>
                <button type="button" onClick={() => setBuyers(t.buyers)}
                  className={`press rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-semibold tabular-nums ${
                    price === t.price ? "bg-ink text-lime" : ""}`}>
                  ${t.price} · {t.buyers === 1 ? "solo" : `${t.buyers}+`}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <a href="#how" className="press rounded-full bg-ink px-7 py-4 text-lg font-semibold text-lime">Join at ${price} →</a>
          <p className="text-sm font-medium">
            {next ? `${next.buyers - buyers} more unlock $${next.price} for everyone` : "Best price unlocked"}
          </p>
        </div>
      </div>
    </div>
  );
}
