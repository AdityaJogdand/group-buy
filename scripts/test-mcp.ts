// MCP tools end to end, in-process client, real PayPal sandbox:
// find -> join below floor (question) -> join -> approve -> /paypal/return -> status HELD -> leave -> PayPal VOIDED.
// Then the website API: /api/products, /api/join, approve -> /paypal/return/web redirect -> /api/holds.
// Run: npm run test:mcp
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { server } from '../server.ts';
import { getHold, leaveDeal } from '../lib/deals.ts';
import { paypal } from '../lib/paypal.ts';
import { approve } from './buyers.ts';

const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'test', version: '0' });
await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args }) as { content: { text: string }[]; isError?: boolean };
  const text = r.content[0].text;
  console.log(`${name} ${JSON.stringify(args)}\n  -> ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  return r.isError ? { error: text } : JSON.parse(text);
};

const { tools } = await client.listTools();
assert.deepEqual(tools.map(t => t.name).sort(), ['deal_status', 'find_deal', 'join_deal', 'leave_deal']);

const catalog = await call('find_deal', {});
assert.ok(catalog.some((p: { id: string }) => p.id === 'ux-course'));
const ux = JSON.stringify(catalog.find((p: { id: string }) => p.id === 'ux-course'));
assert.ok(!JSON.stringify(catalog).includes('floor') && !ux.includes('$120'));
assert.deepEqual(catalog.find((p: { id: string }) => p.id === 'ux-course').group_prices,
  [{ buyers: 10, price: '$180' }, { buyers: 20, price: '$160' }]);

const low = await call('join_deal', { product_id: 'ux-course', max_usd: 100 });
assert.match(low.question, /\$180 at 10 buyers/);

assert.match((await call('join_deal', { product_id: 'nope', max_usd: 100 })).error, /unknown product/);

const joined = await call('join_deal', { product_id: 'ux-course', max_usd: 160 });
assert.equal(joined.hold_amount, '$160');
assert.equal(joined.deal.new, true);

await approve(joined.approve_url);
const res = await server.getApp().request(`/paypal/return?token=${joined.hold}&PayerID=x`);
assert.equal(res.status, 200);
assert.match(await res.text(), /Hold placed/);
assert.equal((await server.getApp().request('/paypal/return?token=FAKE')).status, 400);

const status = await call('deal_status', { hold: joined.hold });
assert.equal(status.hold_status, 'HELD');
assert.equal(status.deal.buyers, 1);

assert.equal((await call('leave_deal', { hold: joined.hold })).hold_status, 'LEFT');
assert.match((await call('leave_deal', { hold: joined.hold })).error, /cannot leave/);
const auth = await paypal('GET', `/v2/payments/authorizations/${getHold('order_id', joined.hold)!.authorization_id}`);
assert.equal(auth.status, 'VOIDED');

// Website API, same rules through /api/*.
const app = server.getApp();
const post = (body: object) => app.request('/api/join', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const products = await (await app.request('/api/products')).json() as { id: string }[];
assert.ok(products.some(p => p.id === 'headphones') && !JSON.stringify(products).includes('floor'));
assert.equal((await post({ product_id: 'nope', max_usd: 100 })).status, 400);
assert.equal((await post({ product_id: 'ux-course', max_usd: 'abc' })).status, 400);
assert.match((await (await post({ product_id: 'ux-course', max_usd: 100 })).json()).question, /\$180/);

const web = await (await post({ product_id: 'ux-course', max_usd: 170, name: 'Ada' })).json();
assert.equal(web.hold_amount, '$170');
assert.equal(getHold('order_id', web.hold)!.buyer, 'Ada');
await approve(web.approve_url);
const back = await app.request(`/paypal/return/web?token=${web.hold}&PayerID=x`);
assert.equal(back.status, 302);
assert.equal(back.headers.get('location'), `http://localhost:3001/joined?hold=${web.hold}`);
assert.equal((await app.request('/paypal/return/web?token=FAKE')).headers.get('location'), 'http://localhost:3001/joined?error=1');
assert.equal((await app.request('/paypal/return/web?cancel')).headers.get('location'), 'http://localhost:3001/joined?cancelled=1');
const held = await (await app.request(`/api/holds/${web.hold}`)).json();
assert.equal(held.hold_status, 'HELD');
assert.equal((await app.request('/api/holds/FAKE')).status, 400);
await leaveDeal(getHold('order_id', web.hold)!.id);
console.log('web api ok');

await client.close();
console.log('MCP PASS');
