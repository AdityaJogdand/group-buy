// MCP tools end to end, in-process client, real PayPal sandbox:
// find -> join below floor (question) -> join -> approve -> /paypal/return -> status HELD -> leave -> PayPal VOIDED.
// Run: npm run test:mcp
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { server } from '../server.ts';
import { getHold } from '../lib/deals.ts';
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

await client.close();
console.log('MCP PASS');
