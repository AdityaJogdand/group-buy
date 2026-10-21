import { Hero } from "./hero";
import { CopyCommand } from "./copy-command";
import Image from "next/image";

const steps = [
  { n: "01", title: "Pick a group", body: "Each group has a deadline, a solo price, and cheaper prices as more buyers join." },
  { n: "02", title: "Hold your max", body: "PayPal places a hold for the most you'd pay. It's a hold, not a charge." },
  { n: "03", title: "The group fills", body: "Every new buyer pushes the price down for everyone already in." },
  { n: "04", title: "Everyone pays the same", body: "At the deadline, everyone pays the group price. If it misses the minimum, nobody pays." },
];

// Demo snapshot of the seeded catalog (lib/deals.ts); `buyers` is illustrative until the API is wired.
// Photos in public/products are from Unsplash (free license), picked with no visible brand logos.
const groups = [
  { tag: "Audio", ends: "2d 14h", name: "Noise-cancelling headphones", seller: "Sound Supply", list: 350, tiers: [{ buyers: 10, price: 300 }, { buyers: 25, price: 270 }], buyers: 14 },
  { tag: "Desk", ends: "19h", name: "Mechanical keyboard (75%)", seller: "KeyLab", list: 150, tiers: [{ buyers: 10, price: 130 }, { buyers: 30, price: 115 }], buyers: 27 },
  { tag: "Display", ends: "1d 6h", name: "27-inch 4K monitor", seller: "Pixel Works", list: 400, tiers: [{ buyers: 5, price: 360 }, { buyers: 15, price: 330 }], buyers: 3 },
  { tag: "Course", ends: "3d", name: "UX Design Course", seller: "Lena", list: 200, tiers: [{ buyers: 10, price: 180 }, { buyers: 20, price: 160 }], buyers: 17 },
  { tag: "Software", ends: "11h", name: "Design software seat (1 year)", seller: "Lena", list: 120, tiers: [{ buyers: 5, price: 105 }, { buyers: 20, price: 90 }], buyers: 9 },
  { tag: "Workshop", ends: "2d 2h", name: "Live design workshop", seller: "Lena", list: 300, tiers: [{ buyers: 10, price: 260 }, { buyers: 25, price: 220 }], buyers: 6 },
];

// Tall panels, content centered vertically.
// The steps panel keeps its original, shorter height.
const panelShort = "mx-3 mt-3 rounded-[28px] px-6 py-20 sm:mx-6 sm:mt-4 sm:px-16 sm:py-24";
const panel = "mx-3 mt-3 flex min-h-[85svh] flex-col justify-center rounded-[28px] px-6 py-28 sm:mx-6 sm:mt-4 sm:px-16 sm:py-36";
const h2 = "condensed text-[clamp(2.75rem,6vw,5rem)] uppercase leading-[0.92]";

function Tool({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 text-base font-semibold text-muted">
      <span className="size-1.5 rounded-full bg-ink/40" /> Used group-buy · <code className="text-ink">{name}</code>
    </p>
  );
}

// Apple-store style showcase card: name up top, product art center stage, price and action at the bottom.
function GroupCard({ g }: { g: (typeof groups)[number] }) {
  const price = g.tiers.reduce((p, t) => (g.buyers >= t.buyers ? t.price : p), g.list);
  const next = g.tiers.find(t => t.buyers > g.buyers);
  const seats = g.tiers.at(-1)!.buyers;
  return (
    <article className="group flex flex-col rounded-[28px] bg-[#f5f5f7] p-7 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(0,0,0,0.14)] sm:p-8">
      <p className="text-sm font-semibold text-muted">{g.tag} · ends in {g.ends}</p>
      <h3 className="mt-1.5 text-balance md:min-h-[2.2em] text-[1.75rem] font-bold leading-[1.1] tracking-[-0.02em]">{g.name}</h3>
      <p className="mt-1 text-lg text-muted">by {g.seller}</p>

      <div className="my-7 overflow-hidden rounded-[20px]">
        <Image src={`/products/${g.tag.toLowerCase()}.jpg`} alt={g.name} width={900} height={675}
          sizes="(min-width: 768px) 30vw, 90vw"
          className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
      </div>

      <div className="mt-auto">
      <div className="grid grid-cols-15 gap-[3px]" role="img" aria-label={`${g.buyers} of ${seats} buyers`}>
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={`aspect-square rounded-[3px] ${i < g.buyers ? "bg-ink" : "bg-ink/10"}`} />
        ))}
      </div>
      <p className="mt-3 text-base text-muted">
        {g.buyers} joined · {next ? `${next.buyers - g.buyers} more unlock $${next.price}` : "best price unlocked"}
      </p>

      <div className="flex items-end justify-between gap-4 pt-7">
        <p className="leading-tight">
          <span className="block text-3xl font-bold tabular-nums tracking-tight">${price}</span>
          <span className="text-base text-muted">{price < g.list ? <>each · <s>${g.list}</s> solo</> : "solo price"}</span>
        </p>
        <a href="#claude" className="press rounded-full bg-ink px-6 py-3 text-base font-semibold text-white">Join</a>
      </div>
      </div>
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
      <section id="how" className={`${panelShort} scroll-mt-4 bg-ink`}>
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
      <section id="groups" className={`${panel} scroll-mt-4 bg-white`}>
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
        <div className="grid items-center gap-14 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h2 className="condensed text-[clamp(3rem,5.6vw,5.5rem)] uppercase leading-[0.9]">Ask your AI.<br />It joins for you.</h2>
            <p className="mt-8 max-w-xl text-2xl leading-snug">
              Group Buy is an MCP server. Your assistant finds the group, places the hold request, and you approve it in
              PayPal. No site to browse.
            </p>
            <ol className="mt-10 grid max-w-xl gap-5 text-xl sm:text-2xl">
              {["Copy the command into your terminal.", "Ask Claude for what you want and the most you'd pay.", "Approve the hold in PayPal. Done."].map((t, i) => (
                <li key={t} className="flex items-baseline gap-4">
                  <span className="condensed w-8 shrink-0 text-3xl">{i + 1}</span><span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="mt-10 max-w-xl">
              <CopyCommand command="claude mcp add --transport http group-buy http://localhost:3000/mcp" />
            </div>
          </div>

          {/* What it looks like in Claude */}
          <div className="rounded-[24px] bg-bg p-4 sm:p-6" aria-label="Example conversation with Claude">
            <div className="grid gap-4 text-lg sm:text-xl">
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
                <span className="mt-4 inline-block rounded-full bg-lime px-5 py-2.5 text-base font-bold">Approve in PayPal →</span>
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
