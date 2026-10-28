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

// Apple store-style tile: product photo full-bleed on top, then centered name, price line, a slim progress bar
// with the tiers marked, and two centered actions.
function GroupCard({ p, onJoin }: { p: Product; onJoin: () => void }) {
  const photo = photos[p.id];
  const deal = [...p.open_deals].sort((a, b) => b.buyers - a.buyers)[0];
  const buyers = deal?.buyers ?? 0;
  const list = dollars(p.list_price);
  const tiers = p.group_prices.map(t => ({ buyers: t.buyers, price: dollars(t.price) }));
  const price = tiers.reduce((x, t) => (buyers >= t.buyers ? t.price : x), list);
  const next = tiers.find(t => t.buyers > buyers);
  const best = tiers.at(-1);
  const seats = best?.buyers ?? 10;
  return (
    <article className="card reveal group flex flex-col overflow-hidden text-center transition-transform duration-300 ease-out hover:-translate-y-1">
      <div className="relative overflow-hidden">
        <Image src={`/products/${photo.file}.jpg`} alt={p.name} width={900} height={675} sizes="(min-width: 768px) 30vw, 90vw"
          className="aspect-[16/10] w-full object-cover grayscale transition-[transform,filter] duration-500 ease-out group-hover:scale-[1.03] group-hover:grayscale-0" />
        <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-medium backdrop-blur-md">
          {deal ? `Ends in ${timeLeft(deal.ends_in_ms)}` : "New group"}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 pb-6 pt-5">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{photo.tag}</p>
        <h3 className="mt-1.5 text-balance text-xl font-medium leading-tight tracking-tight">{p.name}</h3>
        <p className="mt-0.5 text-sm text-muted">by {p.seller}</p>

        <p className="mt-4 tabular-nums">
          <span className="text-lg font-medium">${price}</span>
          {price < list ? <s className="ml-1.5 text-muted">${list}</s> : <span className="text-muted"> solo</span>}
          {best && <span className="text-sm text-muted"> · ${best.price} at {best.buyers}</span>}
        </p>

        {/* Progress toward the biggest tier, with a tick at each price break. */}
        <div className="mt-auto w-full max-w-64 pt-4">
          <div className="relative h-1.5 rounded-full bg-white/10" role="img" aria-label={`${buyers} of ${seats} buyers`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(buyers / seats) * 100}%` }} />
            {tiers.slice(0, -1).map(t => (
              <span key={t.buyers} className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-white/40" style={{ left: `${(t.buyers / seats) * 100}%` }} />
            ))}
          </div>
          <p className="mt-2.5 text-sm text-muted">
            {buyers} of {seats} joined · {next ? `${next.buyers - buyers} more unlock $${next.price}` : "best price unlocked"}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <button type="button" onClick={onJoin} className="btn press px-5 py-2 text-sm">{deal ? "Join group" : "Start a group"}</button>
          <a href="#how" className="text-sm text-ink/80 hover:text-ink hover:underline">How it works ›</a>
        </div>
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
            <span className="text-sm font-normal text-muted">
              PayPal holds this amount. You pay the group price at the deadline, never more. If the group doesn&apos;t fill, the hold is released.
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
  return (
    <>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {products.map(p => <GroupCard key={p.id} p={p} onJoin={() => setJoining(p)} />)}
      </div>
      <JoinDialog p={joining} onClose={() => setJoining(null)} />
    </>
  );
}
