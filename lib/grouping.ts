// Grouping: an intake request -> the deal to join. Plain code, no model.
// Below the floor: ask the buyer to match the best group price (never reveal the floor itself).
// Otherwise: the open deal for that product with the most held buyers that closes by the deadline, or a new one.
import { db, getProduct, createDeal } from './deals.ts';
import type { IntakeRequest } from './intake.ts';

export type GroupResult = { dealId: number; isNew: boolean } | { ask: string };

const DAY = 86_400_000;
const usd = (cents: number) => `$${cents / 100}`;

// `now` comes from the demo clock (lib/clock.ts) so demo deals open and close on demo time.
export function group({ productId, maxCents, deadline }: IntakeRequest, now = new Date()): GroupResult {
  const product = getProduct(productId);
  if (!product) throw new Error(`unknown product ${productId}`);

  // ponytail: a buyer probing $119, $121... can find the floor; add per-buyer rate limits if sellers mind.
  if (maxCents < product.floor_cents) {
    // Suggest the first tier (fewest buyers): new deals target it, so a buyer who says yes is never dropped.
    const first = product.tiers.reduce((a, t) => (t.buyers < a.buyers ? t : a), product.tiers[0]);
    // A tier below the floor would be a seller typo; fall back to the list price rather than leak the floor.
    const suggest = first && first.price_cents >= product.floor_cents ? first : { buyers: 0, price_cents: product.list_cents };
    const at = suggest.buyers ? ` at ${suggest.buyers} buyers, and lower as more join` : '';
    return { ask: `${usd(maxCents)} is below what a ${product.name} group deal can close at. ` +
      `The group price is ${usd(suggest.price_cents)}${at}. Can you go up to ${usd(suggest.price_cents)}? ` +
      `You only pay the final group price, never more than your hold.` };
  }

  // Deadline is a date; the deal must close by the end of that day (UTC).
  const latest = deadline ? `${deadline}T23:59:59.999Z` : '9999-12-31';
  const fullest = db.prepare(`
    select d.id from deals d left join holds h on h.deal_id = d.id and h.status = 'HELD'
    where d.product_id = ? and d.status = 'OPEN' and d.closes_at > ? and d.closes_at <= ?
    group by d.id order by count(h.id) desc, d.closes_at asc limit 1`,
  ).get(productId, now.toISOString(), latest) as { id: number } | undefined;
  if (fullest) return { dealId: fullest.id, isNew: false };

  // New deal: smallest tier is the first target; window is 3 days (PayPal honor period) or the deadline, if sooner.
  const target = Math.min(...product.tiers.map(t => t.buyers)) || 10;
  const closesAt = new Date(Math.min(now.getTime() + 3 * DAY, Date.parse(latest) || Infinity));
  return { dealId: createDeal({ productId, target, closesAt }), isNew: true };
}
