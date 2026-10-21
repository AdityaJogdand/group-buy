"use client";
// Hero: drag across 20 people; the price drops at each tier. The row of people *is* the slider track.
// Feel (Apple, Designing Fluid Interfaces): 1:1 tracking with grab offset, rubber-band past the ends,
// momentum projection on release, critically damped spring that starts from the current value and velocity.
import { useCallback, useEffect, useRef, useState } from "react";

const SEATS = 20;
const LIST = 200;
const TIERS = [{ buyers: 10, price: 180 }, { buyers: 20, price: 160 }];
const priceFor = (n: number) => TIERS.reduce((p, t) => (n >= t.buyers ? t.price : p), LIST);

// x is in seat units: 0 = first seat, SEATS - 1 = last.
const project = (v: number, d = 0.998) => (v / 1000) * d / (1 - d);
const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const clamp = (x: number) => Math.min(SEATS - 1, Math.max(0, x));

export function PoolSlider() {
  const track = useRef<HTMLDivElement>(null);
  const x = useRef(0);       // presentation value (seat units)
  const v = useRef(0);       // velocity (seat units / s)
  const target = useRef(0);
  const raf = useRef(0);
  const drag = useRef<{ offset: number; hist: { t: number; x: number }[] } | null>(null);
  const [pos, setPos] = useState(0);

  const seatWidth = () => (track.current?.clientWidth ?? 1) / (SEATS - 1);

  // Critically damped spring (damping 1.0, response 0.4s), integrated per frame.
  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const w = (2 * Math.PI) / 0.4;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      v.current += (-w * w * (x.current - target.current) - 2 * w * v.current) * dt;
      x.current += v.current * dt;
      setPos(x.current);
      if (Math.abs(x.current - target.current) > 0.002 || Math.abs(v.current) > 0.01) raf.current = requestAnimationFrame(tick);
      else { x.current = target.current; v.current = 0; setPos(x.current); }
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  const goTo = useCallback((seat: number) => { target.current = clamp(Math.round(seat)); run(); }, [run]);

  // Hint that it's draggable: glide to the first tier once. Any touch interrupts it.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { x.current = target.current = 9; setPos(9); return; }
    const id = setTimeout(() => goTo(9), 700);
    return () => { clearTimeout(id); cancelAnimationFrame(raf.current); };
  }, [goTo]);

  const seatAt = (clientX: number) => (clientX - track.current!.getBoundingClientRect().left) / seatWidth();

  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(raf.current); // interrupt: continue from the on-screen value
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = seatAt(e.clientX);
    // Grabbing the thumb keeps the grab offset; tapping the track jumps there.
    const offset = Math.abs(at - x.current) < 0.8 ? at - x.current : 0;
    drag.current = { offset, hist: [{ t: performance.now(), x: x.current }] };
    if (!offset) { x.current = clamp(at); setPos(x.current); }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const raw = seatAt(e.clientX) - drag.current.offset;
    const max = SEATS - 1;
    x.current = raw < 0 ? -rubberband(-raw, max) : raw > max ? max + rubberband(raw - max, max) : raw;
    setPos(x.current);
    const h = drag.current.hist;
    h.push({ t: performance.now(), x: x.current });
    if (h.length > 5) h.shift();
  };
  const onUp = () => {
    if (!drag.current) return;
    const h = drag.current.hist;
    const a = h[0], b = h[h.length - 1];
    const vel = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    drag.current = null;
    v.current = vel; // hand the finger's velocity to the spring
    goTo(x.current + project(vel * seatWidth()) / seatWidth());
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) { e.preventDefault(); goTo(target.current + step); }
    if (e.key === "Home") goTo(0);
    if (e.key === "End") goTo(SEATS - 1);
  };

  const buyers = Math.round(clamp(pos)) + 1;
  const price = priceFor(buyers);
  const next = TIERS.find(t => t.buyers > buyers);

  return (
    <div className="mx-auto w-full max-w-3xl select-none">
      <div className="text-center">
        <p className="text-[clamp(4.5rem,14vw,9rem)] font-bold leading-none tracking-[-0.05em] tabular-nums">
          <span key={price} className="price-in inline-block">${price}</span>
        </p>
        <p className="mt-4 h-6 text-lg text-muted">
          {price < LIST
            ? <><span className="font-semibold text-save">Everyone saves ${LIST - price}</span> · {buyers} buyers</>
            : <>{buyers === 1 ? "1 buyer" : `${buyers} buyers`} · list price</>}
          {next && <span className="hidden sm:inline"> · ${next.price} at {next.buyers}</span>}
        </p>
      </div>

      <div
        ref={track}
        role="slider" tabIndex={0}
        aria-label="Buyers in the group" aria-valuemin={1} aria-valuemax={SEATS} aria-valuenow={buyers}
        aria-valuetext={`${buyers} buyers, $${price} each`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
        className="relative mx-3 mt-14 h-16 cursor-grab touch-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent/30 active:cursor-grabbing">
        {Array.from({ length: SEATS }, (_, i) => {
          const on = i < buyers;
          const tier = TIERS.find(t => t.buyers === i + 1);
          return (
            <span key={i} className="absolute top-1/2" style={{ left: `${(i / (SEATS - 1)) * 100}%` }}>
              <span className={`block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,transform] duration-200 sm:size-3.5 ${
                on ? (price < LIST ? "scale-110 bg-save" : "scale-110 bg-fg") : "bg-black/12"}`} />
              {tier && (
                <span className={`absolute left-0 top-5 whitespace-nowrap ${i === SEATS - 1 ? "-translate-x-full sm:-translate-x-1/2" : "-translate-x-1/2"} text-xs font-semibold tabular-nums transition-colors ${
                  buyers >= tier.buyers ? "text-save" : "text-muted"}`}>{tier.buyers} · ${tier.price}</span>
              )}
            </span>
          );
        })}
        {/* Thumb */}
        <span
          className="pointer-events-none absolute top-1/2 size-11 rounded-full border border-black/5 bg-white shadow-[0_4px_16px_rgb(0_0_0/0.18)]"
          style={{ left: `${(pos / (SEATS - 1)) * 100}%`, transform: "translate(-50%, -50%)", willChange: "left" }}>
          <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{buyers}</span>
        </span>
      </div>
      <p className="mt-10 text-center text-sm text-muted">Drag to add buyers</p>
    </div>
  );
}
