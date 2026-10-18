// Deal money path. Rules from PRD §7 live here, not in the model:
// price within [floor, list], charge <= each buyer's hold, all holds settle together.
import { DatabaseSync } from 'node:sqlite';
import { paypal } from './paypal.mjs';

export const db = new DatabaseSync(process.env.DB_PATH ?? 'groupbuy.db');
db.exec(`
  create table if not exists deals (
    id integer primary key, product text not null, list_cents int not null, floor_cents int not null,
    target int not null, status text not null default 'OPEN', price_cents int, closes_at text not null);
  create table if not exists holds (
    id integer primary key, deal_id int not null references deals, buyer text not null, max_cents int not null,
    order_id text unique, authorization_id text, capture_id text, status text not null default 'PENDING');
  create table if not exists events (
    id integer primary key, deal_id int, at text not null default (datetime('now')), type text not null, data text);
`);

const usd = cents => (cents / 100).toFixed(2);
const log = (dealId, type, data) =>
  db.prepare('insert into events (deal_id, type, data) values (?, ?, ?)').run(dealId, type, JSON.stringify(data));
export const getDeal = id => db.prepare('select * from deals where id = ?').get(id);
export const getHolds = dealId => db.prepare('select * from holds where deal_id = ? order by id').all(dealId);
const setHold = (id, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`update holds set ${keys.map(k => `${k} = ?`).join(', ')} where id = ?`).run(...Object.values(fields), id);
};

export function createDeal({ product, listCents, floorCents, target, closesAt }) {
  if (!(floorCents > 0 && floorCents <= listCents && target > 0)) throw new Error('bad deal terms');
  const { lastInsertRowid: id } = db.prepare(
    'insert into deals (product, list_cents, floor_cents, target, closes_at) values (?, ?, ?, ?, ?)',
  ).run(product, listCents, floorCents, target, closesAt.toISOString());
  log(id, 'DEAL_OPENED', { product, listCents, target });
  return Number(id);
}

// Creates the PayPal order for a buyer's hold. returnUrl only for the redirect flow (simulated buyers).
export async function startHold(dealId, buyer, maxCents, { returnUrl } = {}) {
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
  const approveUrl = order.links.find(l => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  return { holdId: Number(lastInsertRowid), orderId: order.id, approveUrl };
}

// After buyer approval: place the hold.
export async function authorizeHold(orderId) {
  const hold = db.prepare('select * from holds where order_id = ?').get(orderId);
  if (!hold) throw new Error(`unknown order ${orderId}`);
  if (hold.status !== 'PENDING') return hold;
  if (getDeal(hold.deal_id).status !== 'OPEN') throw new Error('deal no longer open');
  const data = await paypal('POST', `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const auth = data.purchase_units[0].payments.authorizations[0];
  setHold(hold.id, { authorization_id: auth.id, status: 'HELD' });
  log(hold.deal_id, 'HELD', { holdId: hold.id, authorizationId: auth.id, amount: auth.amount.value });
  return { ...hold, authorization_id: auth.id, status: 'HELD' };
}

async function voidHold(hold, reason) {
  await paypal('POST', `/v2/payments/authorizations/${hold.authorization_id}/void`, {}, `void-${hold.id}`);
  setHold(hold.id, { status: reason });
  log(hold.deal_id, reason, { holdId: hold.id, authorizationId: hold.authorization_id });
}

export async function leaveDeal(holdId) {
  const hold = db.prepare('select * from holds where id = ?').get(holdId);
  if (hold?.status !== 'HELD' || getDeal(hold.deal_id).status !== 'OPEN') throw new Error('cannot leave now');
  await voidHold(hold, 'LEFT');
}

// Holds whose max >= price are captured at price; the rest are voided. Re-run on a
// CLOSING deal to retry failed captures (request IDs make the retry safe).
export async function closeDeal(dealId, priceCents) {
  const deal = getDeal(dealId);
  if (deal.status === 'CLOSING' && deal.price_cents !== priceCents) throw new Error('deal already closing at another price');
  if (!['OPEN', 'CLOSING'].includes(deal.status)) throw new Error(`deal ${dealId} is ${deal.status}`);
  if (!(Number.isInteger(priceCents) && priceCents >= deal.floor_cents && priceCents <= deal.list_cents))
    throw new Error('price outside [floor, list]');
  const holds = getHolds(dealId);
  const payers = holds.filter(h => ['HELD', 'CAPTURE_FAILED'].includes(h.status) && h.max_cents >= priceCents);
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
        { amount: { currency_code: 'USD', value: usd(priceCents) }, final_capture: true }, `capture-${h.id}-${priceCents}`);
      setHold(h.id, { capture_id: cap.id, status: 'CAPTURED' });
      log(dealId, 'CAPTURED', { holdId: h.id, captureId: cap.id, amount: usd(priceCents) });
    } catch (e) {
      setHold(h.id, { status: 'CAPTURE_FAILED' });
      log(dealId, 'CAPTURE_FAILED', { holdId: h.id, error: e.message });
    }
  }
  const failed = getHolds(dealId).some(h => h.status === 'CAPTURE_FAILED');
  if (!failed) db.prepare("update deals set status = 'CAPTURED' where id = ?").run(dealId);
  return getDeal(dealId);
}

export async function expireDeal(dealId) {
  if (getDeal(dealId).status !== 'OPEN') throw new Error('only open deals expire');
  db.prepare("update deals set status = 'EXPIRED' where id = ?").run(dealId);
  for (const h of getHolds(dealId)) {
    if (h.status === 'HELD') await voidHold(h, 'VOIDED');
    else if (h.status === 'PENDING') setHold(h.id, { status: 'EXPIRED' });
  }
  log(dealId, 'EXPIRED', {});
}

// Call on a timer; pass a fake `now` for the demo clock.
export async function expireDue(now = new Date()) {
  for (const { id } of db.prepare("select id from deals where status = 'OPEN' and closes_at <= ?").all(now.toISOString()))
    await expireDeal(id);
}
