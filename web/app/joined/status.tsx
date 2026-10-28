"use client";
// The buyer lands here from PayPal. Left: what happened. Right: a receipt of the hold and the live group.
import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { photos, dollars, timeLeft, type Product } from "../groups";

type HoldStatus = {
  hold_status: string; hold_amount: string;
  deal: { deal_id: number; product_id: string; product: string; status: string; buyers: number; target: number; price?: string };
};

const h1 = "display text-[clamp(3rem,6vw,5rem)]";
const primary = "btn press px-7 py-3.5 text-lg";

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className={h1}>{title}</h1>
      <p className="mt-6 text-2xl leading-snug text-muted">{body}</p>
      <a href="/listed-product" className={`${primary} mt-10`}>Back to groups</a>
    </div>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-live="polite" className="btn-ghost press px-6 py-3.5 text-lg"
      onClick={() => navigator.clipboard?.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {})}>
      {copied ? "Link copied ✓" : "Copy link"}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-base text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-2xl font-semibold tracking-tight" : "text-lg font-medium"}`}>{value}</dd>
    </div>
  );
}

// Three steps; the first is done the moment the buyer lands here.
function Timeline({ next }: { next: string }) {
  const steps = [
    { title: "Hold placed", body: "PayPal is holding your max. Nothing is charged.", done: true },
    { title: "The group fills", body: next, done: false },
    { title: "Deadline", body: "Everyone pays the group price, or every hold is released.", done: false },
  ];
  return (
    <ol className="mt-2 grid gap-4">
      {steps.map(s => (
        <li key={s.title} className="flex gap-3">
          <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-ink text-black" : "border-2 border-white/15"}`}>
            {s.done ? "✓" : ""}
          </span>
          <span>
            <span className="block font-medium">{s.title}{s.done && <span className="sr-only"> (done)</span>}</span>
            <span className="block text-base text-muted">{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Receipt({ s, p }: { s: HoldStatus; p?: Product }) {
  const photo = photos[s.deal.product_id];
  const deal = p?.open_deals.find(d => d.deal_id === s.deal.deal_id);
  const list = p ? dollars(p.list_price) : dollars(s.hold_amount);
  const tiers = (p?.group_prices ?? []).map(t => ({ buyers: t.buyers, price: dollars(t.price) }));
  const buyers = s.deal.buyers;
  const price = tiers.reduce((x, t) => (buyers >= t.buyers ? t.price : x), list);
  const next = tiers.find(t => t.buyers > buyers);
  const seats = tiers.at(-1)?.buyers ?? s.deal.target;
  const nextText = next ? `${next.buyers - buyers} more buyers unlock $${next.price} for everyone.` : "The best group price is unlocked.";

  return (
    <article className="card p-6 sm:p-8">
      {photo && (
        <div className="overflow-hidden rounded-[20px]">
          <Image src={`/products/${photo.file}.jpg`} alt="" width={900} height={675} sizes="(min-width: 768px) 40vw, 90vw" priority
            className="aspect-[16/9] w-full object-cover" />
        </div>
      )}
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">{s.deal.product}</h2>
      {p && <p className="text-lg text-muted">by {p.seller}</p>}

      <dl className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
        <Row label="On hold" value={s.hold_amount} strong />
        <Row label="Group price now" value={<>${price}{price < list && <s className="ml-2 text-base font-normal text-muted">${list}</s>}</>} />
        {deal && <Row label="Ends in" value={timeLeft(deal.ends_in_ms)} />}
      </dl>

      <div className="mt-6 grid grid-cols-15 gap-[3px]" role="img" aria-label={`${buyers} of ${seats} buyers`}>
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={`aspect-square rounded-[3px] ${i < buyers ? "bg-ink" : "bg-white/10"}`} />
        ))}
      </div>
      <p className="mt-3 text-base text-muted">{buyers} joined · {nextText}</p>

      <div className="mt-6 border-t border-ink/10 pt-6">
        <Timeline next={nextText} />
      </div>
    </article>
  );
}

export function Status() {
  const q = useSearchParams();
  const hold = q.get("hold");
  const [s, setS] = useState<HoldStatus | null>(null);
  const [p, setP] = useState<Product>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hold) return;
    // Poll so the count moves while the buyer watches; product list adds tiers and time left.
    const load = () => Promise.all([
      fetch(`/api/holds/${encodeURIComponent(hold)}`).then(r => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/products").then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([status, products]: [HoldStatus, Product[]]) => {
      setS(status);
      setP(products.find(x => x.id === status.deal.product_id));
    }).catch(() => setFailed(true));
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [hold]);

  if (q.has("cancelled")) return <Message title="No hold placed." body="You cancelled in PayPal. Nothing was charged." />;
  if (q.has("error") || !hold || failed)
    return <Message title="Hold not placed." body="The approval didn't go through, or the group already closed. Nothing was charged." />;
  if (!s) return <p className="text-xl" aria-live="polite">Checking your hold…</p>;
  // A bookmarked page outlives the open group: say how it ended.
  if (s.hold_status === "CAPTURED") return <Message title="The group closed." body={`${s.deal.product}: you paid the group price, ${s.deal.price}.`} />;
  if (s.hold_status !== "HELD" && s.hold_status !== "PENDING")
    return <Message title="Hold released." body={`${s.deal.product}: nothing was charged.`} />;

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20 [&>*]:min-w-0">
      <div>
        <span aria-hidden className="pop-in grid size-16 place-items-center rounded-full bg-ink text-3xl text-black">✓</span>
        <h1 className={`${h1} mt-8`}>You&apos;re in.</h1>
        <p className="mt-6 max-w-xl text-2xl leading-snug text-muted">
          PayPal is holding <b className="text-ink">{s.hold_amount}</b> for {s.deal.product}. At the deadline you pay the group price, never more.
          If the group doesn&apos;t fill, the hold is released and you pay nothing.
        </p>
        <p className="mt-6 max-w-xl text-lg text-muted">Share the group: every buyer who joins lowers the price for you too.</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href="/listed-product" className={primary}>Back to groups</a>
          <CopyLink />
        </div>
      </div>
      <Receipt s={s} p={p} />
    </div>
  );
}
