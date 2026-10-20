// Deal money path. Rules from PRD §7 live here, not in the model:
// price within [floor, list], charge <= each buyer's hold, all holds settle together.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { paypal } from './paypal.ts';

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
  target: number; status: DealStatus; price_cents: number | null; closes_at: string;
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

const usd = (cents: number) => (cents / 100).toFixed(2);
const log = (dealId: number, type: string, data: object) =>
  db.prepare('insert into events (deal_id, type, data) values (?, ?, ?)').run(dealId, type, JSON.stringify(data));
// Demo catalog. `insert or ignore`: re-seeding on every boot never duplicates or overwrites seller edits.
// ponytail: seed lives in code; move to a seller form when the dashboard edits products.
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
    'insert into deals (product_id, list_cents, floor_cents, target, closes_at) values (?, ?, ?, ?, ?)',
  ).run(productId, product.list_cents, product.floor_cents, target, closesAt.toISOString());
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

// Call on a timer; pass a fake `now` for the demo clock. Also resumes half-voided expired deals.
export async function expireDue(now = new Date()) {
  const due = db.prepare(`select id from deals where (status = 'OPEN' and closes_at <= ?)
    or (status = 'EXPIRED' and exists (select 1 from holds where deal_id = deals.id and status = 'HELD'))`)
    .all(now.toISOString()) as { id: number }[];
  for (const { id } of due) await expireDeal(id);
}
