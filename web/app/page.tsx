import { PoolSlider } from "./pool-slider";

const steps = [
  { n: "01", title: "Tell the agent.", body: "“A UX course, under $160, before December.” It finds the group that fits." },
  { n: "02", title: "PayPal holds your max.", body: "Authorized, not charged. Leave any time before the group closes." },
  { n: "03", title: "One price for everyone.", body: "The group fills and every hold is captured at the same lower price." },
];

export default function Landing() {
  return (
    <>
      <header className="glass sticky top-0 z-10">
        <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 text-[0.8125rem] sm:px-6" aria-label="Main">
          <a href="#top" className="font-semibold tracking-tight">Group Buy</a>
          <div className="flex items-center gap-6">
            <a href="#how" className="hidden text-fg/80 hover:text-fg sm:inline">How it works</a>
            <a href="#sellers" className="hidden text-fg/80 hover:text-fg sm:inline">Sellers</a>
            <a href="#claude" className="hidden text-fg/80 hover:text-fg sm:inline">Claude</a>
            <a href="#claude" className="press rounded-full bg-accent px-3.5 py-1 font-medium text-white">Join a group</a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* Hero: the product idea, playable */}
        <section className="px-4 pb-28 pt-20 text-center sm:px-6 sm:pt-28">
          <h1 className="display mx-auto max-w-4xl">The more of us,<br />the less we pay.</h1>
          <p className="mx-auto mt-6 max-w-xl text-xl text-muted">
            Strangers pool for the bulk price. PayPal holds your max. Everyone pays the group price, or nobody pays.
          </p>
          <div className="mt-16">
            <PoolSlider />
          </div>
        </section>

        {/* The guarantee, as one typographic statement */}
        <section className="bg-card px-4 py-32 text-center sm:px-6">
          <p className="eyebrow text-muted">The guarantee</p>
          <p className="mx-auto mt-6 max-w-4xl text-[clamp(2.5rem,6.5vw,5rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            Held <span className="tabular-nums">$160</span>.<br />
            <span className="text-save">Charged <span className="tabular-nums">$150</span>.</span><br />
            <span className="text-muted">Or released. <span className="tabular-nums">$0</span>.</span>
          </p>
          <p className="mx-auto mt-8 max-w-xl text-lg text-muted">
            Holds are PayPal authorizations, not payments. You&apos;re never charged more than your hold, and a group
            that doesn&apos;t fill releases every hold.
          </p>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl scroll-mt-12 px-4 py-32 sm:px-6">
          <h2 className="title text-center">How it works.</h2>
          <ol className="mt-20 grid gap-14 md:grid-cols-3 md:gap-10">
            {steps.map(s => (
              <li key={s.n}>
                <span className="text-5xl font-bold tracking-[-0.04em] text-black/10 tabular-nums">{s.n}</span>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[1.0625rem] text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Sellers */}
        <section id="sellers" className="scroll-mt-12 bg-card px-4 py-32 text-center sm:px-6">
          <p className="eyebrow text-muted">For sellers</p>
          <h2 className="title mx-auto mt-4 max-w-3xl">Volume, without the ad spend.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Set a single price and group prices. Buyers fill the group for you. Your lowest price stays private, and
            agents never go below it.
          </p>
          <div className="mx-auto mt-16 flex max-w-2xl items-end justify-center gap-6 sm:gap-12">
            {[{ l: "Alone", p: 150 }, { l: "10 buyers", p: 130 }, { l: "30 buyers", p: 115 }].map(t => (
              <div key={t.l} className="flex w-24 flex-col items-center sm:w-32">
                <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">${t.p}</span>
                {/* Bars start at $100 so the drop is visible. */}
                <span className={`mt-3 w-full rounded-2xl ${t.p === 150 ? "bg-black/10" : "bg-accent"}`} style={{ height: `${((t.p - 100) / 50) * 180}px` }} />
                <span className="mt-3 text-sm text-muted">{t.l}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">Mechanical keyboard (75%)</p>
        </section>

        {/* Claude / MCP */}
        <section id="claude" className="scroll-mt-12 px-4 py-32 text-center sm:px-6">
          <p className="eyebrow text-accent">Agents that shop together</p>
          <h2 className="title mx-auto mt-4 max-w-3xl">Ask your assistant.<br />It joins the group for you.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Group Buy is an MCP server. Connect it to Claude and say “I want the UX course, max $180.” You approve the
            hold in PayPal. That&apos;s it.
          </p>
          <code className="mx-auto mt-10 block max-w-full overflow-x-auto whitespace-nowrap rounded-2xl bg-card px-6 py-4 text-left text-sm sm:inline-block">
            claude mcp add --transport http group-buy http://localhost:3000/mcp
          </code>
        </section>
      </main>

      <footer className="bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 border-t border-line px-4 py-5 text-xs text-muted sm:px-6">
          <span>Group Buy · PayPal AI Hackathon 2026</span>
          <span>Payments run in the PayPal sandbox. No real money moves.</span>
        </div>
      </footer>
    </>
  );
}
