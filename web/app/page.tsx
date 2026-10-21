import { Hero } from "./hero";

const steps = [
  { n: "01", title: "Tell the agent.", body: "“Noise-cancelling headphones, max $310.” It finds the group that fits." },
  { n: "02", title: "PayPal holds your max.", body: "Authorized, not charged. Leave any time before the group closes." },
  { n: "03", title: "One price for everyone.", body: "The group fills and every hold is captured at the same lower price." },
];

const panel = "mx-3 mt-3 rounded-[28px] px-6 py-20 sm:mx-6 sm:mt-4 sm:px-16 sm:py-28";

export default function Landing() {
  return (
    <>
      <div id="top" className="m-3 flex min-h-[calc(100svh-1.5rem)] flex-col rounded-[28px] bg-lime px-6 py-6 sm:m-6 sm:min-h-[calc(100svh-3rem)] sm:px-16 sm:py-8">
        <header>
          <nav className="flex items-center justify-between gap-4" aria-label="Main">
            <a href="#top" className="wordmark text-xl sm:text-2xl">GROUP/BUY</a>
            <div className="flex items-center gap-8 text-lg font-medium">
              <a href="#how" className="hidden hover:opacity-60 md:inline">How it works</a>
              <a href="#sellers" className="hidden hover:opacity-60 md:inline">Sellers</a>
              <a href="#how" className="press whitespace-nowrap rounded-full bg-ink px-4 py-2 text-base font-semibold text-lime sm:px-6 sm:py-3 sm:text-lg">Join a group</a>
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">
          <Hero />
        </main>
      </div>

      {/* The guarantee */}
      <section className={`${panel} bg-ink text-lime`}>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] opacity-70">The guarantee</p>
        <p className="condensed mt-6 text-[clamp(3rem,8vw,7rem)] uppercase leading-[0.9]">
          Held <span className="tabular-nums">$310</span>.<br />
          Charged <span className="tabular-nums">$300</span>.<br />
          <span className="text-white/40">Or released. $0.</span>
        </p>
        <p className="mt-10 max-w-xl text-xl text-white/70">
          Holds are PayPal authorizations, not payments. You&apos;re never charged more than your hold, and a group that
          doesn&apos;t fill releases every hold.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className={`${panel} scroll-mt-4 bg-white`}>
        <h2 className="condensed text-[clamp(2.75rem,6vw,5rem)] uppercase leading-[0.92]">How it works.</h2>
        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {steps.map(s => (
            <li key={s.n} className="border-t-2 border-ink pt-6">
              <span className="condensed text-5xl tabular-nums">{s.n}</span>
              <h3 className="mt-4 text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-lg text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Sellers */}
      <section id="sellers" className={`${panel} scroll-mt-4 bg-white`}>
        <div className="grid items-end gap-14 md:grid-cols-2">
          <div>
            <h2 className="condensed text-[clamp(2.75rem,6vw,5rem)] uppercase leading-[0.92]">Volume,<br />without the<br />ad spend.</h2>
            <p className="mt-8 max-w-md text-xl text-muted">
              Set a solo price and group prices. Buyers fill the group for you. Your lowest price stays private, and
              agents never go below it.
            </p>
          </div>
          <div className="flex items-end gap-3 sm:gap-5">
            {[{ l: "Solo", p: 150 }, { l: "10 buyers", p: 130 }, { l: "30 buyers", p: 115 }].map(t => (
              <div key={t.l} className="flex flex-1 flex-col">
                <span className="condensed text-4xl tabular-nums sm:text-5xl">${t.p}</span>
                {/* Bars start at $100 so the drop is visible. */}
                <span className={`mt-3 rounded-2xl ${t.p === 150 ? "bg-black/10" : "bg-lime"}`} style={{ height: `${((t.p - 100) / 50) * 200}px` }} />
                <span className="mt-3 text-sm font-semibold uppercase tracking-[0.08em]">{t.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Claude / MCP */}
      <section id="claude" className={`${panel} bg-lime`}>
        <h2 className="condensed text-[clamp(2.75rem,6vw,5rem)] uppercase leading-[0.92]">Ask your AI.<br />It joins for you.</h2>
        <p className="mt-8 max-w-xl text-xl">
          Group Buy is an MCP server. Connect it to Claude and say “I want the headphones, max $310.” You approve the hold
          in PayPal.
        </p>
        <code className="mt-10 block max-w-full overflow-x-auto whitespace-nowrap rounded-2xl bg-ink px-6 py-4 text-sm text-lime sm:inline-block">
          claude mcp add --transport http group-buy http://localhost:3000/mcp
        </code>
      </section>

      <footer className="mx-3 flex flex-wrap justify-between gap-2 px-6 py-8 text-sm text-muted sm:mx-6 sm:px-16">
        <span className="wordmark text-ink">GROUP/BUY</span>
        <span>PayPal AI Hackathon 2026 · Payments run in the PayPal sandbox. No real money moves.</span>
      </footer>
    </>
  );
}
