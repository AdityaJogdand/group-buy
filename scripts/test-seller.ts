// Seller dashboard API, no PayPal: product rules, add/edit, floor stays private, ownership,
// open deals keep their prices after an edit, Close now on an empty group, the seller key.
// Run: npm run test:seller
import assert from 'node:assert/strict';
import { productError, createDeal, getDeal } from '../lib/deals.ts';
import { server } from '../server.ts';

const ok = { name: 'Desk lamp', description: 'Dimmable LED desk lamp.', list_cents: 8000, floor_cents: 5000,
  tiers: [{ buyers: 5, price_cents: 7000 }, { buyers: 15, price_cents: 6000 }] };
assert.equal(productError(ok), null);
assert.match(productError({ ...ok, floor_cents: 9000 })!, /above the single price/);
assert.match(productError({ ...ok, tiers: [{ buyers: 5, price_cents: 9000 }] })!, /Group price \$90 is above the single price \$80/);
assert.match(productError({ ...ok, tiers: [{ buyers: 5, price_cents: 4000 }] })!, /below your lowest price/);
assert.match(productError({ ...ok, tiers: [{ buyers: 5, price_cents: 6000 }, { buyers: 15, price_cents: 7000 }] })!, /lower price/);
assert.match(productError({ ...ok, tiers: [] })!, /1 to 3/);
console.log('rules ok');

const app = server.getApp();
const call = (method: string, url: string, body?: object, key?: string) => app.request(url, {
  method, body: body && JSON.stringify(body), headers: { 'content-type': 'application/json', ...(key ? { 'x-seller-key': key } : {}) } });
const input = { seller: 'Lamp Co', name: 'Desk lamp', description: 'Dimmable LED desk lamp.', list_usd: 80, floor_usd: 50,
  tiers: [{ buyers: 5, price_usd: 70 }, { buyers: 15, price_usd: 60 }] };

const bad = await call('POST', '/api/seller/products', { ...input, floor_usd: 90 });
assert.equal(bad.status, 400);
assert.match((await bad.json()).error, /above the single price/);

const made = await (await call('POST', '/api/seller/products', input)).json();
assert.equal(made.id, 'desk-lamp');
const buyerView = JSON.stringify(await (await app.request('/api/products')).json());
assert.ok(buyerView.includes('Desk lamp') && !buyerView.includes('floor'), 'buyers see the product, never the floor');

// A deal opened now keeps $70/$60 even after the seller changes the tiers.
const dealId = createDeal({ productId: 'desk-lamp', target: 5, closesAt: new Date(Date.now() + 86_400_000) });
const edited = await call('PATCH', '/api/seller/products/desk-lamp', { ...input, tiers: [{ buyers: 5, price_usd: 65 }] });
assert.equal(edited.status, 200);
assert.equal((await edited.json()).tiers[0].price_cents, 6500);
assert.deepEqual(JSON.parse(getDeal(dealId)!.tiers_json!), [{ buyers: 5, price_cents: 7000 }, { buyers: 15, price_cents: 6000 }]);
assert.equal((await call('PATCH', '/api/seller/products/desk-lamp', { ...input, seller: 'Someone else' })).status, 400);

const dash = await (await app.request('/api/seller?seller=Lamp%20Co')).json();
assert.equal(dash.products[0].floor_cents, 5000, 'seller sees the floor');
assert.equal(dash.deals[0].id, dealId);

const closed = await (await call('POST', `/api/seller/deals/${dealId}/close`)).json();
assert.equal(closed.status, 'EXPIRED', 'no holds, so Close now releases');
assert.equal((await call('POST', `/api/seller/deals/${dealId}/close`)).status, 400);

process.env.SELLER_KEY = 'k';
assert.equal((await app.request('/api/seller')).status, 401);
assert.equal((await call('GET', '/api/seller', undefined, 'k')).status, 200);
console.log('SELLER PASS');
