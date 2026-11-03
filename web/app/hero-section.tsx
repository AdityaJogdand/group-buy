"use client";
// Hero: copy on the left, one card on the right that keeps transforming (alone, others join, one bulk order, everyone pays).
// One clock `t` drives the 10 s loop; every pose, price and label below is a pure function of it.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MotionConfig, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import "./intro.css";

type Pose = { x: number; y: number; z: number; rotate: number; scale: number; opacity: number }; // x, y in % of the card

const CONFIG = {
  copy: {
    title: "Buy together. Go direct. Pay less.",
    sub: "Group Buy connects people who want the same thing straight to the seller, so volume earns everyone a better price. PayPal holds each buyer's max without charging it, and captures it at the group price only if the deal closes.",
    cta: "Join a deal",
    trust: "Nobody pays unless the deal happens.",
  },
  product: "UX Design Course",
  list: 200,
  final: 140,
  total: 20,
  you: { max: 160 },
  // The four other cards: initials and the most each holds (savings = max - final).
  buyers: [{ who: "PR", max: 175 }, { who: "AJ", max: 168 }, { who: "SK", max: 152 }, { who: "MT", max: 171 }],
  // Scene 2: each arriving card moves the price down a step and the joined count up.
  prices: [180, 165, 155, 155],
  joined: [5, 9, 14, 19],
  arrive: [2300, 2900, 3500, 4100], // ms on the loop clock
  // Scenes, ms: alone, others join, bulk order, everyone pays, return.
  scenes: [2000, 2500, 1500, 3000, 1000],
  rail: ["Hold your max", "Pool with others", "Everyone pays less"],
  railStep: [0, 1, 1, 2, 0],
  spring: { stiffness: 120, damping: 18 },
  // Poses (x, y in % of the card; z in px; rotate in degrees). Index i-1 is card i behind the front one.
  hidden: { x: 0, y: -4, z: -200, rotate: 0, scale: 0.92, opacity: 0 } as Pose,
  deck: [{ x: -16, y: -7, z: -40, rotate: -7, scale: 0.96, opacity: 1 }, { x: 16, y: -7, z: -40, rotate: 7, scale: 0.96, opacity: 1 },
         { x: -30, y: -13, z: -80, rotate: -13, scale: 0.92, opacity: 1 }, { x: 30, y: -13, z: -80, rotate: 13, scale: 0.92, opacity: 1 }] as Pose[],
  bulk: { front: 1.1, others: [{ x: 0, y: -3.2, z: -10, rotate: 0, scale: 1.07, opacity: 1 }, { x: 0, y: -6.4, z: -20, rotate: 0, scale: 1.04, opacity: 1 },
         { x: 0, y: -9.6, z: -30, rotate: 0, scale: 1.01, opacity: 1 }, { x: 0, y: -9.6, z: -40, rotate: 0, scale: 1.01, opacity: 0 }] as Pose[] },
  fan: {
    wide: { front: 1.04, others: [{ x: -52, y: 4, z: -20, rotate: -8, scale: 0.64, opacity: 1 }, { x: 52, y: 4, z: -20, rotate: 8, scale: 0.64, opacity: 1 },
            { x: -82, y: 14, z: -40, rotate: -17, scale: 0.5, opacity: 1 }, { x: 82, y: 14, z: -40, rotate: 17, scale: 0.5, opacity: 1 }] as Pose[] },
    compact: { front: 1, others: [{ x: -40, y: 4, z: -20, rotate: -8, scale: 0.5, opacity: 1 }, { x: 40, y: 4, z: -20, rotate: 8, scale: 0.5, opacity: 1 },
               { x: -40, y: 4, z: -40, rotate: -8, scale: 0.48, opacity: 0 }, { x: 40, y: 4, z: -40, rotate: 8, scale: 0.48, opacity: 0 }] as Pose[] },
  },
  tiltDeg: 6,
};

const STARTS = CONFIG.scenes.reduce<number[]>((a, d, i) => [...a, a[i] + d], [0]);
const TOTAL = STARTS[CONFIG.scenes.length];
const at = (scene: number, off = 0) => STARTS[scene] + off;
const CLOSED_FRAME = at(3, 1500); // first paint, SSR and reduced motion show everyone paid, fanned out
const ease = [0.22, 1, 0.36, 1] as const;
const transition = { default: { type: "spring", ...CONFIG.spring }, opacity: { duration: 0.5, ease } } as const;

const phone = () => window.matchMedia("(max-width: 639px)").matches;
const onPhone = (cb: () => void) => { const m = window.matchMedia("(max-width: 639px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

// A price whose digits roll like an odometer: each column is a strip of 0-9 that slides to its digit.
function Roll({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`$${value}`}>
      <span aria-hidden>$</span>
      {String(value).split("").map((d, i) => (
        <span key={i} aria-hidden className="relative inline-block h-[1em] w-[0.6em] overflow-hidden">
          <motion.span className="absolute inset-x-0 top-0 flex flex-col" initial={false} animate={{ y: `${-Number(d) * 10}%` }} transition={{ type: "spring", stiffness: 150, damping: 22 }}>
            {Array.from({ length: 10 }, (_, n) => <span key={n} className="block h-[1em] text-center leading-none">{n}</span>)}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

const badge = "rounded-full border px-[2.6cqw] py-[1cqw] text-[3.6cqw] font-medium leading-none whitespace-nowrap";
const held = `${badge} border-dashed border-accent text-accent`;
const paid = `${badge} border-transparent bg-save text-[#fff]`;

export function HeroSection() {
  const reduce = useReducedMotion();
  const compact = useSyncExternalStore(onPhone, phone, () => false);
  const ref = useRef<HTMLElement>(null);
  const [onscreen, setOnscreen] = useState(true);
  const [t, setT] = useState(CLOSED_FRAME); // the one clock
  const tiltX = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOnscreen(e.isIntersecting));
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduce || !onscreen) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 100); // a backgrounded tab must not skip scenes
      last = now;
      setT(v => (v + dt) % TOTAL);
    }, 40);
    return () => clearInterval(id);
  }, [reduce, onscreen]);

  // Tilt toward the mouse, on devices that hover.
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 2 * CONFIG.tiltDeg);
    tiltX.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * CONFIG.tiltDeg);
  };
  const untilt = () => { tiltX.set(0); tiltY.set(0); };

  // Everything below is a pure function of `now`.
  const now = reduce ? CLOSED_FRAME : t;
  const scene = STARTS.findIndex((s, i) => now >= s && now < STARTS[i + 1]);
  const arrived = CONFIG.arrive.filter(a => now >= a).length; // cards that have slid in
  const closed = scene === 3;
  const fan = compact ? CONFIG.fan.compact : CONFIG.fan.wide;
  const pose = (i: number): Pose => {
    if (i === 0) return { x: 0, y: 0, z: 0, rotate: 0, scale: scene === 2 ? CONFIG.bulk.front : closed ? fan.front : 1, opacity: 1 };
    if (scene === 1) return i <= arrived ? CONFIG.deck[i - 1] : CONFIG.hidden;
    if (scene === 2) return CONFIG.bulk.others[i - 1];
    if (scene === 3) return fan.others[i - 1];
    return CONFIG.hidden; // alone, and the glide back at the end of the loop
  };
  const price = scene === 2 || closed ? CONFIG.final : scene === 1 && arrived ? CONFIG.prices[arrived - 1] : CONFIG.list;
  const joined = scene === 2 || closed ? CONFIG.total : scene === 1 && arrived ? CONFIG.joined[arrived - 1] : 1;
  const status = closed ? "Charged together" : scene === 2 ? "Agents agreed" : scene === 1 && arrived ? `${joined} of ${CONFIG.total} joined` : "Buying alone";
  const name = scene === 2 ? `Bulk order · ${CONFIG.total} seats` : CONFIG.product;
  const stack = scene === 1 && arrived || scene === 2;
  const shown = compact ? 2 : CONFIG.buyers.length; // cards visible in the fan
  const others = CONFIG.total - 1 - shown;
  const youSaved = CONFIG.you.max - CONFIG.final;

  return (
    <MotionConfig reducedMotion="user">
      <section ref={ref} className="relative isolate overflow-hidden">
        <div className="container-x grid items-center gap-12 py-14 lg:grid-cols-[2fr_3fr] lg:gap-6 lg:py-20 lg:min-h-[calc(100svh-3.5rem)]">
          <div>
            <h1 className="display text-[clamp(2.5rem,5vw,4rem)] text-balance">
              <span className="intro inline-block">{CONFIG.copy.title}</span>
            </h1>
            <p className="intro mt-6 max-w-md text-lg text-muted [--d:260ms]">{CONFIG.copy.sub}</p>
            <div className="intro mt-9 [--d:420ms]">
              <a href="/listed-product" className="btn press px-6 py-3">{CONFIG.copy.cta}</a>
              <p className="mt-4 text-sm text-muted">{CONFIG.copy.trust}</p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[40rem] select-none">
            <div className="relative h-[16rem] sm:h-[22rem]" style={{ perspective: 1200 }} onPointerMove={tilt} onPointerLeave={untilt}
              role="img" aria-label={`One course card: alone it costs $${CONFIG.list}, others join and the price drops, the group becomes one bulk order, then all ${CONFIG.total} pay $${CONFIG.final} together. Money is held, not charged, until the deal closes.`}>
              <motion.div className="absolute inset-0" style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }}>
                <motion.div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }} animate={reduce ? undefined : { y: [0, -4, 0, 4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                  {[0, 1, 2, 3, 4].map(i => {
                    const p = pose(i), b = CONFIG.buyers[i - 1];
                    const saved = i === 0 ? youSaved : b?.max - CONFIG.final;
                    return (
                      <motion.div key={i} initial={false} transition={transition} style={{ zIndex: 10 - i }}
                        animate={{ x: `${p.x}%`, y: `${p.y}%`, z: p.z, rotate: p.rotate, scale: p.scale, opacity: p.opacity }}
                        className="morph-card absolute left-1/2 top-[44%] aspect-[8/5] w-[15rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] [container-type:inline-size] sm:w-[20rem]">
                        <div className="relative flex h-full flex-col justify-between p-[6cqw]">
                          {i === 0 ? (
                            <>
                              <p className="text-[4.4cqw] font-medium text-muted">{name}</p>
                              <p className="text-[17cqw] font-semibold leading-none tracking-[-0.04em] tabular-nums"><Roll value={price} /></p>
                              <p key={status} className="price-in text-[4.2cqw] text-muted">{status}</p>
                              <div className="flex items-center justify-between gap-2">
                                <span key={`${closed}-${scene}`} className={`price-in ${closed ? paid : held}`}>
                                  {closed ? `You · saved $${youSaved}` : scene === 2 ? "Held until close" : `You · $${CONFIG.you.max} held`}
                                </span>
                                {stack && (
                                  <span className="flex items-center text-[3.6cqw] font-medium tabular-nums text-muted">
                                    {CONFIG.buyers.slice(0, Math.min(arrived || 3, 3)).map(({ who }, n) => (
                                      <span key={who} className="-ml-[1.6cqw] grid size-[6.4cqw] place-items-center rounded-full border border-[var(--surface)] bg-raised text-[2.4cqw] first:ml-0" style={{ zIndex: 3 - n }}>{who}</span>
                                    ))}
                                    <span className="ml-[1.4cqw]">+{joined - 1}</span>
                                  </span>
                                )}
                              </div>
                              {/* One soft light sweep as the deck becomes a single bulk order. */}
                              {scene === 2 && <motion.span aria-hidden className="pointer-events-none absolute inset-0" initial={{ x: "-120%" }} animate={{ x: "120%" }} transition={{ duration: 0.8, ease }}
                                style={{ background: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.28) 50%, transparent 62%)" }} />}
                            </>
                          ) : (
                            <>
                              <span className="grid size-[9cqw] place-items-center rounded-full bg-raised text-[3.6cqw] font-medium">{b.who}</span>
                              <p className="text-[14cqw] font-semibold leading-none tracking-[-0.04em] tabular-nums">${price}</p>
                              <span className={`self-start ${closed ? paid : held}`}>{closed ? `Paid $${CONFIG.final} · saved $${saved}` : `$${b.max} held`}</span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.div>
              <p className={`absolute inset-x-0 bottom-1 text-center text-sm text-muted transition-opacity duration-500 ${closed ? "opacity-100" : "opacity-0"}`}>+{others} others</p>
            </div>

            <ol className="mt-6 grid grid-cols-3 gap-x-2 text-center text-xs sm:flex sm:justify-center sm:text-sm" aria-label="How a deal runs">
              {CONFIG.rail.map((r, i) => (
                <li key={r} aria-current={CONFIG.railStep[scene] === i} className={`transition-colors duration-300 ${CONFIG.railStep[scene] === i ? "text-ink" : "text-muted"}`}>
                  {r}{i < CONFIG.rail.length - 1 && <span className="ml-2 text-muted max-sm:hidden" aria-hidden>→</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
