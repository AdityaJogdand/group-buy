// Phase 1 exit check against PayPal sandbox:
//  Deal A: 5 buyers hold, close at $150 -> 4 captured at $150, the $140 buyer dropped (voided).
//  Deal B: 5 buyers hold, deal expires -> all 5 voided.
// Run: npm run phase1
import assert from 'node:assert/strict';
import { createDeal, startHold, authorizeHold, closeDeal, expireDeal, getHolds } from '../lib/deals.ts';
import { paypal } from '../lib/paypal.ts';
import { approve, RETURN_URL } from './buyers.ts';

const inADay = new Date(Date.now() + 86_400_000);

async function fill(dealId: number, maxes: number[]) {
  for (const [i, max] of maxes.entries()) {
    const { orderId, approveUrl } = await startHold(dealId, `sim-buyer-${i + 1}`, max, { returnUrl: RETURN_URL });
    await approve(approveUrl);
    await authorizeHold(orderId);
    console.log(`  deal ${dealId}: buyer ${i + 1} holds $${max / 100}`);
  }
}

const a = createDeal({ product: 'UX Design Course', listCents: 20000, floorCents: 12000, target: 4, closesAt: inADay });
await fill(a, [16000, 16000, 17000, 15000, 14000]);
const closed = await closeDeal(a, 15000);
console.log(`deal ${a}: ${closed.status} at $${closed.price_cents! / 100}`);

const b = createDeal({ product: 'UX Design Course', listCents: 20000, floorCents: 12000, target: 20, closesAt: inADay });
await fill(b, [16000, 16000, 16000, 16000, 16000]);
await expireDeal(b);
console.log(`deal ${b}: EXPIRED`);

// Check PayPal's view, not just our DB.
for (const h of [...getHolds(a), ...getHolds(b)]) {
  const auth = await paypal('GET', `/v2/payments/authorizations/${h.authorization_id}`);
  if (h.status === 'CAPTURED') {
    const cap = await paypal('GET', `/v2/payments/captures/${h.capture_id}`);
    assert.equal(cap.status, 'COMPLETED');
    assert.equal(cap.amount.value, '150.00');
  } else {
    assert.equal(auth.status, 'VOIDED', `hold ${h.id} is ${auth.status}`);
  }
  console.log(`hold ${h.id} deal ${h.deal_id} max $${h.max_cents / 100}: ${h.status} (PayPal auth ${auth.status})`);
}
assert.deepEqual(getHolds(a).map(h => h.status), ['CAPTURED', 'CAPTURED', 'CAPTURED', 'CAPTURED', 'DROPPED']);
assert.ok(getHolds(b).every(h => h.status === 'VOIDED'));
console.log('PHASE 1 PASS');
