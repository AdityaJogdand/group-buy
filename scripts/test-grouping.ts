// Grouping rules, no model and no PayPal. Runs on an in-memory DB.
// Run: npm run test:grouping
import assert from 'node:assert/strict';
import { db, createDeal, getDeal } from '../lib/deals.ts';
import { group } from '../lib/grouping.ts';

const now = new Date('2026-10-20T12:00:00Z');
const DAY = 86_400_000;
const hold = (dealId: number, n: number) => {
  for (let i = 0; i < n; i++) db.prepare("insert into holds (deal_id, buyer, max_cents, status) values (?, 'b', 16000, 'HELD')").run(dealId);
};

// 1. Below the floor ($120): ask to match the first tier ($180 at 10), no deal opened, floor never named.
const low = group({ productId: 'ux-course', maxCents: 10000, deadline: null }, now);
assert.ok('ask' in low);
assert.match(low.ask, /\$180 at 10 buyers/);
assert.doesNotMatch(low.ask, /\$120/);
assert.equal((db.prepare('select count(*) n from deals').get() as { n: number }).n, 0);

// 2. No open deal: open one with the smallest tier as target, closing in 3 days.
const first = group({ productId: 'ux-course', maxCents: 16000, deadline: null }, now);
assert.ok('dealId' in first && first.isNew);
assert.equal(getDeal(first.dealId)!.target, 10);
assert.equal(getDeal(first.dealId)!.closes_at, new Date(now.getTime() + 3 * DAY).toISOString());

// 3. Exactly at the floor is fine, and joins the open deal instead of opening another.
const atFloor = group({ productId: 'ux-course', maxCents: 12000, deadline: null }, now);
assert.deepEqual(atFloor, { dealId: first.dealId, isNew: false });

// 4. Two open deals: join the one with more held buyers.
const fuller = createDeal({ productId: 'ux-course', target: 10, closesAt: new Date(now.getTime() + 2 * DAY) });
hold(fuller, 5); hold(first.dealId, 2);
assert.deepEqual(group({ productId: 'ux-course', maxCents: 15000, deadline: null }, now), { dealId: fuller, isNew: false });

// 5. Deadline before every open deal closes: open a new deal that closes at the end of the deadline day.
const soon = group({ productId: 'ux-course', maxCents: 15000, deadline: '2026-10-21' }, now);
assert.ok('dealId' in soon && soon.isNew);
assert.equal(getDeal(soon.dealId)!.closes_at, '2026-10-21T23:59:59.999Z');

// 6. A deal past closes_at that the clock hasn't swept yet is never joined.
const later = new Date(now.getTime() + 4 * DAY);
const r6 = group({ productId: 'ux-course', maxCents: 15000, deadline: null }, later);
assert.ok('dealId' in r6 && r6.isNew);

// 7. Another product's deal is never chosen.
const seat = group({ productId: 'design-seat', maxCents: 9000, deadline: null }, now);
assert.ok('dealId' in seat && seat.isNew);
assert.equal(getDeal(seat.dealId)!.product_id, 'design-seat');
assert.equal(getDeal(seat.dealId)!.target, 5);

// 8. Unknown product throws.
assert.throws(() => group({ productId: 'nope', maxCents: 1000, deadline: null }, now), /unknown product/);

console.log('GROUPING PASS (8 checks)');
