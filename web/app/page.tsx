import { Hero } from "./hero";
import { CopyCommand } from "./copy-command";

const steps = [
  { n: "01", title: "Pick a group", body: "Each group has a deadline, a solo price, and cheaper prices as more buyers join." },
  { n: "02", title: "Hold your max", body: "PayPal places a hold for the most you'd pay. It's a hold, not a charge." },
  { n: "03", title: "The group fills", body: "Every new buyer pushes the price down for everyone already in." },
  { n: "04", title: "Everyone pays the same", body: "At the deadline, everyone pays the group price. If it misses the minimum, nobody pays." },
];

// Demo snapshot of the seeded catalog (lib/deals.ts); `buyers` is illustrative until the API is wired.
const groups = [
  { tag: "Audio", ends: "2d 14h", name: "Noise-cancelling headphones", list: 350, tiers: [{ buyers: 10, price: 300 }, { buyers: 25, price: 270 }], buyers: 14 },
  { tag: "Desk", ends: "19h", name: "Mechanical keyboard (75%)", list: 150, tiers: [{ buyers: 10, price: 130 }, { buyers: 30, price: 115 }], buyers: 27 },
  { tag: "Display", ends: "1d 6h", name: "27-inch 4K monitor", list: 400, tiers: [{ buyers: 5, price: 360 }, { buyers: 15, price: 330 }], buyers: 3 },
];

const panel = "mx-3 mt-3 rounded-[28px] px-6 py-20 sm:mx-6 sm:mt-4 sm:px-16 sm:py-24";
const h2 = "condensed text-[clamp(2.75rem,6vw,5rem)] uppercase leading-[0.92]";

function Tool({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted">
      <span className="size-1.5 rounded-full bg-ink/40" /> Used group-buy · <code className="text-ink">{name}</code>
    </p>
  );
}

function GroupCard({ g }: { g: (typeof groups)[number] }) {
  const price = g.tiers.reduce((p, t) => (g.buyers >= t.buyers ? t.price : p), g.list);
  const next = g.tiers.find(t => t.buyers > g.buyers);
  const seats = g.tiers.at(-1)!.buyers;
  return (
    <article className="flex flex-col rounded-[24px] border-2 border-ink p-6 sm:p-7">
      <div className="flex justify-between text-sm font-semibold uppercase tracking-[0.08em]">
        <span>{g.tag}</span><span>{g.ends}</span>
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-tight">{g.name}</h3>
      <p className="mt-4 flex items-baseline gap-3">
        <span className="condensed text-6xl leading-none tabular-nums">${price}</span>
        {price < g.list && <s className="text-lg font-bold tabular-nums">${g.list}</s>}
      </p>
      <div className="mt-6 grid grid-cols-15 gap-1" role="img" aria-label={`${g.buyers} of ${seats} buyers`}>
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={`aspect-square rounded-[4px] border-[1.5px] border-ink ${i < g.buyers ? "bg-ink" : ""}`} />
        ))}
      </div>
      <p className="mt-5 font-semibold">
        {next ? `${next.buyers - g.buyers} more unlock $${next.price} for everyone` : "Best price unlocked"}
      </p>
    </article>
  );
}

export default function Landing() {
  return (
    <>
      <div id="top" className="m-3 flex min-h-[calc(100svh-1.5rem)] flex-col rounded-[28px] bg-lime px-6 py-6 sm:m-6 sm:min-h-[calc(100svh-3rem)] sm:px-16 sm:py-8">
        <header>
          <nav className="flex items-center justify-between gap-4" aria-label="Main">
            <a href="#top" className="wordmark text-xl sm:text-2xl">GROUP/BUY</a>
            <div className="flex items-center gap-8 text-lg font-medium">
              <a href="#how" className="hidden hover:opacity-60 md:inline">How it works</a>
              <a href="#groups" className="press whitespace-nowrap rounded-full bg-ink px-4 py-2 text-base font-semibold text-lime sm:px-6 sm:py-3 sm:text-lg">Join a group</a>
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">
          <Hero />
        </main>
      </div>

      {/* Four steps */}
      <section id="how" className={`${panel} scroll-mt-4 bg-ink`}>
        <h2 className={`${h2} text-lime`}>Four steps. No risk.</h2>
        <ol className="mt-14 grid gap-12 border-t-2 border-lime pt-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {steps.map(s => (
            <li key={s.n}>
              <span className="condensed text-7xl leading-none text-lime tabular-nums">{s.n}</span>
              <h3 className="mt-6 text-2xl font-bold text-white">{s.title}</h3>
              <p className="mt-3 text-lg text-white/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Filling now */}
      <section id="groups" className={`${panel} scroll-mt-4 bg-lime`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={h2}>Filling now</h2>
          <a href="#claude" className="text-lg font-bold underline decoration-2 underline-offset-4 hover:opacity-60">See all groups →</a>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {groups.map(g => <GroupCard key={g.name} g={g} />)}
        </div>
      </section>

      {/* The guarantee */}
      <section className={`${panel} bg-ink text-lime`}>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] opacity-70">The guarantee</p>
        <p className="condensed mt-6 text-[clamp(3rem,8vw,7rem)] uppercase leading-[0.9]">
          Held: your max.<br />
          Charged: the group price.<br />
          <span className="text-white/40">Or released. Nothing paid.</span>
        </p>
        <p className="mt-10 max-w-xl text-xl text-white/70">
          Holds are PayPal authorizations, not payments. You&apos;re never charged more than your hold, and a group that
          doesn&apos;t fill releases every hold.
        </p>
      </section>

      {/* Claude / MCP */}
      <section id="claude" className={`${panel} bg-white`}>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <h2 className={h2}>Ask your AI.<br />It joins for you.</h2>
            <p className="mt-8 max-w-lg text-xl">
              Group Buy is an MCP server. Your assistant finds the group, places the hold request, and you approve it in
              PayPal. No site to browse.
            </p>
            <ol className="mt-10 grid max-w-lg gap-4 text-lg">
              {["Copy the command into your terminal.", "Ask Claude for what you want and the most you'd pay.", "Approve the hold in PayPal. Done."].map((t, i) => (
                <li key={t} className="flex items-baseline gap-4">
                  <span className="condensed w-6 shrink-0 text-2xl">{i + 1}</span><span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 max-w-lg">
              <CopyCommand command="claude mcp add --transport http group-buy http://localhost:3000/mcp" />
            </div>
          </div>

          {/* What it looks like in Claude */}
          <div className="rounded-[24px] bg-bg p-4 sm:p-6" aria-label="Example conversation with Claude">
            <div className="grid gap-3 text-[1.0625rem]">
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-white">
                Find me noise-cancelling headphones in a group deal.
              </p>
              <Tool name="find_deal" />
              <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-3">
                One group is filling: <b>14 of 25 buyers</b>, ends in 2 days. The price drops at 25. What&apos;s the most
                you&apos;d pay?
              </p>
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-white">
                Hold up to the solo price.
              </p>
              <Tool name="join_deal" />
              <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-3">
                <p>You&apos;re in. Approve the hold and you&apos;ll pay the group price when it closes, never more.</p>
                <span className="mt-3 inline-block rounded-full bg-lime px-4 py-2 text-sm font-bold">Approve in PayPal →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-3 mb-3 mt-3 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-lime px-6 py-8 sm:mx-6 sm:mb-6 sm:mt-4 sm:px-16">
        <span className="wordmark text-xl">GROUP/BUY</span>
        <span className="flex flex-wrap gap-x-8 gap-y-1 font-semibold">
          <span>Payments held by PayPal</span>
          <span>Sandbox demo · no real money</span>
        </span>
      </footer>
    </>
  );
}
