// Auto-close check against PayPal sandbox: 2 buyers hold, nobody calls closeDeal,
// the clock captures both at the tier price on its own at closes_at.
// Run: npm run test:autoclose
import assert from 'node:assert/strict';
import { db, tierPrice, createDeal, startHold, authorizeHold, getDeal, getHolds } from '../lib/deals.ts';
import { now, startClock } from '../lib/clock.ts';
import { paypal } from '../lib/paypal.ts';
import { approve, RETURN_URL } from './buyers.ts';

// Tier math, no PayPal.
const terms = { target: 10, floor_cents: 12000, list_cents: 20000 };
const tiers = [{ buyers: 10, price_cents: 18000 }, { buyers: 20, price_cents: 16000 }];
const n = (count: number, max: number) => Array(count).fill(max);
assert.equal(tierPrice(terms, tiers, n(9, 20000)), null, 'below target');
assert.equal(tierPrice(terms, tiers, n(12, 20000)), 18000, 'first tier');
assert.equal(tierPrice(terms, tiers, n(20, 16000)), 16000, 'second tier');
assert.equal(tierPrice(terms, tiers, [...n(12, 16000), ...n(8, 17000)]), 16000, 'every max covers 160');
assert.equal(tierPrice(terms, tiers, [...n(12, 18000), ...n(10, 16000)]), 16000, 'all 22 cover 160');
assert.equal(tierPrice(terms, tiers, [...n(12, 18000), ...n(8, 15000)]), 18000, 'only 12 cover 160, so 180');
assert.equal(tierPrice(terms, [{ buyers: 10, price_cents: 9000 }], n(30, 20000)), null, 'tier below floor skipped');
console.log('tierPrice ok');

assert.equal(process.env.CLOCK_SPEED, '4320', 'run with CLOCK_SPEED=4320');

// Two-buyer test product, so the sandbox run needs only 2 browser approvals.
db.prepare(`insert into products (id, seller, name, description, list_cents, floor_cents, tiers_json)
  values ('test-duo', 'Test', 'Test product', 'Two-buyer test product.', 10000, 5000, ?)`)
  .run(JSON.stringify([{ buyers: 2, price_cents: 8000 }]));

// 5 demo days = 100 s real: room for 2 browser approvals before it's due.
const closesAt = new Date(now().getTime() + 5 * 86_400_000);
const id = createDeal({ productId: 'test-duo', target: 2, closesAt });
for (const [i, max] of [[1, 9000], [2, 8000]]) {
  const { orderId, approveUrl } = await startHold(id, `sim-buyer-${i}`, max, { returnUrl: RETURN_URL });
  await approve(approveUrl);
  await authorizeHold(orderId);
  console.log(`buyer ${i} holds $${max / 100}`);
}
assert.equal(getDeal(id)!.status, 'OPEN', 'deal settled before the clock started; approvals too slow');

startClock();
for (let s = 0; getDeal(id)!.status === 'OPEN' || getDeal(id)!.status === 'CLOSING'; s++) {
  assert.ok(s < 150, 'deal never settled');
  await new Promise(r => setTimeout(r, 1000));
}
assert.equal(getDeal(id)!.status, 'CAPTURED');
assert.equal(getDeal(id)!.price_cents, 8000);
assert.ok(now() >= closesAt, 'closed before closes_at');

for (const h of getHolds(id)) {
  const cap = await paypal('GET', `/v2/payments/captures/${h.capture_id}`);
  assert.equal(cap.status, 'COMPLETED');
  assert.equal(cap.amount.value, '80.00');
  console.log(`hold ${h.id} (max $${h.max_cents / 100}): captured $${cap.amount.value}`);
}
console.log('AUTOCLOSE PASS');
process.exit(0);
