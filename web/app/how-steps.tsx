"use client";
// How it works: four cards that light up in order on one 12 s clock, each card playing its own live mock-up of that step.
// Every mock is a pure function of its local time (ms since its card lit), so retiming is changing STEP_MS or the offsets below.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const STEP_MS = 3000; // each card lights this long after the previous one
const HOLD_MS = 1800; // then everything rests, fades, and the loop restarts
const TOTAL = 4 * STEP_MS + HOLD_MS;
const FADE_MS = 500;

const STEPS = [
  { title: "Pick a group", body: "A product, a deadline, a solo price and cheaper prices as buyers join." },
  { title: "Hold your max", body: "PayPal holds the most you'd pay. It's a hold, not a charge." },
  { title: "The group fills", body: "Every new buyer pushes the price down for everyone already in." },
  { title: "Everyone pays the same", body: "At the deadline all holds are captured at one price, or all released." },
];

// Demo numbers: the headphones in lib/deals.ts.
const SOLO = 350, HOLD = 350, TIERS: [number, number][] = [[1, 350], [10, 300], [25, 270]], JOINED = 14, SEATS = 25;
const priceAt = (n: number) => TIERS.reduce((p, [from, price]) => (n >= from ? price : p), SOLO);
const CAPTURED = priceAt(10);
const BUYERS = ["Buyer 1", "Buyer 2", "Buyer 3"];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = (x: number) => 1 - (1 - x) ** 3;
// Fade/slide in once `local` passes `at`.
const rise = (local: number, at: number) => ({ opacity: local >= at ? 1 : 0, transform: local >= at ? "none" : "translateY(10px)" });
const rises = "transition-[opacity,transform] duration-500 ease-out";

function Pick({ local }: { local: number }) {
  return (
    <div className="mt-auto">
      <div className={`relative overflow-hidden rounded-xl ${rises}`} style={rise(local, 0)}>
        <Image src="/products/audio.jpg" alt="" width={400} height={300} className="aspect-[4/3] w-full object-cover" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur">Headphones</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs tabular-nums">
        {TIERS.map(([from, price], i) => (
          <li key={from} className={`rounded-full px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)] transition-colors duration-300 ${rises} ${i === 1 && local >= 1600 ? "bg-ink text-bg" : "text-muted"}`} style={rise(local, 400 + i * 250)}>
            {from === 1 ? "Solo" : `${from} buyers`} · ${price}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hold({ local }: { local: number }) {
  const amount = Math.round(HOLD * ease(clamp01((local - 300) / 1000)));
  return (
    <div className="mt-auto">
      <div className={`relative rounded-2xl bg-raised p-4 shadow-[inset_0_0_0_1px_var(--line)] ${rises}`} style={rise(local, 0)}>
        <span className="absolute inset-1.5 rounded-xl border border-dashed border-ink/40 transition-opacity duration-500" style={{ opacity: local >= 500 ? 1 : 0 }} />
        <div className="relative flex justify-between text-xs uppercase tracking-wider text-muted"><span>PayPal hold</span><span>Authorized</span></div>
        <p className="relative mt-3 text-4xl font-medium tabular-nums">${amount}.00</p>
        <p className="relative mt-1.5 text-sm text-muted transition-opacity duration-500" style={{ opacity: local >= 1600 ? 1 : 0 }}>Held, not charged</p>
      </div>
      <p className="mt-3 flex justify-between rounded-xl px-4 py-2.5 text-sm shadow-[inset_0_0_0_1px_var(--line)] transition-opacity duration-500" style={{ opacity: local >= 2000 ? 1 : 0 }}>
        <span className="text-muted">Charged now</span><span className="font-medium tabular-nums">$0</span>
      </p>
    </div>
  );
}

function Fill({ local }: { local: number }) {
  const n = Math.round(JOINED * clamp01((local - 200) / 2200));
  return (
    <div className="mt-auto">
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: SEATS }, (_, i) => <span key={i} className={`aspect-square rounded-[3px] transition-colors duration-200 ${i < n ? "bg-ink" : "bg-white/10"}`} />)}
      </div>
      <p className="mt-4 flex items-baseline justify-between text-sm tabular-nums">
        <span className="text-muted">{n} joined · {SEATS - n} to go</span>
        <span key={priceAt(n)} className="price-in text-lg font-medium">${priceAt(n)}</span>
      </p>
    </div>
  );
}

function Pay({ local }: { local: number }) {
  const paid = local >= 1200; // one flag drives every row, so they flip in the same frame
  return (
    <div className="mt-auto">
      <ul className="grid gap-2 text-sm">
        {BUYERS.map((b, i) => (
          <li key={b} className={`flex items-center justify-between rounded-xl bg-raised px-4 py-3 ${rises}`} style={rise(local, i * 200)}>
            <span className="text-muted">{b}</span>
            <span key={String(paid)} className={`tabular-nums ${paid ? "pop-in font-medium text-save" : "rounded-full border border-dashed border-ink/40 px-2 py-0.5 text-xs"}`}>
              {paid ? `$${CAPTURED} captured` : `$${HOLD} held`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted transition-opacity duration-500" style={{ opacity: local >= 2000 ? 1 : 0 }}>Missed the minimum? Every hold is released and nobody pays.</p>
    </div>
  );
}
const MOCKS = [Pick, Hold, Fill, Pay];

export function HowSteps() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const [onscreen, setOnscreen] = useState(false);
  const [t, setT] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOnscreen(e.isIntersecting), { threshold: 0.25 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  // One clock, only while the cards are on screen.
  useEffect(() => {
    if (reduce || !onscreen) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 100);
      last = now;
      setT(v => {
        const next = v + dt;
        if (next < TOTAL) return next;
        setLoop(l => l + 1);
        return 0;
      });
    }, 50);
    return () => clearInterval(id);
  }, [reduce, onscreen]);

  const now = reduce ? TOTAL - FADE_MS - 1 : t;
  const fade = reduce ? 1 : Math.min(1, now / 350, (TOTAL - now) / FADE_MS);
  return (
    <ol ref={ref} className="mx-auto mt-14 grid max-w-[1280px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => {
        const local = now - i * STEP_MS; // < 0: not lit yet
        const Mock = MOCKS[i];
        return (
          <li key={s.title} className="card reveal flex min-h-[30rem] flex-col overflow-hidden p-6 transition-opacity duration-500 sm:p-7" style={{ opacity: local >= 0 ? 1 : 0.45 }}>
            {/* This card's own progress line: fills while it is the current step, then stays full. */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left bg-ink" style={{ transform: `scaleX(${clamp01(local / STEP_MS)})`, opacity: fade }} />
            <h3 className="text-balance text-center text-2xl font-medium tracking-tight">{s.title}</h3>
            <p className="mt-3 text-pretty text-center text-base leading-relaxed text-muted">{s.body}</p>
            <div key={loop} className="mt-6 flex flex-1 flex-col" style={{ opacity: fade }}>
              {local >= 0 && <Mock local={local} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
