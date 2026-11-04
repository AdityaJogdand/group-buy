// PayPal webhooks, against the real sandbox where it matters:
// 1. a buyer approves in PayPal and never comes back; CHECKOUT.ORDER.APPROVED places the hold (PayPal confirms it)
// 2. the same event again is ignored (applied once)
// 3. the hold is voided outside the app; PAYMENT.AUTHORIZATION.VOIDED stops it counting
// 4. capture events: COMPLETED confirms, DENIED flags; a CLOSING deal completes when its last capture lands
// 5. the HTTP route: unconfigured = 503, forged signature = 400 (real PayPal verification), bad JSON = 400
// Run: npm run test:webhook
import assert from 'node:assert/strict';
import { db, createDeal, startHold, getHold, getDeal } from '../lib/deals.ts';
import { handleWebhook } from '../lib/webhook.ts';
import { paypal } from '../lib/paypal.ts';
import { server } from '../server.ts';
import { approve, RETURN_URL } from './buyers.ts';

const trust = async () => true;   // stands in for PayPal's verification in cases 1–4
process.env.PAYPAL_WEBHOOK_ID ??= 'TEST';
const send = (event: object) => handleWebhook(JSON.stringify(event), {}, trust);

// 1. Approve on PayPal's page, but never hit our return URL.
const deal = createDeal({ productId: 'ux-course', target: 10, closesAt: new Date(Date.now() + 86_400_000) });
const { orderId, approveUrl } = await startHold(deal, 'tab-closer', 16000, { returnUrl: RETURN_URL });
await approve(approveUrl);
assert.equal(getHold('order_id', orderId)!.status, 'PENDING', 'nothing placed the hold yet');
const approved = { id: `WH-test-${orderId}`, event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: orderId, status: 'APPROVED' } };
assert.equal((await send(approved)).status, 200);
const held = getHold('order_id', orderId)!;
assert.equal(held.status, 'HELD');
const auth = await paypal('GET', `/v2/payments/authorizations/${held.authorization_id}`);
assert.equal(auth.status, 'CREATED', 'PayPal holds the money');
console.log(`approved without returning → hold placed (PayPal auth ${auth.status})`);

// 2. Duplicate delivery.
assert.deepEqual((await send(approved)).body, { applied: false });

// 3. Voided outside the app.
await paypal('POST', `/v2/payments/authorizations/${held.authorization_id}/void`, {}, `void-${held.authorization_id}`);
await send({ id: `WH-void-${held.authorization_id}`, event_type: 'PAYMENT.AUTHORIZATION.VOIDED', resource: { id: held.authorization_id, status: 'VOIDED' } });
assert.equal(getHold('order_id', orderId)!.status, 'VOIDED');
console.log('voided at PayPal → hold released');

// 4. Capture events on a CLOSING deal (rows only, no money moves).
const d2 = createDeal({ productId: 'ux-course', target: 1, closesAt: new Date(Date.now() + 86_400_000) });
db.prepare("update deals set status = 'CLOSING', price_cents = 15000 where id = ?").run(d2);
const row = (n: number, status: string) => Number(db.prepare(
  "insert into holds (deal_id, buyer, max_cents, order_id, authorization_id, status) values (?, ?, 16000, ?, ?, ?)",
).run(d2, `b${n}`, `ORD-${d2}-${n}`, `AUTH-${d2}-${n}`, status).lastInsertRowid);
const a = row(1, 'CAPTURED'), b = row(2, 'CAPTURE_FAILED');
await send({ id: `WH-deny-${d2}`, event_type: 'PAYMENT.CAPTURE.DENIED', resource: { id: 'CAP-x', status: 'DECLINED', supplementary_data: { related_ids: { authorization_id: `AUTH-${d2}-1` } } } });
assert.equal(getHold('id', a)!.status, 'CAPTURE_FAILED');
assert.equal(getDeal(d2)!.status, 'CLOSING');
for (const [n, id] of [[1, a], [2, b]] as const) {
  await send({ id: `WH-cap-${d2}-${n}`, event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: `CAP-${d2}-${n}`, status: 'COMPLETED', supplementary_data: { related_ids: { authorization_id: `AUTH-${d2}-${n}` } } } });
  assert.equal(getHold('id', id)!.status, 'CAPTURED');
}
assert.equal(getDeal(d2)!.status, 'CAPTURED', 'last capture completes the deal');
assert.ok(db.prepare("select 1 from events where deal_id = ? and type = 'PAYPAL_PAYMENT.CAPTURE.COMPLETED'").get(d2), 'logged');
console.log('capture denied → flagged; completed → confirmed; deal completes');

// 5. The real route.
const app = server.getApp();
const post = (body: string) => app.request('/paypal/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
const saved = process.env.PAYPAL_WEBHOOK_ID;
delete process.env.PAYPAL_WEBHOOK_ID;
assert.equal((await post(JSON.stringify(approved))).status, 503);
process.env.PAYPAL_WEBHOOK_ID = saved;
assert.equal((await post('not json')).status, 400);
const forged = await post(JSON.stringify({ id: 'WH-forged', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'x' } }));
assert.equal(forged.status, 400, 'PayPal refuses to verify a forged event');
assert.equal(db.prepare("select 1 from webhook_events where id = 'WH-forged'").get(), undefined);
console.log('route: unconfigured 503, bad json 400, forged signature 400');
console.log('WEBHOOK PASS');
process.exit(0);
