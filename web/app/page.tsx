import Image from "next/image";
import { Hero } from "./hero";
import { CopyCommand } from "./copy-command";
import { Groups } from "./groups";
import { Nav, Footer, LogoMark } from "./nav";

// Section header: tag pill, centered title, one line under it (the reference's rhythm).
function Head({ tag, title, sub }: { tag: string; title: string; sub: string }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <span className="tag"><LogoMark className="h-2.5 w-4" /> {tag}</span>
      <h2 className="display mt-5 text-[clamp(2rem,4vw,3rem)]">{title}</h2>
      <p className="mt-3 text-muted">{sub}</p>
    </div>
  );
}

// Inline stroke icons (no emoji, no icon font).
const icon = {
  lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />,
  users: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 0a3 3 0 1 0 0-6M3 20c0-3 3-5 6-5s6 2 6 5m2-5c2 0 4 2 4 5" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
};
function Icon({ d }: { d: React.ReactNode }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-raised shadow-[inset_0_0_0_1px_var(--line)]">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>{d}</svg>
    </span>
  );
}

const features = [
  { d: icon.lock, title: "A hold, not a charge", body: "PayPal authorizes your max. Nothing moves until the group closes." },
  { d: icon.users, title: "One price for everyone", body: "Every buyer pays the same group price, never more than their hold." },
  { d: icon.chat, title: "Join from your AI", body: "An MCP server: Claude finds the group, you approve in PayPal." },
];

// Price by group size for the headphones (lib/deals.ts): $350 solo, $300 from 10 buyers, $270 from 25.
// One bar per seat; its height is the price everyone pays at that size. Seats taken in the demo group are lit.
const NOW = 14;
const SEATS = 25;
const priceAt = (n: number) => (n >= 25 ? 270 : n >= 10 ? 300 : 350);
const TIER_START = new Set([1, 10, 25]);

function PriceChart() {
  const height = (p: number) => `${15 + ((p - 250) / 100) * 80}%`; // $250 floor of the scale, so the steps read
  return (
    <div className="mt-auto pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p>
          <span className="block text-5xl font-medium tracking-tight tabular-nums">${priceAt(NOW)}</span>
          <span className="text-muted">each at {NOW} buyers</span>
        </p>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-ink px-3 py-1 font-medium text-black">Save ${350 - priceAt(NOW)}</span>
          <span className="rounded-full px-3 py-1 text-muted shadow-[inset_0_0_0_1px_var(--line)]">$270 at 25</span>
        </div>
      </div>

      <div className="mt-8 flex h-56 items-end gap-[3px] sm:gap-1" role="img"
        aria-label={`Price per buyer: $350 alone, $300 from 10 buyers, $270 from 25. The demo group has ${NOW} buyers.`}>
        {Array.from({ length: SEATS }, (_, i) => {
          const n = i + 1;
          const p = priceAt(n);
          const now = n === NOW;
          return (
            <div key={n} className="relative flex h-full flex-1 items-end">
              {TIER_START.has(n) && (
                <span className={`absolute whitespace-nowrap text-xs tabular-nums text-muted ${n === SEATS ? "right-0" : "left-0"}`} style={{ bottom: `calc(${height(p)} + 8px)` }}>
                  ${p}
                </span>
              )}
              {now && (
                <span className="absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-black sm:block"
                  style={{ bottom: `calc(${height(p)} + 10px)` }}>
                  {NOW} now
                </span>
              )}
              <span className={`w-full rounded-t-[4px] ${
                now ? "bg-ink shadow-[0_0_18px_rgba(255,255,255,0.55)]"
                : n < NOW ? "bg-gradient-to-b from-white/75 to-white/25"
                : "bg-white/[0.07]"}`} style={{ height: height(p) }} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between border-t border-line pt-2 text-xs tabular-nums text-muted">
        <span>1 buyer</span><span>{SEATS} buyers</span>
      </div>
    </div>
  );
}

// The four steps, each with a small working-looking piece of the product.
const seat = (on: boolean) => <span className={`aspect-square rounded-[3px] ${on ? "bg-ink" : "bg-white/10"}`} />;

function StepMock({ n }: { n: number }) {
  if (n === 0) return (
    <div className="relative mt-auto overflow-hidden rounded-xl">
      <Image src="/products/audio.jpg" alt="" width={400} height={300} className="aspect-[4/3] w-full object-cover opacity-80 grayscale" />
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1.5 text-sm backdrop-blur">Headphones · $300 at 10</span>
    </div>
  );
  if (n === 1) return (
    <div className="mt-auto rounded-2xl bg-raised p-5 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex justify-between text-xs uppercase tracking-wider text-muted"><span>PayPal hold</span><span>Authorized</span></div>
      <p className="mt-3 text-4xl font-medium tabular-nums tracking-tight">$350.00</p>
      <p className="mt-1.5 text-sm text-muted">Held, not charged</p>
    </div>
  );
  if (n === 2) return (
    <div className="mt-auto">
      <div className="grid grid-cols-10 gap-1.5">{Array.from({ length: 25 }, (_, i) => <span key={i} className="contents">{seat(i < 14)}</span>)}</div>
      <p className="mt-4 text-sm text-muted">14 joined · 11 more unlock $270</p>
    </div>
  );
  return (
    <ul className="mt-auto grid gap-2 text-sm">
      {["Buyer 1", "Buyer 2", "Buyer 3"].map((b, i) => (
        <li key={b} className={`flex justify-between rounded-xl px-4 py-3 ${i === 1 ? "bg-white/10" : "bg-raised"}`}>
          <span className="text-muted">{b}</span><span className="tabular-nums">$300 captured</span>
        </li>
      ))}
    </ul>
  );
}

const steps = [
  { title: "Pick a group", body: "A product, a deadline, a solo price and cheaper prices as buyers join." },
  { title: "Hold your max", body: "PayPal holds the most you'd pay. It's a hold, not a charge." },
  { title: "The group fills", body: "Every new buyer pushes the price down for everyone already in." },
  { title: "Everyone pays the same", body: "At the deadline all holds are captured at one price, or all released." },
];

// The guarantee, as facts. True by construction (lib/deals.ts), not marketing numbers.
const facts = [
  { big: "$0", small: "charged until the group closes" },
  { big: "1 price", small: "for every buyer in the group" },
  { big: "≤ your max", small: "the most you can ever be charged" },
];

function Tool({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <span className="size-1.5 rounded-full bg-ink/60" /> Used group-buy · <code className="text-ink">{name}</code>
    </p>
  );
}

const section = "py-24 sm:py-32";

export default function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />

        <section className={section}>
          <div className="container-x">
            <Head tag="Introduction" title="What is Group Buy?" sub="Group buying where the money is held, not spent, until the group is real." />
            <div className="mx-auto mt-14 grid max-w-[1280px] gap-4 lg:grid-cols-[1.45fr_1fr]">
              <div className="card reveal flex flex-col p-6 sm:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-2xl font-medium tracking-tight">The price steps down as the group grows</h3>
                  <span className="text-sm text-muted">Noise-cancelling headphones</span>
                </div>
                <p className="mt-2 text-muted">Everyone in the group pays the lowest price it reaches, including the people who joined first.</p>
                <PriceChart />
              </div>
              <div className="grid gap-4">
                {features.map(f => (
                  <div key={f.title} className="card reveal flex gap-5 p-6 sm:p-7">
                    <Icon d={f.d} />
                    <div><h3 className="text-xl font-medium tracking-tight">{f.title}</h3><p className="mt-1.5 leading-relaxed text-muted">{f.body}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how" className={section}>
          <div className="container-x max-w-[1328px]!">
            <Head tag="Pick · Hold · Fill · Pay" title="How it works" sub="Four steps, and no step charges you more than you agreed to." />
            <ol className="mx-auto mt-14 grid max-w-[1280px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="card reveal flex min-h-[32rem] flex-col p-6 sm:p-7">
                  <h3 className="text-balance text-center text-2xl font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-3 text-pretty text-center text-base leading-relaxed text-muted">{s.body}</p>
                  <div className="mt-6 flex flex-1 flex-col"><StepMock n={i} /></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="groups" className={section}>
          <div className="container-x">
            <Head tag="Filling now" title="Join a group" sub="Live from the PayPal sandbox. Counts update as buyers join." />
            <Groups />
          </div>
        </section>

        <section className={section}>
          <div className="container-x">
            <Head tag="The guarantee" title="Held. Charged once. Or released." sub="Holds are PayPal authorizations, not payments." />
            <dl className="card reveal mt-12 grid divide-line sm:grid-cols-3 sm:divide-x">
              {facts.map(f => (
                <div key={f.big} className="px-6 py-10 text-center">
                  <dt className="text-4xl font-medium tracking-tight">{f.big}</dt>
                  <dd className="mt-2 text-sm text-muted">{f.small}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="claude" className={section}>
          <div className="container-x">
            <Head tag="Use with Claude" title="Ask your AI. It joins for you." sub="Group Buy is an MCP server. Your assistant finds the group; you approve the hold in PayPal." />
            <div className="mt-12 grid items-start gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              <div className="card reveal p-6 sm:p-8">
                <ol className="grid gap-4">
                  {["Copy the command into your terminal.", "Ask Claude for what you want and the most you'd pay.", "Approve the hold in PayPal. Done."].map((t, i) => (
                    <li key={t} className="flex items-baseline gap-4">
                      <span className="w-6 shrink-0 text-sm tabular-nums text-muted">0{i + 1}</span><span>{t}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-8"><CopyCommand command="claude mcp add --transport http group-buy http://localhost:3000/mcp" /></div>
              </div>

              <div className="card reveal grid gap-4 p-5 sm:p-6" aria-label="Example conversation with Claude">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-black">
                  Find me noise-cancelling headphones in a group deal.
                </p>
                <Tool name="find_deal" />
                <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-raised px-4 py-3">
                  One group is filling: <b>14 of 25 buyers</b>, ends in 2 days. The price drops at 25. What&apos;s the most
                  you&apos;d pay?
                </p>
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-black">Hold up to the solo price.</p>
                <Tool name="join_deal" />
                <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-raised px-4 py-3">
                  <p>You&apos;re in. Approve the hold and you&apos;ll pay the group price when it closes, never more.</p>
                  <span className="btn mt-4 px-4 py-2 text-sm">Approve in PayPal</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
