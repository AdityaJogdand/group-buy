"use client";
// "Filling now": live products and their fullest open group from the backend (/api/products),
// and the Join form: name + max → /api/join → PayPal approval → back to /joined.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export type Product = {
  id: string; name: string; seller: string; list_price: string;
  group_prices: { buyers: number; price: string }[];
  open_deals: { deal_id: number; buyers: number; target: number; ends_in_ms: number }[];
};

// Photos in public/products are from Unsplash (free license), picked with no visible brand logos.
// ponytail: photos keyed by product id in code; add an image field when sellers upload their own.
export const photos: Record<string, { tag: string; file: string }> = {
  headphones: { tag: "Audio", file: "audio" },
  keyboard: { tag: "Desk", file: "desk" },
  monitor: { tag: "Display", file: "display" },
  "ux-course": { tag: "Course", file: "course" },
  "design-seat": { tag: "Software", file: "software" },
  "design-workshop": { tag: "Workshop", file: "workshop" },
};

export const dollars = (s: string) => Number(s.replace("$", ""));
export function timeLeft(ms: number) {
  const m = Math.round(ms / 60_000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${Math.max(1, m)}m`;
}

// Where a group stands: its fullest open deal, current and best price, and the next price break.
function stats(p: Product) {
  const deal = [...p.open_deals].sort((a, b) => b.buyers - a.buyers)[0];
  const buyers = deal?.buyers ?? 0;
  const list = dollars(p.list_price);
  const tiers = p.group_prices.map(t => ({ buyers: t.buyers, price: dollars(t.price) }));
  const price = tiers.reduce((x, t) => (buyers >= t.buyers ? t.price : x), list);
  const next = tiers.find(t => t.buyers > buyers);
  const best = tiers.at(-1);
  return { deal, buyers, list, tiers, price, next, best, seats: best?.buyers ?? 10 };
}

// Slim bar toward the biggest tier, with a tick at each price break.
function Progress({ p }: { p: Product }) {
  const { buyers, seats, tiers } = stats(p);
  return (
    <div className="relative h-1 rounded-full bg-white/15" role="img" aria-label={`${buyers} of ${seats} buyers`}>
      <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(buyers / seats) * 100}%` }} />
      {tiers.slice(0, -1).map(t => (
        <span key={t.buyers} className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 rounded-full bg-white/50" style={{ left: `${(t.buyers / seats) * 100}%` }} />
      ))}
    </div>
  );
}

// zoom={false} when a parent layer does the hover zoom (the tile scales its masked layer instead).
const Photo = ({ p, sizes, zoom = true }: { p: Product; sizes: string; zoom?: boolean }) => (
  <Image src={`/products/${photos[p.id].file}.jpg`} alt={p.name} fill sizes={sizes}
    className={`object-cover ${zoom ? "transition-transform duration-700 ease-out group-hover:scale-[1.04]" : ""}`} />
);

// Price track: one bar from solo to the biggest tier, filled to the current buyer count. Each price break has
// its price above and buyer count below; reached breaks are solid, the next is outlined, and a
// glowing marker shows where the group is now.
function Ladder({ p }: { p: Product }) {
  const { buyers, list, tiers, price } = stats(p);
  const steps = [{ buyers: 0, price: list }, ...tiers];
  // Breaks are spaced evenly (a 5-buyer tier next to a 0-buyer start would crowd); the fill moves linearly
  // within each segment, so the marker still lands in the right place.
  const at = (n: number) => {
    const i = steps.findIndex((t, k) => k === steps.length - 1 || n < steps[k + 1].buyers);
    const [from, to] = [steps[i], steps[i + 1]];
    const frac = to ? (n - from.buyers) / (to.buyers - from.buyers) : 0;
    return `${((i + frac) / (steps.length - 1)) * 100}%`;
  };
  // Keep the end labels inside the track instead of hanging off its edges.
  const align = (i: number) => (i === 0 ? "" : i === steps.length - 1 ? "-translate-x-full" : "-translate-x-1/2");
  return (
    <div className="mt-8" role="img"
      aria-label={`Price by group size: ${steps.map(t => `$${t.price} ${t.buyers ? `at ${t.buyers} buyers` : "solo"}`).join(", ")}. ${buyers} joined, $${price} now.`}>
      <div className="relative h-7">
        {steps.map((t, i) => (
          <span key={t.buyers} style={{ left: at(t.buyers) }}
            className={`absolute bottom-0 whitespace-nowrap text-lg font-medium tabular-nums tracking-tight ${align(i)} ${t.price === price ? "text-ink" : "text-muted"}`}>
            ${t.price}
          </span>
        ))}
      </div>

      <div className="relative mt-3 h-1.5 rounded-full bg-white/10">
        <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-white/40 to-white" style={{ width: at(buyers) }} />
        {steps.slice(1).map(t => (
          <span key={t.buyers} style={{ left: at(t.buyers) }}
            className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${buyers >= t.buyers ? "bg-ink" : "border-2 border-white/40 bg-surface"}`} />
        ))}
        {/* You are here. */}
        <span style={{ left: at(buyers) }} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
          <span className="relative block size-4 rounded-full border-[3px] border-surface bg-ink shadow-[0_0_14px_rgba(255,255,255,0.7)]" />
        </span>
      </div>

      <div className="relative mt-3 h-4 text-xs text-muted">
        {steps.map((t, i) => (
          <span key={t.buyers} style={{ left: at(t.buyers) }} className={`absolute whitespace-nowrap ${align(i)}`}>
            {t.buyers ? `${t.buyers} buyers` : "Solo"}
          </span>
        ))}
      </div>
    </div>
  );
}

// The group closest to its next price: big photo, the numbers, one action.
function Featured({ p, onJoin }: { p: Product; onJoin: () => void }) {
  const { deal, buyers, list, price, next, best, seats } = stats(p);
  return (
    <article className="card reveal group grid overflow-hidden md:grid-cols-[1.25fr_1fr]">
      <div className="relative min-h-72 overflow-hidden md:min-h-[26rem]">
        <Photo p={p} sizes="(min-width: 768px) 55vw, 100vw" />
        <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium backdrop-blur-md">Filling fastest</span>
      </div>
      <div className="flex flex-col p-6 sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{photos[p.id].tag} · {deal ? `ends in ${timeLeft(deal.ends_in_ms)}` : "new group"}</p>
        <h3 className="mt-3 text-balance text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{p.name}</h3>
        <p className="mt-1 text-muted">by {p.seller}</p>
        <div className="mt-8 flex items-end gap-3">
          <span className="text-5xl font-medium tabular-nums tracking-tight">${price}</span>
          <span className="pb-1.5 text-muted">{price < list ? <s>${list}</s> : "solo price"}</span>
        </div>
        <Ladder p={p} />
        <div className="mt-auto pt-8">
          <p className="text-sm text-muted">{buyers} of {seats} joined · {next ? `${next.buyers - buyers} more unlock $${next.price}` : "best price unlocked"}</p>
          <button type="button" onClick={onJoin} className="btn press mt-6 px-6 py-3">{deal ? "Join this group" : "Start a group"}</button>
        </div>
      </div>
    </article>
  );
}

// Rail tile: tall photo with the name over a gradient, the price line and progress below.
function Tile({ p, onJoin }: { p: Product; onJoin: () => void }) {
  const { deal, buyers, list, price, next, best, seats } = stats(p);
  return (
    <article className="card group flex w-[78vw] shrink-0 snap-start flex-col overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1 sm:w-[19rem]">
      <div className="relative aspect-square overflow-hidden">
        {/* The photo itself fades out at the bottom (a mask, not a black overlay), so it melts into the card
            with no seam; a light shade keeps the title readable. */}
        {/* Zoom the masked layer as one piece on its own GPU layer; scaling the photo inside a mask flickers. */}
        <div className="absolute inset-0 origin-top transition-transform duration-700 ease-out will-change-transform [mask-image:linear-gradient(to_bottom,#000_45%,transparent_100%)] group-hover:scale-[1.04]">
          <Photo p={p} sizes="(min-width: 640px) 19rem, 78vw" zoom={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
          {deal ? `Ends in ${timeLeft(deal.ends_in_ms)}` : "New group"}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/60">{photos[p.id].tag}</p>
          <h3 className="mt-1 text-xl font-medium leading-tight tracking-tight">{p.name}</h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-2">
        <div className="flex items-baseline justify-between gap-3 tabular-nums">
          <p><span className="text-2xl font-medium tracking-tight">${price}</span>
            {price < list ? <s className="ml-1.5 text-sm text-muted">${list}</s> : <span className="text-sm text-muted"> solo</span>}</p>
          {best && <p className="text-sm text-muted">{price < list ? `Save $${list - price}` : `$${best.price} at ${best.buyers}`}</p>}
        </div>
        <div>
          <Progress p={p} />
          <p className="mt-2.5 text-xs text-muted">{buyers} of {seats} · {next ? `${next.buyers - buyers} more unlock $${next.price}` : "best price unlocked"}</p>
        </div>
        <button type="button" onClick={onJoin} className="btn press mt-auto justify-center py-2.5 text-sm">{deal ? "Join group" : "Start a group"}</button>
      </div>
    </article>
  );
}

function JoinDialog({ p, onClose }: { p: Product | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [max, setMax] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = p ? dollars(p.list_price) : 0;
  const tiers = (p?.group_prices ?? []).map(t => ({ buyers: t.buyers, price: dollars(t.price) }));
  const best = tiers.at(-1);
  const held = p ? Math.max(0, ...p.open_deals.map(d => d.buyers)) : 0;
  const now = tiers.reduce((x, t) => (held >= t.buyers ? t.price : x), list);

  useEffect(() => {
    if (!p) return;
    // Default to the solo price: that hold covers every group price, so the buyer is never dropped.
    setMax(String(dollars(p.list_price)));
    setNote(null);
    ref.current?.showModal();
  }, [p]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: p.id, max_usd: Number(max), name }),
      });
      const out = await res.json();
      if (out.approve_url) return void (window.location.href = out.approve_url);
      setNote(out.question ?? out.error ?? "Something went wrong. Try again.");
    } catch {
      setNote("Can't reach the server. Try again.");
    }
    setBusy(false);
  };

  return (
    <dialog ref={ref} onClose={onClose}
      className="fixed inset-0 m-auto h-fit w-[min(92vw,30rem)] rounded-[18px] bg-surface p-0 text-ink shadow-[inset_0_0_0_1px_var(--line)] backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      {p && (
        <form onSubmit={submit} className="flex flex-col gap-5 p-7 sm:p-8">
          <div>
            <p className="text-sm text-muted">Join the group</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{p.name}</h2>
            {/* Decide with the numbers in view: where the price is now and where it can go. */}
            <p className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-raised px-3 py-1 tabular-nums shadow-[inset_0_0_0_1px_var(--line)]">Now ${now}</span>
              {best && <span className="rounded-full px-3 py-1 tabular-nums text-muted shadow-[inset_0_0_0_1px_var(--line)]">${best.price} at {best.buyers} buyers</span>}
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Your name
            <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder="Optional"
              className="rounded-xl border border-line bg-raised px-4 py-3 text-lg font-normal outline-none focus:border-white/40" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            The most you&apos;d pay
            <span className="flex items-center rounded-xl border border-line bg-raised px-4 focus-within:border-white/40">
              <span className="text-lg">$</span>
              <input value={max} onChange={e => setMax(e.target.value)} type="number" inputMode="decimal" min="1" step="any" required
                className="w-full bg-transparent py-3 pl-1 text-lg font-normal tabular-nums outline-none" />
            </span>
            {/* One-tap amounts. The solo price is the safe pick: it covers every group price. */}
            <span className="flex flex-wrap gap-2">
              {[{ v: list, label: `$${list} · covers every price` }, ...(best ? [{ v: best.price, label: `$${best.price} · best price only` }] : [])].map(o => (
                <button key={o.v} type="button" onClick={() => setMax(String(o.v))}
                  className={`press rounded-full px-3 py-1.5 text-sm font-normal tabular-nums ${Number(max) === o.v ? "bg-ink text-black" : "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                  {o.label}
                </button>
              ))}
            </span>
            <span className="text-sm font-normal text-muted" aria-live="polite">
              {Number(max) > 0 && Number(max) < list
                ? `If the group ends above $${Number(max)}, your hold is released and you pay nothing.`
                : "PayPal holds this amount. You pay the group price at the deadline, never more. If the group doesn't fill, the hold is released."}
            </span>
          </label>
          {note && <p role="alert" className="rounded-xl bg-raised px-4 py-3 text-base">{note}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost press px-5 py-3">Cancel</button>
            <button disabled={busy} className="btn press px-6 py-3 disabled:opacity-50">
              {busy ? "Opening PayPal…" : "Continue to PayPal"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

export function Groups() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState<Product | null>(null);
  const [tag, setTag] = useState("All");
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Refresh every 10 s so counts move while the page is open (and while the demo clock runs).
    const load = () => fetch("/api/products").then(r => (r.ok ? r.json() : Promise.reject()))
      .then((ps: Product[]) => { setProducts(ps.filter(p => photos[p.id])); setFailed(false); })
      .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  if (!products) return (
    <p className="mt-12 text-xl text-muted" aria-live="polite">
      {failed ? "Groups are unavailable right now. Is the backend running?" : "Loading groups…"}
    </p>
  );

  // Featured: the group with the most buyers (ties: fewest still needed for the next price).
  const shown = products.filter(p => tag === "All" || photos[p.id].tag === tag);
  const ranked = [...shown].sort((a, b) => stats(b).buyers - stats(a).buyers);
  const [top, ...rest] = ranked;
  const tags = ["All", ...new Set(products.map(p => photos[p.id].tag))];
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * (rail.current.clientWidth * 0.8), behavior: "smooth" });
  const arrow = "press grid size-10 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--line)] hover:bg-white/5";

  return (
    <>
      <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {tags.map(t => (
          <button key={t} type="button" onClick={() => setTag(t)} aria-pressed={tag === t}
            className={`press rounded-full px-4 py-1.5 text-sm ${tag === t ? "bg-ink text-black" : "text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </div>

      {top && <div className="mt-6"><Featured p={top} onJoin={() => setJoining(top)} /></div>}

      {rest.length > 0 && (
        <>
          <div className="mt-12 flex items-end justify-between gap-4">
            <p className="text-xl font-medium tracking-tight">More groups <span className="text-muted">· {rest.length}</span></p>
            <div className="hidden gap-2 sm:flex">
              <button type="button" onClick={() => scroll(-1)} aria-label="Previous groups" className={arrow}>
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" onClick={() => scroll(1)} aria-label="Next groups" className={arrow}>
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
          {/* Native scroll snap: swipe on touch, arrows or trackpad on desktop. */}
          <div ref={rail} className="mt-5 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-4 [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rest.map(p => <Tile key={p.id} p={p} onJoin={() => setJoining(p)} />)}
          </div>
        </>
      )}
      <JoinDialog p={joining} onClose={() => setJoining(null)} />
    </>
  );
}

// Proof next to the main action, and it's real: counts straight from the backend. Renders nothing until loaded
// or if the backend is down, so it can never show a made-up number.
export function LiveCount() {
  const [n, setN] = useState<{ groups: number; buyers: number }>();
  useEffect(() => {
    fetch("/api/products").then(r => (r.ok ? r.json() : Promise.reject())).then((ps: Product[]) => {
      const deals = ps.flatMap(p => p.open_deals);
      setN({ groups: deals.length, buyers: deals.reduce((a, d) => a + d.buyers, 0) });
    }).catch(() => {});
  }, []);
  if (!n || !n.groups) return null;
  return (
    <p className="intro mt-6 flex items-center gap-2 text-sm text-muted [--d:700ms]">
      <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-ink/60" /><span className="relative size-2 rounded-full bg-ink" /></span>
      {n.groups} {n.groups === 1 ? "group" : "groups"} filling now · {n.buyers} {n.buyers === 1 ? "buyer" : "buyers"} holding
    </p>
  );
}

