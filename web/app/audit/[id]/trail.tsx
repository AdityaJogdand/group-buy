"use client";
// Proof page: every step of one group, in order, with the PayPal id of each money movement.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Ev = { at: string; type: string; data: Record<string, string | number> };

// type -> [what happened, detail line]. Unknown types (leave/void reasons) fall back to the raw name.
const copy: Record<string, (d: Ev["data"]) => [string, string?]> = {
  DEAL_OPENED: d => ["Group opened", `Needs ${d.target} buyers. Solo price $${Number(d.listCents) / 100}.`],
  HELD: d => ["Hold placed", `$${d.amount} authorized, not charged.`],
  CLOSING: d => ["Group filled", `Price agreed at $${d.price} for ${d.payers} buyers.`],
  CAPTURED: d => ["Charged", `$${d.amount}, the group price.`],
  CAPTURE_FAILED: () => ["Charge failed", "Retried on its own."],
  EXPIRED: () => ["Group ended short", "Every hold voided. Nobody was charged."],
};

function Id({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`} className="press mt-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-raised px-2.5 py-1 text-xs shadow-[inset_0_0_0_1px_var(--line)]"
      onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }, () => {})}>
      <span className="text-muted">{label}</span><code className="truncate tabular-nums">{value}</code><span aria-live="polite" className="text-muted">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function Trail() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`/api/deals/${encodeURIComponent(id)}/events`).then(r => (r.ok ? r.json() : Promise.reject())).then(setEvents, () => setFailed(true));
  }, [id]);

  if (failed) return <p className="text-xl text-muted">No record for this group.</p>;
  if (!events) return <p className="text-xl text-muted" aria-live="polite">Loading the record…</p>;

  return (
    <>
      <h1 className="display text-[clamp(2.5rem,5vw,4rem)]">Every step, on the record.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Each charge and hold below carries its PayPal id. Nothing here is edited after the fact.</p>
      <ol className="mt-12 border-l border-line">
        {events.map((e, i) => {
          const [title, body] = copy[e.type]?.(e.data) ?? [e.type, undefined];
          return (
            <li key={i} className="relative pb-8 pl-7 last:pb-0">
              <span aria-hidden className="absolute -left-[5px] top-2 size-2.5 rounded-full bg-ink" />
              <p className="font-medium">{title}</p>
              {body && <p className="text-muted">{body}</p>}
              <time className="text-xs text-muted" dateTime={e.at}>{new Date(`${e.at.replace(" ", "T")}Z`).toLocaleString()}</time>
              <div>
                {e.data.authorizationId && <Id label="Authorization" value={String(e.data.authorizationId)} />}
                {e.data.captureId && <Id label="Capture" value={String(e.data.captureId)} />}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
