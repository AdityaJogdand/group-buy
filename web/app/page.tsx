import Image from "next/image";
import { Hero } from "./hero";
import { CopyButton } from "./copy-command";
import { Groups } from "./groups";
import { Nav, Footer, LogoMark } from "./nav";

// Section header: tag pill, left-aligned title fading grey to white, one line under it.
function Head({ tag, title, sub, center }: { tag: string; title: React.ReactNode; sub: string; center?: boolean }) {
  return (
    <div className={`reveal max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <span className="tag"><LogoMark className="h-2.5 w-4" /> {tag}</span>
      <h2 className="display text-fade mt-5 pb-1 text-[clamp(2.25rem,4.6vw,3.5rem)]">{title}</h2>
      <p className={`mt-3 max-w-xl text-muted ${center ? "mx-auto" : ""}`}>{sub}</p>
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
              <span style={{ height: height(p) }} className={`w-full rounded-t-[4px] ${
                now ? "bg-ink shadow-[0_0_18px_rgba(255,255,255,0.55)]"
                : n < NOW ? "bg-gradient-to-b from-white/75 to-white/25"
                : "bg-white/[0.07]"}`} />
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

// The life of a hold, as PayPal actually runs it (lib/deals.ts): authorize, then capture at the group price or void.
const outcomes = [
  { step: "01", title: "Held", body: "You approve in PayPal. Your max is authorized, not charged.",
    rows: [["PayPal hold", "Authorized"], ["Amount held", "Your max"], ["Charged", "Nothing yet"]] },
  { step: "02", title: "Charged once", body: "The group fills. Everyone is charged the same group price, once.",
    rows: [["You pay", "The group price"], ["Same for", "Every buyer"], ["Never more than", "Your max"]] },
  { step: "03", title: "Or released", body: "The group misses the minimum. Every hold is voided.",
    rows: [["PayPal hold", "Voided"], ["Charged", "Nothing"], ["Action needed", "None"]] },
];

function StepHead({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <>
      <span className="grid size-9 place-items-center rounded-full bg-raised text-sm tabular-nums shadow-[inset_0_0_0_1px_var(--line),inset_0_1px_0_rgba(255,255,255,0.12)]">{n}</span>
      <h3 className="mt-5 text-2xl font-medium tracking-tight">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{body}</p>
    </>
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
            <Head tag="The guarantee" title={<>Held. Charged once.<br />Or released.</>} sub="Holds are PayPal authorizations, not payments. Every group ends one of two ways, and neither can charge you more than you approved." />
            <ol className="relative mt-14 grid gap-4 lg:grid-cols-3">
              {/* The thread through the three stages. */}
              <span aria-hidden className="absolute left-[16%] right-[16%] top-[2.1rem] hidden h-px bg-gradient-to-r from-white/40 via-white/20 to-white/5 lg:block" />
              {outcomes.map(o => (
                <li key={o.title} className="slab reveal relative flex flex-col p-6 sm:p-7">
                  <span className="relative grid size-11 place-items-center rounded-full bg-raised text-sm font-medium tabular-nums shadow-[inset_0_0_0_1px_var(--line),inset_0_1px_0_rgba(255,255,255,0.15)]">{o.step}</span>
                  <h3 className="mt-6 text-2xl font-medium tracking-tight">{o.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{o.body}</p>
                  <dl className="mt-6 divide-y divide-line rounded-xl bg-black/40 px-4 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
                    {o.rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2.5">
                        <dt className="text-muted">{k}</dt><dd className="font-medium tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="claude" className={section}>
          <div className="container-x">
            <Head center tag="Use with Claude" title={<>Ask your AI.<br />It joins for you.</>} sub="Connect once. Then just say what you want and the most you'd pay. You only ever approve the hold yourself, in PayPal." />
            <ol className="mt-14 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
              {/* 1. Connect */}
              <li className="card reveal flex flex-col p-6 sm:p-7">
                <StepHead n={1} title="Connect" body="Paste one command into your terminal. Works with Claude Code and Claude Desktop." />
                {/* The terminal, with the command in full and what it prints back. */}
                <div className="mt-auto pt-8">
                  <div className="rounded-2xl bg-black/50 p-4 font-mono text-[0.8125rem] leading-relaxed shadow-[inset_0_0_0_1px_var(--line)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span aria-hidden className="flex gap-1.5"><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /></span>
                      <CopyButton text="claude mcp add --transport http group-buy http://localhost:3000/mcp" />
                    </div>
                    <p className="[overflow-wrap:anywhere]"><span className="select-none text-muted">$ </span>claude mcp add --transport http group-buy http://localhost:3000/mcp</p>
                    <p className="mt-2 text-muted" aria-hidden>✓ Added HTTP MCP server group-buy</p>
                  </div>
                </div>
              </li>

              {/* 2. Ask */}
              <li className="card reveal flex flex-col p-6 sm:p-7">
                <StepHead n={2} title="Ask" body="In plain words. Claude finds the group and tells you where the price is." />
                <div className="mt-auto grid gap-3 pt-8 text-sm" aria-label="Example conversation with Claude">
                  <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-black">
                    Find me noise-cancelling headphones in a group deal. I&apos;d pay up to the solo price.
                  </p>
                  <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-raised px-4 py-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
                    One group is filling, <b>14 of 25 buyers</b>. I&apos;ve requested your hold; approve it in PayPal.
                  </p>
                </div>
              </li>

              {/* 3. Approve */}
              <li className="card reveal flex flex-col p-6 sm:p-7">
                <StepHead n={3} title="Approve" body="PayPal holds your max. You pay the group price at the deadline, or nothing." />
                <div className="mt-auto pt-8">
                  <div className="rounded-2xl bg-raised p-4 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
                    <div className="flex items-center justify-between text-muted"><span>PayPal</span><span>Hold request</span></div>
                    <p className="mt-3 font-medium">Noise-cancelling headphones</p>
                    <p className="text-muted">Group deal · Sound Supply</p>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <span className="text-muted">Held now</span><span>Your max</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted">Charged now</span><span>Nothing</span>
                    </div>
                    <span className="btn mt-4 w-full justify-center py-2.5">Approve hold</span>
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Answers at the point of doubt: the questions a careful buyer asks before handing over a hold. */}
        <section id="faq" className={section}>
          <div className="container-x">
            <Head center tag="Questions" title="Before you join" sub="The short answers about holds, charges and leaving." />
            <div className="reveal mx-auto mt-12 max-w-3xl border-t border-line">
                <details className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                    When am I charged?
                    <span aria-hidden className="text-2xl font-light text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">Only when the group closes at its deadline. Until then PayPal holds your max as an authorization; no money moves.</p>
                </details>
                <details className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                    What if the group doesn't fill?
                    <span aria-hidden className="text-2xl font-light text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">Every hold is released and nobody pays anything. You don't need to do anything.</p>
                </details>
                <details className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                    Could I pay more than I agreed to?
                    <span aria-hidden className="text-2xl font-light text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">No. You're charged the group price, and never more than the hold you approved.</p>
                </details>
                <details className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                    Can I leave a group?
                    <span aria-hidden className="text-2xl font-light text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">Yes, any time before it closes. Your hold is released straight away.</p>
                </details>
                <details className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                    Is this real money?
                    <span aria-hidden className="text-2xl font-light text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted">Not in this demo. It runs on the PayPal sandbox with test accounts.</p>
                </details>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
