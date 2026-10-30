"use client";
// Seller dashboard: products (editable inline), groups (Close now), holds with PayPal IDs, and the activity log,
// all in AG Grid Community. One call to /api/seller feeds everything; it refreshes every 5 s.
// If the server sets SELLER_KEY, open /seller?key=… once; the key is kept in this browser and sent as x-seller-key.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, themeQuartz, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

// The site's monochrome look, applied to AG Grid's Quartz theme.
const theme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "#0c0c0c", foregroundColor: "#f2f2f2", headerBackgroundColor: "#121212", oddRowBackgroundColor: "#0e0e0e",
  borderColor: "rgba(255,255,255,0.09)", accentColor: "#f2f2f2", fontFamily: "inherit", fontSize: 14, headerFontSize: 12,
  wrapperBorderRadius: 16, rowHeight: 44, headerHeight: 40, spacing: 8,
});

type Tier = { buyers: number; price_cents: number };
type Product = { id: string; seller: string; name: string; description: string; list_cents: number; floor_cents: number; tiers: Tier[] };
type Hold = { id: number; deal_id: number; buyer: string; max_cents: number; order_id: string; authorization_id: string | null; capture_id: string | null; status: string };
type Deal = { id: number; product_id: string; product: string; target: number; status: string; price_cents: number | null; closes_at: string; ends_in_ms: number; holds: Hold[] };
type Event = { id: number; deal_id: number; at: string; type: string; data: string };
type Data = { sellers: string[]; seller: string; products: Product[]; deals: Deal[]; events: Event[] };

const $ = (c: number | null | undefined) => (c == null ? "" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
const tiersText = (t: Tier[]) => t.map(x => `${x.buyers}:${x.price_cents / 100}`).join(", ");
const parseTiers = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean).map(x => {
  const [b, p] = x.split(":").map(v => Number(v.replace("$", "").trim()));
  return { buyers: b, price_usd: p };
});
const left = (ms: number) => { const m = Math.round(ms / 60_000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return ms <= 0 ? "due" : d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`; };
const holding = (d: Deal) => d.holds.filter(h => h.status === "HELD").length;

function useKey() {
  const [key, setKey] = useState("");
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("key");
    try { if (fromUrl) localStorage.setItem("seller-key", fromUrl); setKey(fromUrl ?? localStorage.getItem("seller-key") ?? ""); } catch { setKey(fromUrl ?? ""); }
  }, []);
  return key;
}

export function Dashboard() {
  const key = useKey();
  const [seller, setSeller] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [adding, setAdding] = useState(false);

  const req = useCallback(async (method: string, url: string, body?: object) => {
    const res = await fetch(url, { method, headers: { "content-type": "application/json", ...(key ? { "x-seller-key": key } : {}) }, body: body && JSON.stringify(body) });
    const out = await res.json().catch(() => ({ error: "Something went wrong." }));
    if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
    return out;
  }, [key]);

  const load = useCallback(() => req("GET", `/api/seller${seller ? `?seller=${encodeURIComponent(seller)}` : ""}`)
    .then((d: Data) => { setData(d); if (!seller) setSeller(d.seller); })
    .catch(e => setNote({ text: e.message, bad: true })), [req, seller]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const flash = (text: string, bad = false) => { setNote({ text, bad }); setTimeout(() => setNote(n => (n?.text === text ? null : n)), 4000); };

  // Inline edit: send the whole product back; the server applies the same rules as the form.
  const saveRow = async (p: Product) => {
    try {
      await req("PATCH", `/api/seller/products/${p.id}`, { seller: p.seller, name: p.name, description: p.description,
        list_usd: p.list_cents / 100, floor_usd: p.floor_cents / 100, tiers: p.tiers.map(t => ({ buyers: t.buyers, price_usd: t.price_cents / 100 })) });
      flash(`Saved ${p.name}. New groups use these prices; open groups keep theirs.`);
    } catch (e) { flash((e as Error).message, true); }
    load();
  };
  const closeNow = async (d: Deal) => {
    if (!confirm(`Close "${d.product}" now? Holds that reach a group price are charged; otherwise every hold is released.`)) return;
    try { const r = await req("POST", `/api/seller/deals/${d.id}/close`); flash(r.status === "CAPTURED" ? `Charged everyone ${$(r.price_cents)}.` : "Group released. Nobody was charged."); }
    catch (e) { flash((e as Error).message, true); }
    load();
  };

  const productCols = useMemo<ColDef<Product>[]>(() => [
    { field: "name", editable: true, flex: 2, minWidth: 200 },
    { headerName: "Single price", field: "list_cents", editable: true, width: 130, valueFormatter: p => $(p.value),
      valueParser: p => Math.round(Number(String(p.newValue).replace("$", "")) * 100) },
    { headerName: "Lowest 🔒", field: "floor_cents", editable: true, width: 120, valueFormatter: p => $(p.value),
      valueParser: p => Math.round(Number(String(p.newValue).replace("$", "")) * 100), headerTooltip: "Never shown to buyers or the AI" },
    // Edited as text ("5:105, 20:90"), shown as "$105 at 5 · $90 at 20".
    { headerName: "Group prices", flex: 2, minWidth: 220, editable: true,
      valueGetter: p => tiersText(p.data!.tiers),
      valueFormatter: p => p.data!.tiers.map(t => `${$(t.price_cents)} at ${t.buyers}`).join(" · "),
      valueSetter: p => { p.data!.tiers = parseTiers(String(p.newValue)).map(t => ({ buyers: t.buyers, price_cents: Math.round(t.price_usd * 100) })); return true; } },
    { headerName: "Open groups", width: 120, valueGetter: p => data?.deals.filter(d => d.product_id === p.data!.id && d.status === "OPEN").length ?? 0 },
    { headerName: "Holding", width: 110, valueGetter: p => data?.deals.filter(d => d.product_id === p.data!.id).reduce((a, d) => a + holding(d), 0) ?? 0 },
  ], [data]);

  const dealCols = useMemo<ColDef<Deal>[]>(() => [
    { headerName: "#", field: "id", width: 70 },
    { field: "product", flex: 2, minWidth: 180 },
    { field: "status", width: 120, filter: true },
    { headerName: "Buyers", width: 110, valueGetter: p => `${holding(p.data!)} / ${p.data!.target}` },
    { headerName: "Price", width: 110, valueGetter: p => p.data!.price_cents, valueFormatter: p => (p.value ? $(p.value) : "—") },
    { headerName: "Ends", width: 110, valueGetter: p => (p.data!.status === "OPEN" ? left(p.data!.ends_in_ms) : "—") },
    { headerName: "", width: 130, sortable: false, cellRenderer: (p: { data: Deal }) => p.data.status === "OPEN"
      ? <button type="button" onClick={() => closeNow(p.data)} className="btn press px-3 py-1 text-xs">Close now</button> : null },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [key]);

  const holdCols = useMemo<ColDef<Hold & { product: string; price: number | null }>[]>(() => [
    { headerName: "Group", field: "deal_id", width: 90 },
    { field: "product", flex: 1, minWidth: 160 },
    { field: "buyer", width: 130 },
    { headerName: "Max", field: "max_cents", width: 100, valueFormatter: p => $(p.value) },
    { field: "status", width: 140, filter: true },
    { headerName: "Charged", width: 110, valueGetter: p => (p.data!.status === "CAPTURED" ? p.data!.price : null), valueFormatter: p => (p.value ? $(p.value) : "—") },
    { headerName: "PayPal order", field: "order_id", width: 170 },
    { headerName: "Authorization", field: "authorization_id", width: 170 },
    { headerName: "Capture", field: "capture_id", width: 170 },
  ], []);

  const eventCols = useMemo<ColDef<Event>[]>(() => [
    { headerName: "When (UTC)", field: "at", width: 170 },
    { headerName: "Group", field: "deal_id", width: 90 },
    { field: "type", width: 150, filter: true },
    { headerName: "Details", field: "data", flex: 1, minWidth: 260 },
  ], []);

  if (!data) return <p className="text-muted" aria-live="polite">{note?.text ?? "Loading your store…"}</p>;

  const holds = data.deals.flatMap(d => d.holds.map(h => ({ ...h, product: d.product, price: d.price_cents })));
  const captured = holds.filter(h => h.status === "CAPTURED").reduce((a, h) => a + (h.price ?? 0), 0);
  const stats = [
    { big: data.products.length, small: "products listed" },
    { big: data.deals.filter(d => d.status === "OPEN").length, small: "groups filling" },
    { big: holds.filter(h => h.status === "HELD").length, small: "buyers holding" },
    { big: $(captured), small: "collected" },
  ];
  // Wrapper height for each grid: fits its rows, capped so long lists scroll inside the grid.
  const grid = (h: number) => ({ style: { height: h } });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Seller">
          {data.sellers.map(s => (
            <button key={s} type="button" onClick={() => setSeller(s)} aria-pressed={s === data.seller}
              className={`press rounded-full px-4 py-1.5 text-sm ${s === data.seller ? "bg-ink text-black" : "text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:text-ink"}`}>{s}</button>
          ))}
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn press px-5 py-2.5 text-sm">+ Add product</button>
      </div>

      {note && <p role="status" className={`mt-5 rounded-xl px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] ${note.bad ? "bg-white/10 text-ink" : "bg-raised text-muted"}`}>{note.text}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.small} className="card px-5 py-5">
            <dt className="text-3xl font-medium tabular-nums tracking-tight">{s.big}</dt>
            <dd className="mt-1 text-sm text-muted">{s.small}</dd>
          </div>
        ))}
      </dl>

      <Section title="Products" hint="Double-click a cell to edit. Group prices as buyers:price, e.g. 5:105, 20:90.">
        <div {...grid(Math.min(360, 92 + data.products.length * 44))}>
          <AgGridReact theme={theme} rowData={data.products} columnDefs={productCols} getRowId={p => p.data.id}
            onCellValueChanged={e => saveRow(e.data)} stopEditingWhenCellsLoseFocus singleClickEdit={false} />
        </div>
      </Section>

      <Section title="Groups" hint="Close now settles a group immediately: charged at the best price reached, or released.">
        <div {...grid(Math.min(360, 92 + Math.max(1, data.deals.length) * 44))}>
          <AgGridReact theme={theme} rowData={data.deals} columnDefs={dealCols} getRowId={p => String(p.data.id)} overlayNoRowsTemplate="No groups yet. One opens when the first buyer joins." />
        </div>
      </Section>

      <Section title="Holds" hint="Every buyer's PayPal hold. Filter the status column to see who was charged or released.">
        <div {...grid(Math.min(420, 92 + Math.max(1, holds.length) * 44))}>
          <AgGridReact theme={theme} rowData={holds} columnDefs={holdCols} getRowId={p => String(p.data.id)} overlayNoRowsTemplate="No holds yet." />
        </div>
      </Section>

      <Section title="Negotiations" hint="At close, your agent and the buyers' agent bargain within your floor. Rejected moves are struck through.">
        <Negotiations events={data.events} deals={data.deals} />
      </Section>

      <Section title="Activity" hint="The audit trail: every open, hold, charge and release, newest first.">
        <div {...grid(360)}>
          <AgGridReact theme={theme} rowData={data.events} columnDefs={eventCols} getRowId={p => String(p.data.id)} overlayNoRowsTemplate="Nothing yet." />
        </div>
      </Section>

      <AddProduct open={adding} seller={data.seller} onClose={() => setAdding(false)}
        onSaved={p => { setAdding(false); flash(`${p.name} is listed. Buyers can join it now.`); load(); }} req={req} />
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

// Side panel form, same rules as the server; the server's message shows if a rule fails.
function AddProduct({ open, seller, onClose, onSaved, req }: {
  open: boolean; seller: string; onClose: () => void; onSaved: (p: Product) => void;
  req: (m: string, u: string, b?: object) => Promise<Product>;
}) {
  const blank = { name: "", description: "", list: "", floor: "", tiers: [{ buyers: "10", price: "" }] };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(blank); setErr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = Number(f.list);
  const save = (p: string) => (list > 0 && Number(p) > 0 && Number(p) < list ? `save ${Math.round((1 - Number(p) / list) * 100)}%` : "");
  const field = "rounded-xl border border-line bg-raised px-3.5 py-2.5 outline-none focus:border-white/40";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      onSaved(await req("POST", "/api/seller/products", { seller, name: f.name, description: f.description, list_usd: Number(f.list), floor_usd: Number(f.floor),
        tiers: f.tiers.map(t => ({ buyers: Number(t.buyers), price_usd: Number(t.price) })) }));
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <aside aria-label="Add product" aria-hidden={!open} inert={!open}
      className={`fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-[#141414] shadow-[-24px_0_60px_rgba(0,0,0,0.6),inset_1px_0_0_var(--line)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:w-[460px] ${open ? "translate-x-0" : "translate-x-full"}`}>
      <form onSubmit={submit} className="flex min-h-full flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Add product <span className="text-muted">· {seller}</span></h2>
          <button type="button" onClick={onClose} aria-label="Close" className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-ink">✕</button>
        </div>
        <label className="grid gap-1.5 text-sm">Name<input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={field} placeholder="Mechanical keyboard (75%)" /></label>
        <label className="grid gap-1.5 text-sm">Description
          <textarea required rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={field} placeholder="Compact 75%, hot-swap, wireless…" />
          <span className="text-xs text-muted">The AI matches buyers on this, so be specific.</span>
        </label>
        <label className="grid gap-1.5 text-sm">Single price ($)
          <input required type="number" min="1" step="any" value={f.list} onChange={e => setF({ ...f, list: e.target.value })} className={field} />
          <span className="text-xs text-muted">What one buyer pays alone. Nobody is ever held for more.</span>
        </label>
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1.5">Group prices</legend>
          {f.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={`Buyers for group price ${i + 1}`} type="number" min="2" value={t.buyers} placeholder="Buyers"
                onChange={e => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, buyers: e.target.value } : x)) })} className={`${field} w-24`} />
              <span className="text-muted">buyers →</span>
              <input aria-label={`Price for group price ${i + 1}`} type="number" min="1" step="any" value={t.price} placeholder="$"
                onChange={e => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} className={`${field} w-28`} />
              <span className="w-20 text-xs text-muted">{save(t.price)}</span>
              {f.tiers.length > 1 && <button type="button" aria-label="Remove group price" onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })} className="text-muted hover:text-ink">✕</button>}
            </div>
          ))}
          {f.tiers.length < 3 && <button type="button" onClick={() => setF({ ...f, tiers: [...f.tiers, { buyers: "", price: "" }] })} className="justify-self-start text-sm text-muted hover:text-ink">+ add group price</button>}
        </fieldset>
        <label className="grid gap-1.5 text-sm">Lowest price ($) 🔒
          <input required type="number" min="1" step="any" value={f.floor} onChange={e => setF({ ...f, floor: e.target.value })} className={field} />
          <span className="text-xs text-muted">Never shown to buyers or the AI. No group closes below it.</span>
        </label>
        {err && <p role="alert" className="rounded-xl bg-white/10 px-4 py-3 text-sm">{err}</p>}
        <div className="mt-auto flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="btn-ghost press px-5 py-2.5 text-sm">Cancel</button>
          <button disabled={busy} className="btn press px-5 py-2.5 text-sm disabled:opacity-50">{busy ? "Listing…" : "List it"}</button>
        </div>
      </form>
    </aside>
  );
}

// Each NEGOTIATED event as a chat: buyers' agent left, your agent right, the referee's rejections struck through.
type Turn = { round: number; by: "pool" | "seller"; action: "offer" | "accept"; price_cents: number; message: string; rejected?: string };
type Neg = { from_cents: number; to_cents: number; agreed: boolean; buyers_before: number; buyers_after: number; turns: Turn[] };
function Negotiations({ events, deals }: { events: Event[]; deals: Deal[] }) {
  const negs = events.filter(e => e.type === "NEGOTIATED").map(e => ({ e, n: JSON.parse(e.data) as Neg }));
  if (!negs.length) return <p className="card px-5 py-6 text-sm text-muted">None yet. A negotiation runs when a group closes with buyers who would be released at the earned price.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {negs.map(({ e, n }) => (
        <article key={e.id} className="card p-5 sm:p-6">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">{deals.find(d => d.id === e.deal_id)?.product ?? "Group"} <span className="text-muted">#{e.deal_id}</span></h3>
            <p className="text-sm tabular-nums"><span className="text-muted line-through">{$(n.from_cents)}</span> → <b>{$(n.to_cents)}</b>
              <span className="text-muted"> · {n.buyers_before} → {n.buyers_after} buyers · {n.agreed ? "agreed" : "no deal, last offer"}</span></p>
          </header>
          <ol className="mt-4 grid gap-2.5 text-sm">
            {n.turns.map((t, i) => (
              <li key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${t.by === "seller" ? "ml-auto rounded-br-md bg-[#2a2a2a]" : "rounded-bl-md bg-raised shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                <p className="flex justify-between gap-3 text-xs text-muted">
                  <span>{t.by === "seller" ? "Your agent" : "Buyers' agent"} · round {t.round}</span>
                  <span className={`font-medium tabular-nums ${t.rejected ? "line-through" : "text-ink"}`}>{t.action === "accept" ? `Accept ${$(t.price_cents)}` : $(t.price_cents)}</span>
                </p>
                {t.message && <p className={`mt-1 ${t.rejected ? "text-muted line-through" : ""}`}>{t.message}</p>}
                {t.rejected && <p className="mt-1 text-xs text-muted">Rejected by the referee: {t.rejected}</p>}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
