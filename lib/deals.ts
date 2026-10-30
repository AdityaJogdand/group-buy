// Deal money path. Rules from PRD §7 live here, not in the model:
// price within [floor, list], charge <= each buyer's hold, all holds settle together.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { paypal } from './paypal.ts';
import { negotiate, llmAgent, payers, type Agent, type Side } from './negotiate.ts';

export type DealStatus = 'OPEN' | 'CLOSING' | 'CAPTURED' | 'EXPIRED';
export type HoldStatus = 'PENDING' | 'HELD' | 'CAPTURED' | 'CAPTURE_FAILED' | 'DROPPED' | 'LEFT' | 'VOIDED' | 'EXPIRED';
export type Tier = { buyers: number; price_cents: number };
export type Product = {
  id: string; seller: string; name: string; description: string;
  list_cents: number; floor_cents: number; tiers: Tier[];
};
// `product` is the product's name (joined in getDeal). list/floor are copied at open,
// so a seller editing prices later can't change a deal people already joined.
export type Deal = {
  id: number; product_id: string; product: string; list_cents: number; floor_cents: number;
  target: number; status: DealStatus; price_cents: number | null; closes_at: string; tiers_json: string | null;
};
export type Hold = {
  id: number; deal_id: number; buyer: string; max_cents: number; order_id: string;
  authorization_id: string | null; capture_id: string | null; status: HoldStatus;
};

export const db = new DatabaseSync(process.env.DB_PATH ?? 'groupbuy.db');
db.exec(`
  create table if not exists products (
    id text primary key, seller text not null, name text not null, description text not null,
    list_cents int not null, floor_cents int not null, tiers_json text not null,
    check (floor_cents > 0 and floor_cents <= list_cents));
  create table if not exists deals (
    id integer primary key, product_id text not null references products, list_cents int not null, floor_cents int not null,
    target int not null, status text not null default 'OPEN', price_cents int, closes_at text not null);
  create table if not exists holds (
    id integer primary key, deal_id int not null references deals, buyer text not null, max_cents int not null,
    order_id text unique, authorization_id text, capture_id text, status text not null default 'PENDING');
  create table if not exists events (
    id integer primary key, deal_id int, at text not null default (datetime('now')), type text not null, data text);
`);
// Deals copy their tiers at open (like list and floor), so seller edits never change a deal people joined.
// Added after launch: older databases get the column here; their deals fall back to the product's tiers.
if (!(db.prepare("select 1 from pragma_table_info('deals') where name = 'tiers_json'").get())) db.exec('alter table deals add column tiers_json text');

const usd = (cents: number) => (cents / 100).toFixed(2);
const log = (dealId: number, type: string, data: object) =>
  db.prepare('insert into events (deal_id, type, data) values (?, ?, ?)').run(dealId, type, JSON.stringify(data));
// Demo catalog. `insert or ignore`: re-seeding on every boot never duplicates or overwrites seller edits.
// Sellers and products are made up; no real brands.
const CATALOG: Product[] = [
  { id: 'ux-course', seller: 'Lena', name: 'UX Design Course',
    description: '8-week online course in user research, wireframing and prototyping.',
    list_cents: 20000, floor_cents: 12000, tiers: [{ buyers: 10, price_cents: 18000 }, { buyers: 20, price_cents: 16000 }] },
  { id: 'design-seat', seller: 'Lena', name: 'Design software seat (1 year)',
    description: 'One-year license seat for a professional design and prototyping app.',
    list_cents: 12000, floor_cents: 7000, tiers: [{ buyers: 5, price_cents: 10500 }, { buyers: 20, price_cents: 9000 }] },
  { id: 'design-workshop', seller: 'Lena', name: 'Live design workshop',
    description: 'Two-day live online workshop on design systems with a senior designer.',
    list_cents: 30000, floor_cents: 18000, tiers: [{ buyers: 10, price_cents: 26000 }, { buyers: 25, price_cents: 22000 }] },
  { id: 'headphones', seller: 'Sound Supply', name: 'Noise-cancelling headphones',
    description: 'Over-ear wireless headphones with active noise cancelling and 30-hour battery.',
    list_cents: 35000, floor_cents: 23000, tiers: [{ buyers: 10, price_cents: 30000 }, { buyers: 25, price_cents: 27000 }] },
  { id: 'keyboard', seller: 'KeyLab', name: 'Mechanical keyboard (75%)',
    description: 'Compact 75% mechanical keyboard, hot-swappable switches, wireless and USB-C.',
    list_cents: 15000, floor_cents: 9500, tiers: [{ buyers: 10, price_cents: 13000 }, { buyers: 30, price_cents: 11500 }] },
  { id: 'monitor', seller: 'Pixel Works', name: '27-inch 4K monitor',
    description: '27-inch 4K IPS monitor with USB-C power delivery, for work and design.',
    list_cents: 40000, floor_cents: 28000, tiers: [{ buyers: 5, price_cents: 36000 }, { buyers: 15, price_cents: 33000 }] },
  { id: 'coffee-beans', seller: 'Roastery Row', name: 'Specialty coffee beans (1 kg)',
    description: 'Freshly roasted single-origin coffee beans, 1 kg bag, whole bean or ground.',
    list_cents: 4000, floor_cents: 2400, tiers: [{ buyers: 20, price_cents: 3400 }, { buyers: 50, price_cents: 3000 }] },
];
const seed = db.prepare(`insert or ignore into products (id, seller, name, description, list_cents, floor_cents, tiers_json)
  values (?, ?, ?, ?, ?, ?, ?)`);
for (const p of CATALOG) seed.run(p.id, p.seller, p.name, p.description, p.list_cents, p.floor_cents, JSON.stringify(p.tiers));

const toProduct = ({ tiers_json, ...p }: any): Product => ({ ...p, tiers: JSON.parse(tiers_json) });
export const getProduct = (id: string) => {
  const row = db.prepare('select * from products where id = ?').get(id);
  return row && toProduct(row);
};
export const getProducts = () => db.prepare('select * from products order by id').all().map(toProduct);
export const getDeal = (id: number) => db.prepare(
  'select d.*, p.name as product from deals d join products p on p.id = d.product_id where d.id = ?',
).get(id) as Deal | undefined;
export const getHolds = (dealId: number) =>
  db.prepare('select * from holds where deal_id = ? order by id').all(dealId) as Hold[];
export const getHold = (where: 'id' | 'order_id', value: number | string) =>
  db.prepare(`select * from holds where ${where} = ?`).get(value) as Hold | undefined;
const setHold = (id: number, fields: Partial<Hold>) => {
  const keys = Object.keys(fields);
  db.prepare(`update holds set ${keys.map(k => `${k} = ?`).join(', ')} where id = ?`)
    .run(...(Object.values(fields) as SQLInputValue[]), id);
};
const mustGetDeal = (id: number) => {
  const deal = getDeal(id);
  if (!deal) throw new Error(`unknown deal ${id}`);
  return deal;
};

export function createDeal({ productId, target, closesAt }: { productId: string; target: number; closesAt: Date }) {
  const product = getProduct(productId);
  if (!product) throw new Error(`unknown product ${productId}`);
  if (!(Number.isInteger(target) && target > 0)) throw new Error('bad deal terms');
  const { lastInsertRowid } = db.prepare(
    'insert into deals (product_id, list_cents, floor_cents, target, closes_at, tiers_json) values (?, ?, ?, ?, ?, ?)',
  ).run(productId, product.list_cents, product.floor_cents, target, closesAt.toISOString(), JSON.stringify(product.tiers));
  const id = Number(lastInsertRowid);
  log(id, 'DEAL_OPENED', { productId, listCents: product.list_cents, target });
  return id;
}

// Creates the PayPal order for a buyer's hold. returnUrl only for the redirect flow (simulated buyers).
export async function startHold(dealId: number, buyer: string, maxCents: number, { returnUrl }: { returnUrl?: string } = {}) {
  const deal = getDeal(dealId);
  if (deal?.status !== 'OPEN') throw new Error(`deal ${dealId} is not open`);
  if (!(Number.isInteger(maxCents) && maxCents > 0 && maxCents <= deal.list_cents)) throw new Error('max price out of range');
  const order = await paypal('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{ reference_id: `deal-${dealId}`, description: deal.product,
      amount: { currency_code: 'USD', value: usd(maxCents) } }],
    ...(returnUrl && { payment_source: { paypal: { experience_context: {
      user_action: 'CONTINUE', return_url: returnUrl, cancel_url: returnUrl + '?cancel' } } } }),
  });
  const { lastInsertRowid } = db.prepare('insert into holds (deal_id, buyer, max_cents, order_id) values (?, ?, ?, ?)')
    .run(dealId, buyer, maxCents, order.id);
  const approveUrl: string = order.links.find((l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  return { holdId: Number(lastInsertRowid), orderId: order.id as string, approveUrl };
}

// After buyer approval: place the hold.
export async function authorizeHold(orderId: string): Promise<Hold> {
  const hold = getHold('order_id', orderId);
  if (!hold) throw new Error(`unknown order ${orderId}`);
  if (hold.status !== 'PENDING') return hold;
  if (mustGetDeal(hold.deal_id).status !== 'OPEN') throw new Error('deal no longer open');
  const data = await paypal('POST', `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const auth = data.purchase_units[0].payments.authorizations[0];
  setHold(hold.id, { authorization_id: auth.id, status: 'HELD' });
  log(hold.deal_id, 'HELD', { holdId: hold.id, authorizationId: auth.id, amount: auth.amount.value });
  return { ...hold, authorization_id: auth.id, status: 'HELD' };
}

async function voidHold(hold: Hold, reason: 'LEFT' | 'DROPPED' | 'VOIDED') {
  await paypal('POST', `/v2/payments/authorizations/${hold.authorization_id}/void`, {}, `void-${hold.authorization_id}`);
  setHold(hold.id, { status: reason });
  log(hold.deal_id, reason, { holdId: hold.id, authorizationId: hold.authorization_id });
}

export async function leaveDeal(holdId: number) {
  const hold = getHold('id', holdId);
  if (hold?.status !== 'HELD' || mustGetDeal(hold.deal_id).status !== 'OPEN') throw new Error('cannot leave now');
  await voidHold(hold, 'LEFT');
}

// Holds whose max >= price are captured at price; the rest are voided. Re-run on a
// CLOSING deal to retry failed captures (request IDs make the retry safe).
export async function closeDeal(dealId: number, priceCents: number): Promise<Deal> {
  const deal = mustGetDeal(dealId);
  if (deal.status === 'CLOSING' && deal.price_cents !== priceCents) throw new Error('deal already closing at another price');
  if (deal.status !== 'OPEN' && deal.status !== 'CLOSING') throw new Error(`deal ${dealId} is ${deal.status}`);
  if (!(Number.isInteger(priceCents) && priceCents >= deal.floor_cents && priceCents <= deal.list_cents))
    throw new Error('price outside [floor, list]');
  const holds = getHolds(dealId);
  const payers = holds.filter(h => (h.status === 'HELD' || h.status === 'CAPTURE_FAILED') && h.max_cents >= priceCents);
  if (deal.status === 'OPEN' && payers.length < deal.target) throw new Error(`only ${payers.length} of ${deal.target} buyers at that price`);

  db.prepare("update deals set status = 'CLOSING', price_cents = ? where id = ?").run(priceCents, dealId);
  log(dealId, 'CLOSING', { price: usd(priceCents), payers: payers.length });
  for (const h of holds) {
    if (h.status === 'PENDING') setHold(h.id, { status: 'EXPIRED' });
    else if (h.status === 'HELD' && h.max_cents < priceCents) await voidHold(h, 'DROPPED');
  }
  for (const h of payers) {
    try {
      const cap = await paypal('POST', `/v2/payments/authorizations/${h.authorization_id}/capture`,
        { amount: { currency_code: 'USD', value: usd(priceCents) }, final_capture: true }, `capture-${h.authorization_id}-${priceCents}`);
      setHold(h.id, { capture_id: cap.id, status: 'CAPTURED' });
      log(dealId, 'CAPTURED', { holdId: h.id, captureId: cap.id, amount: usd(priceCents) });
    } catch (e) {
      setHold(h.id, { status: 'CAPTURE_FAILED' });
      log(dealId, 'CAPTURE_FAILED', { holdId: h.id, error: (e as Error).message });
    }
  }
  const failed = getHolds(dealId).some(h => h.status === 'CAPTURE_FAILED');
  if (!failed) db.prepare("update deals set status = 'CAPTURED' where id = ?").run(dealId);
  return mustGetDeal(dealId);
}

// Re-run on an EXPIRED deal to finish voids a crash interrupted (request IDs make the retry safe).
export async function expireDeal(dealId: number) {
  const { status } = mustGetDeal(dealId);
  if (status !== 'OPEN' && status !== 'EXPIRED') throw new Error('only open deals expire');
  if (status === 'OPEN') {
    db.prepare("update deals set status = 'EXPIRED' where id = ?").run(dealId);
    log(dealId, 'EXPIRED', {});
  }
  for (const h of getHolds(dealId)) {
    if (h.status === 'HELD') await voidHold(h, 'VOIDED');
    else if (h.status === 'PENDING') setHold(h.id, { status: 'EXPIRED' });
  }
}

// Lowest tier price the held buyers reach: enough buyers whose max covers it, and at least `target`.
// Tiers outside [floor, list] are skipped (closeDeal would refuse them). null = no tier reached.
export function tierPrice(deal: Pick<Deal, 'target' | 'floor_cents' | 'list_cents'>, tiers: Tier[], maxes: number[]): number | null {
  const reached = tiers.filter(t => t.price_cents >= deal.floor_cents && t.price_cents <= deal.list_cents &&
    maxes.filter(m => m >= t.price_cents).length >= Math.max(t.buyers, deal.target));
  return reached.length ? Math.min(...reached.map(t => t.price_cents)) : null;
}

// Settle one deal now: find the best tier its holds reach (tiers copied at open); if some holders would be
// released at that price, the pool and seller agents negotiate (lib/negotiate.ts) for a lower one that keeps
// them in. Then capture at the agreed price, or expire (void every hold) if no tier was reached.
// Used by the clock at closes_at and by the seller's "Close now". `agents` is swappable for tests.
// ponytail: a crash mid-close leaves the deal CLOSING; re-run closeDeal by hand (request IDs keep it safe).
const settling = new Set<number>();
export async function settleDeal(id: number, agents: Record<Side, Agent> | null = process.env.LLM_BASE_URL ? { pool: llmAgent, seller: llmAgent } : null) {
  if (settling.has(id)) throw new Error('This group is already closing.');
  settling.add(id);
  try {
    const deal = mustGetDeal(id);
    const tiers: Tier[] = deal.tiers_json ? JSON.parse(deal.tiers_json) : getProduct(deal.product_id)?.tiers ?? [];
    const maxes = getHolds(id).filter(h => h.status === 'HELD').map(h => h.max_cents);
    let price = deal.status === 'OPEN' ? tierPrice(deal, tiers, maxes) : null;
    if (price && agents && maxes.some(m => m < price! && m >= deal.floor_cents)) {
      const from = price;
      try {
        const r = await negotiate({ product: deal.product, list_cents: deal.list_cents, floor_cents: deal.floor_cents,
          start_cents: from, maxes, target: deal.target }, agents);
        price = r.price_cents;
        log(id, 'NEGOTIATED', { from_cents: from, to_cents: price, agreed: r.agreed, buyers_before: payers(maxes, from), buyers_after: payers(maxes, price), turns: r.turns });
      } catch (e) {
        log(id, 'NEGOTIATION_FAILED', { error: (e as Error).message, price_cents: from });
      }
    }
    if (price) await closeDeal(id, price);
    else await expireDeal(id);
    return mustGetDeal(id);
  } finally {
    settling.delete(id);
  }
}

// Call on a timer; pass a fake `now` for the demo clock. Also resumes half-voided expired deals.
export async function settleDue(now = new Date()) {
  const due = db.prepare(`select id from deals where (status = 'OPEN' and closes_at <= ?)
    or (status = 'EXPIRED' and exists (select 1 from holds where deal_id = deals.id and status = 'HELD'))`)
    .all(now.toISOString()) as { id: number }[];
  for (const { id } of due) await settleDeal(id);
}

// Seller product rules (FRONTEND.md). Returns the first broken rule as a message for the form, or null.
export function productError(p: { name: string; description: string; list_cents: number; floor_cents: number; tiers: Tier[] }): string | null {
  const $ = (c: number) => `$${c / 100}`;
  const cents = (n: unknown) => Number.isInteger(n) && (n as number) > 0;
  if (!p.name?.trim()) return 'Name is required.';
  if (!p.description?.trim()) return 'Description is required.';
  if (!cents(p.list_cents)) return 'Single price must be more than $0.';
  if (!cents(p.floor_cents)) return 'Lowest price must be more than $0.';
  if (p.floor_cents > p.list_cents) return `Lowest price ${$(p.floor_cents)} is above the single price ${$(p.list_cents)}.`;
  if (!Array.isArray(p.tiers) || p.tiers.length < 1 || p.tiers.length > 3) return 'Add 1 to 3 group prices.';
  for (const [i, t] of p.tiers.entries()) {
    if (!(Number.isInteger(t.buyers) && t.buyers >= 2)) return 'Each group price needs at least 2 buyers.';
    if (!cents(t.price_cents)) return 'Each group price must be more than $0.';
    if (t.price_cents > p.list_cents) return `Group price ${$(t.price_cents)} is above the single price ${$(p.list_cents)}.`;
    if (t.price_cents < p.floor_cents) return `Group price ${$(t.price_cents)} is below your lowest price ${$(p.floor_cents)}.`;
    const prev = p.tiers[i - 1];
    if (prev && t.buyers <= prev.buyers) return 'Each group price needs more buyers than the one before.';
    if (prev && t.price_cents >= prev.price_cents) return 'More buyers must mean a lower price.';
  }
  return null;
}

// Insert (no id) or update a seller's product. Throws the rule message on bad input.
export function saveProduct(seller: string, p: { id?: string; name: string; description: string; list_cents: number; floor_cents: number; tiers: Tier[] }): Product {
  const err = productError(p);
  if (err) throw new Error(err);
  if (p.id) {
    const cur = getProduct(p.id);
    if (!cur || cur.seller !== seller) throw new Error('Not your product.');
    db.prepare('update products set name = ?, description = ?, list_cents = ?, floor_cents = ?, tiers_json = ? where id = ?')
      .run(p.name.trim(), p.description.trim(), p.list_cents, p.floor_cents, JSON.stringify(p.tiers), p.id);
    return getProduct(p.id)!;
  }
  const base = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  let id = base;
  for (let n = 2; getProduct(id); n++) id = `${base}-${n}`;
  db.prepare('insert into products (id, seller, name, description, list_cents, floor_cents, tiers_json) values (?, ?, ?, ?, ?, ?, ?)')
    .run(id, seller.trim(), p.name.trim(), p.description.trim(), p.list_cents, p.floor_cents, JSON.stringify(p.tiers));
  return getProduct(id)!;
}
