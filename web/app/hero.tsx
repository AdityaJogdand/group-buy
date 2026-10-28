// Hero: headline and one white action, centered in the viewport over a valley of fine lines.
import { LiveCount } from "./groups";
import "./intro.css";

// No JS: the terrain is a static SVG generated here; motion elsewhere is CSS and stops under reduced motion.

// Valley lines: each is flat at the edges' height, dips to the center. Back lines are tall and faint,
// front lines low and brighter, so the stack reads as a floor receding into the light.
const LINES = Array.from({ length: 34 }, (_, i) => {
  const t = i / 33;
  const base = 300 + t * 300; // where the line sits at the center
  const rise = 260 * (1 - t) ** 1.4 + 30; // how high the edges climb
  return {
    d: `M -40 ${base - rise} C 300 ${base - rise}, 420 ${base}, 720 ${base} S 1140 ${base - rise}, 1480 ${base - rise}`,
    o: 0.05 + t * 0.22,
  };
});

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <svg aria-hidden viewBox="0 0 1440 640" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 -z-10 h-[78%] w-full">
        <defs>
          <radialGradient id="floor" cx="50%" cy="62%" r="40%">
            <stop offset="0" stopColor="#fff" stopOpacity=".16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="640" fill="url(#floor)" />
        {LINES.map(l => <path key={l.d} d={l.d} fill="none" stroke="#fff" strokeOpacity={l.o} strokeWidth="1" />)}
      </svg>

      <div className="container-x flex min-h-[calc(100svh-3.5rem-5rem)] flex-col items-center justify-center py-16 text-center">
        <h1 className="display text-[clamp(2.75rem,6.4vw,5rem)]">
          <span className="intro inline-block">Every buyer lowers the price.</span><br />
          <span className="intro inline-block [--d:180ms]"><span className="text-fade">Pay together, or not at all.</span></span>
        </h1>
        <p className="intro mt-6 max-w-xl text-lg text-muted [--d:420ms]">
          Pool with strangers for the bulk price. PayPal holds your max; everyone pays the group price, or nobody pays.
        </p>
        <div className="intro mt-9 flex flex-wrap justify-center gap-3 [--d:560ms]">
          <a href="#groups" className="btn press px-6 py-3">Browse groups</a>
          <a href="#claude" className="btn-ghost press px-6 py-3">Use with Claude</a>
        </div>
        <LiveCount />
      </div>

      {/* What it runs on. Real stack, not partner logos. */}
      <div className="container-x relative pb-16">
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-white/60">
          {["PayPal Orders v2", "Model Context Protocol", "Claude", "Next.js", "Groq"].map(n => <li key={n}>{n}</li>)}
        </ul>
      </div>
    </section>
  );
}
