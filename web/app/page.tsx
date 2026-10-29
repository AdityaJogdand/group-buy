import { HeroSection } from "./hero-section";
import { CopyButton } from "./copy-command";
import { Groups } from "./groups";
import { Ask } from "./ask";
import { IntroStory } from "./intro-story";
import { HowSteps } from "./how-steps";
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
// The backend's public MCP endpoint; API_URL is set at build time on Render.
const MCP_URL = `${process.env.API_URL ?? "http://localhost:3000"}/mcp`;

export default function Landing() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />

        <IntroStory head={<Head tag="Introduction" title="What is Group Buy?" sub="Group buying where the money is held, not spent, until the group is real." />} />

        <section id="how" className={section}>
          <div className="container-x max-w-[1328px]!">
            <Head tag="Pick · Hold · Fill · Pay" title="How it works" sub="Four steps, and no step charges you more than you agreed to." />
            <HowSteps />
          </div>
        </section>

        <section id="groups" className={section}>
          <div className="container-x">
            <Head tag="Filling now" title="Join a group" sub="Pick a group below, or tap Ask AI and say what you want." />
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
                      <CopyButton text={`claude mcp add --transport http group-buy ${MCP_URL}`} />
                    </div>
                    <p className="[overflow-wrap:anywhere]"><span className="select-none text-muted">$ </span>claude mcp add --transport http group-buy {MCP_URL}</p>
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
      <Ask />
    </>
  );
}
