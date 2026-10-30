// Negotiation referee with scripted agents (no tokens), then one real pool-vs-seller run with the LLM.
// Run: npm run test:negotiate
import assert from 'node:assert/strict';
import { negotiate, llmAgent, payers, MAX_ROUNDS, type Agent, type Move, type Table } from '../lib/negotiate.ts';

// Headphones group: earned $300 at 10 buyers; 5 more holders would be released at $300.
const table: Table = { product: 'Noise-cancelling headphones', list_cents: 35000, floor_cents: 25000, start_cents: 30000,
  maxes: [...Array(10).fill(30000), 28000, 28000, 28000, 26000, 26000], target: 10 };
const script = (moves: Move[]): Agent => { let i = 0; return async () => moves[Math.min(i++, moves.length - 1)]; };
const o = (p: number, message = '') => ({ action: 'offer' as const, price_usd: p, message });
const accept = { action: 'accept' as const, price_usd: 0, message: '' };

// Offers meet: seller's $270 at or below the pool's $270 bid closes at $270.
let r = await negotiate(table, { pool: script([o(260), o(270)]), seller: script([o(285), o(270)]) });
assert.equal(r.agreed, true); assert.equal(r.price_cents, 27000);

// Pool accepts the seller's standing offer.
r = await negotiate(table, { pool: script([o(260), accept]), seller: script([o(280)]) });
assert.deepEqual([r.agreed, r.price_cents], [true, 28000]);

// Referee rejections: seller below floor, seller raising, pool above the earned price, pool lowering, fractional cents.
r = await negotiate(table, { pool: script([o(310), o(270), o(265), o(270.5)]), seller: script([o(240), o(290), o(295), o(290)]) });
const rejected = r.turns.filter(t => t.rejected).map(t => t.rejected);
assert.ok(rejected.includes('below the floor'), 'seller below floor rejected');
assert.ok(rejected.some(x => /only come down/.test(x!)), 'seller raising rejected');
assert.ok(rejected.some(x => /above the group price/.test(x!)), 'pool above tier rejected');
assert.ok(rejected.some(x => /only go up/.test(x!)), 'pool lowering rejected');
assert.ok(rejected.includes('prices are whole dollars'));
assert.equal(r.agreed, false); assert.equal(r.price_cents, 29000, 'no deal: closes at seller\'s last valid offer');
assert.ok(r.turns.length <= MAX_ROUNDS * 2);

// An agent that throws is recorded and treated as no move; the result can never exceed the tier.
r = await negotiate(table, { pool: async () => { throw new Error('boom'); }, seller: script([o(300)]) });
assert.equal(r.price_cents, 30000); assert.ok(r.turns.some(t => t.rejected?.startsWith('agent error')));

// The pool never sees the floor.
let poolSawFloor = false;
await negotiate(table, { pool: async v => { poolSawFloor ||= v.table.floor_cents !== undefined; return accept; }, seller: script([o(300)]) });
assert.equal(poolSawFloor, false);
console.log('referee ok');

if (!process.env.LLM_BASE_URL) { console.log('LLM not configured; skipped the live run'); process.exit(0); }
const live = await negotiate(table, { pool: llmAgent, seller: llmAgent });
for (const t of live.turns) console.log(`  ${t.by.padEnd(6)} ${t.action === 'accept' ? 'ACCEPT' : '$' + t.price_cents / 100}${t.rejected ? `  [rejected: ${t.rejected}]` : ''}  ${t.message}`);
console.log(`  => $${live.price_cents / 100} (${live.agreed ? 'agreed' : 'no agreement'}), ${payers(table.maxes, live.price_cents)} buyers pay vs ${payers(table.maxes, 30000)} at $300`);
assert.ok(live.price_cents >= table.floor_cents && live.price_cents <= table.start_cents);
assert.ok(!live.turns.some(t => t.by === 'seller' && /\$?250\b/.test(t.message)), 'seller leaked its floor');
console.log('NEGOTIATE PASS');
