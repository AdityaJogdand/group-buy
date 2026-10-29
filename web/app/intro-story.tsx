"use client";
// "What is Group Buy?" as a self-playing story card. It grows from the bottom as it scrolls into view, then runs its four
// scenes like a video on one clock: hover pauses it, leaving resumes it, and scrolling away never blocks the page.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionStyle } from "framer-motion";

const SCENE_MS = 5600;
const TIERS: [number, number][] = [[1, 350], [10, 300], [25, 270]]; // buyers from, price: the headphones in lib/deals.ts
const MAX = 320; // what the example buyer holds
const BUYERS: [string, number][] = [["AK", 320], ["RS", 310], ["PD", 330], ["SN", 305], ["TB", 325], ["EC", 315]];
const priceAt = (n: number) => TIERS.reduce((p, [from, price]) => (n >= from ? price : p), TIERS[0][1]);
const GROUP = priceAt(25);

// Counts through `times` (ms after mount) and returns how many have passed.
function useSteps(times: number[]) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const ids = times.map((t, i) => setTimeout(() => setN(i + 1), t));
    return () => ids.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

const chip = "rounded-full px-2.5 py-1 text-xs tabular-nums";
const dashed = `${chip} border border-dashed border-ink/50`;
const tile = "rounded-xl bg-panel shadow-[inset_0_0_0_1px_var(--line)]";

// 1. Buyers who want the same thing, going straight to one seller.
function Find() {
  return (
    <div className="flex h-full items-center justify-between gap-3">
      <ul className="grid gap-2">
        {BUYERS.slice(0, 5).map(([who, max], i) => (
          <motion.li key={who} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.28, type: "spring", stiffness: 220, damping: 22 }}
            className={`flex items-center gap-2 px-2.5 py-1.5 ${tile}`}>
            <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[10px] font-medium">{who}</span>
            <span className="text-xs text-muted">max</span><span className="text-sm font-medium tabular-nums">${max}</span>
          </motion.li>
        ))}
      </ul>
      <svg viewBox="0 0 60 100" className="h-28 w-12 shrink-0 text-ink/50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <motion.path d="M2 8C30 8 30 50 56 50M2 29C26 29 30 50 56 50M2 50H56M2 71C26 71 30 50 56 50M2 92C30 92 30 50 56 50" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.7, duration: 1 }} />
      </svg>
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.5, type: "spring", stiffness: 200, damping: 20 }}
        className={`w-28 shrink-0 overflow-hidden text-center ${tile}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/products/audio.jpg" alt="" className="aspect-[4/3] w-full object-cover" />
        <p className="px-2 pt-2 text-xs font-medium">Headphones</p>
        <p className="px-2 pb-2 text-[11px] text-muted">Direct from the seller</p>
      </motion.div>
    </div>
  );
}

// 2. A hold: the amount is reserved, the balance is untouched.
function Hold() {
  const step = useSteps([1300, 2400]);
  return (
    <div className="grid h-full place-items-center">
      <div className="w-full max-w-[16rem]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className={`relative p-4 text-center ${tile}`}>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="absolute inset-1.5 rounded-lg border border-dashed border-ink/40" />
          <p className="text-xs text-muted">Your hold · authorized by PayPal</p>
          <p className="mt-1 text-4xl font-medium tabular-nums tracking-tight">${MAX}</p>
          <svg viewBox="0 0 24 24" className="mx-auto mt-2 size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M7 11V8a5 5 0 0 1 10 0v3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6, duration: 0.6 }} />
            <motion.path d="M6 11h12v9H6z" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} />
          </svg>
        </motion.div>
        <dl className="mt-3 grid gap-1.5 text-sm">
          {([["Held", `$${MAX}`, step >= 1], ["Charged now", "$0", step >= 2]] as const).map(([k, v, on]) => (
            <motion.div key={k} initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 8 }} className={`flex justify-between px-3 py-2 ${tile}`}>
              <dt className="text-muted">{k}</dt><dd className="font-medium tabular-nums">{v}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// 3. The group fills and the price steps down for everyone.
function Fill() {
  const seats = 25;
  const n = useSteps(Array.from({ length: seats }, (_, i) => 300 + i * 130));
  const price = priceAt(Math.max(1, n));
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex items-end justify-between">
        <p className="tabular-nums">
          <span className="block text-xs text-muted">Everyone pays</span>
          <span key={price} className="price-in inline-block text-5xl font-medium tracking-tight">${price}</span>
        </p>
        <p className="pb-1 text-sm tabular-nums text-muted">{n} of {seats} joined</p>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: seats }, (_, i) => (
          <motion.span key={i} initial={false} animate={{ backgroundColor: i < n ? "var(--ink)" : "color-mix(in srgb, var(--ink) 10%, transparent)", scale: i === n - 1 ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.25 }} className="aspect-square rounded-[4px]" />
        ))}
      </div>
      <p className="flex justify-between text-[11px] tabular-nums text-muted">{TIERS.map(([from, p]) => <span key={from}>{from} buyer{from > 1 ? "s" : ""} · ${p}</span>)}</p>
    </div>
  );
}

// 4. It closes: every hold becomes a payment at the same group price, together.
function Close() {
  const closed = useSteps([1500]) >= 1; // one flag drives every chip, so they flip in the same frame
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="grid grid-cols-2 gap-2">
        {BUYERS.map(([who, max]) => (
          <div key={who} className={`flex items-center justify-between gap-2 px-2.5 py-2 ${tile}`}>
            <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[10px] font-medium">{who}</span>
            <motion.span key={String(closed)} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.3 }}
              className={`whitespace-nowrap ${closed ? `${chip} bg-save/15 text-save` : dashed}`}>{closed ? <><span className="max-sm:hidden">paid ${GROUP} · </span>saved ${max - GROUP}</> : `$${max} held`}</motion.span>
          </div>
        ))}
      </div>
      <motion.p initial={false} animate={{ opacity: closed ? 1 : 0, y: closed ? 0 : 8 }} className="text-center text-2xl font-medium tabular-nums tracking-tight">${GROUP} each, paid together</motion.p>
      <p className="text-center text-xs text-muted">If the group had missed its minimum, every hold would be released and nobody pays.</p>
    </div>
  );
}

const SCENES = [
  { title: "Find your group", body: "People who want the same thing find each other, and buy straight from the seller. Each says the most they'll pay.", Visual: Find },
  { title: "A hold, not a charge", body: "PayPal authorizes your max and keeps it aside. Nothing is charged while the group is still forming.", Visual: Hold },
  { title: "The price drops as it fills", body: "Every buyer who joins lowers the price for everyone, including the people who joined first.", Visual: Fill },
  { title: "Everyone pays the same", body: "When the group closes, every hold is captured at one group price, never above your max.", Visual: Close },
];

const N = SCENES.length;
const LOOP_MS = N * SCENE_MS;

// The card's insides: scenes roll up as the story advances (down if it goes back).
function Panel({ t, dir, paused, go }: { t: number; dir: number; paused: boolean; go: (i: number) => void }) {
  const scene = Math.floor(t / SCENE_MS);
  const { title, body, Visual } = SCENES[scene];
  const roll = { enter: (d: number) => ({ y: 56 * d, opacity: 0 }), center: { y: 0, opacity: 1 }, exit: (d: number) => ({ y: -56 * d, opacity: 0 }) };
  return (
    <div className="flex h-full flex-col p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {SCENES.map((s, i) => (
            <button key={s.title} aria-label={s.title} onClick={() => go(i)} className="h-4 flex-1">
              <span className="block h-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(i < scene ? 1 : i === scene ? (t - i * SCENE_MS) / SCENE_MS : 0) * 100}%` }} />
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm tabular-nums text-muted">{paused ? "Paused" : `${scene + 1} of ${N}`}</p>
      </div>
      <div className="relative mt-6 flex flex-1 flex-col justify-center">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div key={scene} custom={dir} variants={roll} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 140, damping: 22 }}
            className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <h3 className="display text-3xl sm:text-5xl">{title}</h3>
              <p className="mt-3 max-w-md leading-relaxed text-muted sm:text-lg">{body}</p>
            </div>
            <div className="h-[15.5rem] overflow-hidden rounded-2xl bg-raised p-4 shadow-[inset_0_0_0_1px_var(--line)] md:h-[19rem]" aria-hidden><Visual /></div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function IntroStory({ head }: { head: React.ReactNode }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  // The card opens as it climbs from the bottom of the screen up to 35% from the top.
  const { scrollYProgress } = useScroll({ target: box, offset: ["start end", "start 35%"] });
  const grow = useTransform(scrollYProgress, [0, 1], [0, 1], { clamp: true });
  const ready = useInView(box, { once: true, margin: "0px 0px -25% 0px" }); // scene 0 starts as the card arrives
  const onscreen = useInView(box);
  const [hover, setHover] = useState(false);
  const [t, setT] = useState(0); // ms into the loop: the one clock
  const playing = !reduce && onscreen && !hover;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 100);
      last = now;
      setT(v => (v + dt) % LOOP_MS);
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  const scene = Math.floor(t / SCENE_MS);
  const prev = useRef(0), dir = useRef(1);
  if (scene !== prev.current) { dir.current = scene > prev.current || (prev.current === N - 1 && scene === 0) ? 1 : -1; prev.current = scene; }
  const go = (i: number) => setT(i * SCENE_MS);

  const card = { "--g": grow, width: "calc(80% + 20% * var(--g))", borderRadius: "calc(32px - 14px * var(--g))", opacity: "calc(0.35 + 0.65 * var(--g))", transform: "translateY(calc((1 - var(--g)) * 5rem))" } as MotionStyle;
  return (
    <MotionConfig reducedMotion="user">
      <section id="intro" className="py-24 sm:py-32">
        <div className="container-x">
          {head}
          <div ref={box} className="mt-12">
            {/* .flip: the surface uses the opposite theme, so it reads as a pane of the other colour over the page. */}
            <motion.div className="glass flip relative mx-auto h-[38rem] overflow-hidden md:h-[34rem]" style={reduce ? { borderRadius: 18 } : card}
              onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
              {ready || reduce ? <Panel t={t} dir={dir.current} paused={hover} go={go} /> : null}
            </motion.div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
