// Demo clock check against PayPal sandbox: 2 buyers hold, nobody closes the deal,
// the clock expires it on its own at closes_at and both holds are voided.
// Run: npm run clock
import assert from 'node:assert/strict';
import { createDeal, startHold, authorizeHold, getDeal, getHolds } from '../lib/deals.ts';
import { now, startClock } from '../lib/clock.ts';
import { paypal } from '../lib/paypal.ts';
import { approve, RETURN_URL } from './buyers.ts';

assert.equal(process.env.CLOCK_SPEED, '4320', 'run with CLOCK_SPEED=4320');

// 5 demo days = 100 s real: room for ~2 browser approvals before it's due.
const closesAt = new Date(now().getTime() + 5 * 86_400_000);
const id = createDeal({ product: 'UX Design Course', listCents: 20000, floorCents: 12000, target: 20, closesAt });
for (const i of [1, 2]) {
  const { orderId, approveUrl } = await startHold(id, `sim-buyer-${i}`, 16000, { returnUrl: RETURN_URL });
  await approve(approveUrl);
  await authorizeHold(orderId);
  console.log(`buyer ${i} holds $160 (demo time ${now().toISOString()})`);
}
assert.equal(getDeal(id)!.status, 'OPEN', 'deal expired before the clock started; approvals too slow');

// Done once the deal is expired and every void has landed.
const settled = () => getDeal(id)!.status === 'EXPIRED' && getHolds(id).every(h => h.status !== 'HELD');
startClock();
for (let s = 0; !settled(); s++) {
  assert.ok(s < 120, 'deal never expired');
  await new Promise(r => setTimeout(r, 1000));
}
assert.equal(getDeal(id)!.status, 'EXPIRED');
assert.ok(now() >= closesAt, 'expired before closes_at');

for (const h of getHolds(id)) {
  const auth = await paypal('GET', `/v2/payments/authorizations/${h.authorization_id}`);
  assert.equal(auth.status, 'VOIDED', `hold ${h.id} is ${auth.status}`);
  console.log(`hold ${h.id}: ${h.status} (PayPal auth ${auth.status})`);
}
console.log('CLOCK PASS');
process.exit(0);
