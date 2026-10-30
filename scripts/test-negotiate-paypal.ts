// Negotiation end to end in the PayPal sandbox: 3 real holds ($100, $95, $75) on a "$90 at 2 buyers" product.
// At $90 the $75 buyer would be released; the agents negotiate, and PayPal captures everyone at the agreed price.
// Run: npm run test:negotiate:paypal
import assert from 'node:assert/strict';
import { db, createDeal, startHold, authorizeHold, settleDeal, getHolds } from '../lib/deals.ts';
import { paypal } from '../lib/paypal.ts';
import { approve, RETURN_URL } from './buyers.ts';

db.prepare(`insert into products (id, seller, name, description, list_cents, floor_cents, tiers_json)
  values ('test-trio', 'Test', 'Test desk lamp', 'Three-buyer negotiation test.', 10000, 6000, ?)`)
  .run(JSON.stringify([{ buyers: 2, price_cents: 9000 }]));
const id = createDeal({ productId: 'test-trio', target: 2, closesAt: new Date(Date.now() + 86_400_000) });
for (const [i, max] of [[1, 10000], [2, 9500], [3, 7500]]) {
  const { orderId, approveUrl } = await startHold(id, `sim-buyer-${i}`, max, { returnUrl: RETURN_URL });
  await approve(approveUrl);
  await authorizeHold(orderId);
  console.log(`buyer ${i} holds $${max / 100}`);
}

const deal = await settleDeal(id);
const ev = db.prepare("select data from events where deal_id = ? and type = 'NEGOTIATED'").get(id) as { data: string } | undefined;
assert.ok(ev, 'a negotiation ran');
const n = JSON.parse(ev.data);
for (const t of n.turns) console.log(`  ${t.by.padEnd(6)} ${t.action === 'accept' ? 'ACCEPT' : '$' + t.price_cents / 100}${t.rejected ? `  [rejected: ${t.rejected}]` : ''}  ${t.message}`);
console.log(`  => $${n.to_cents / 100}, ${n.buyers_before} → ${n.buyers_after} buyers`);

assert.equal(deal.status, 'CAPTURED');
assert.ok(deal.price_cents! >= 6000 && deal.price_cents! <= 9000, 'price within [floor, tier]');
for (const h of getHolds(id)) {
  const paid = h.max_cents >= deal.price_cents!;
  assert.equal(h.status, paid ? 'CAPTURED' : 'DROPPED');
  if (paid) {
    const cap = await paypal('GET', `/v2/payments/captures/${h.capture_id}`);
    assert.equal(cap.amount.value, (deal.price_cents! / 100).toFixed(2));
    console.log(`hold ${h.id} (max $${h.max_cents / 100}): PayPal captured $${cap.amount.value}`);
  } else console.log(`hold ${h.id} (max $${h.max_cents / 100}): released`);
}
console.log('NEGOTIATE PAYPAL PASS');
process.exit(0);
