// Group-buy MCP server (FastMCP, HTTP stream on /mcp) + the website's JSON API (/api/*) + the PayPal return page.
// The calling model (Claude Desktop etc.) parses the buyer's chat into tool args; code checks every field.
// No close/capture or seller tools: money only moves when a deal closes, never on a model's say-so.
// Run: npm run server   then connect a client to http://localhost:3000/mcp
import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import type { Context } from 'hono';
import { db, getProduct, getProducts, getDeal, getHold, getHolds, startHold, authorizeHold, leaveDeal, saveProduct, settleDeal, type Tier } from './lib/deals.ts';
import { group } from './lib/grouping.ts';
import { intake } from './lib/intake.ts';
import { handleWebhook } from './lib/webhook.ts';
import type { ChatMessage } from './lib/llm.ts';
import { now, startClock } from './lib/clock.ts';

const PORT = Number(process.env.PORT ?? 3000);
// Render sets RENDER_EXTERNAL_URL to the service's public https URL.
const BASE_URL = process.env.BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3001';
// ponytail: one buyer name for every MCP session; add per-session auth when real users connect.
const BUYER = process.env.MCP_BUYER ?? 'mcp-buyer';
const usd = (cents: number) => `$${cents / 100}`;
const json = (v: unknown) => JSON.stringify(v, null, 2);
const heldCount = (dealId: number) =>
  (db.prepare("select count(*) n from holds where deal_id = ? and status = 'HELD'").get(dealId) as { n: number }).n;

// Buyers refer to their hold by its PayPal order id: unguessable, unlike our row ids.
// ponytail: order id doubles as the bearer token; issue a separate random token if order ids ever get shown to others.
const mustGetHold = (orderId: string) => {
  const hold = getHold('order_id', orderId);
  if (!hold) throw new UserError(`no hold ${orderId}`);
  return hold;
};

export const server = new FastMCP({
  name: 'group-buy',
  version: '0.1.0',
  instructions: 'Group buying: strangers pool for a bulk price. Call find_deal to see products, then join_deal with the ' +
    "buyer's product and the most they'd pay. Joining places a PayPal hold for that max; at close everyone pays the " +
    'same group price (never more than their hold), or the hold is released. Show the buyer approve_url to approve.',
});

// Shared by the MCP tools and /api/*: same rules whichever door the buyer comes in by.
const openDeals = (productId: string) =>
  (db.prepare("select id from deals where product_id = ? and status = 'OPEN' and closes_at > ?")
    .all(productId, now().toISOString()) as { id: number }[])
    .map(({ id }) => ({ deal_id: id, buyers: heldCount(id), target: getDeal(id)!.target, closes_at: getDeal(id)!.closes_at,
      // Demo clock aware: closes_at is in demo time, this is real time left.
      ends_in_ms: Math.max(0, (Date.parse(getDeal(id)!.closes_at) - now().getTime()) / Number(process.env.CLOCK_SPEED ?? 1)) }));

const catalog = (productId?: string) => getProducts().filter(p => !productId || p.id === productId).map(p => ({
  id: p.id, name: p.name, seller: p.seller, list_price: usd(p.list_cents), description: p.description,
  // Tiers are public (join_deal already quotes the first one); the floor never leaves the server.
  group_prices: p.tiers.map(t => ({ buyers: t.buyers, price: usd(t.price_cents) })),
  open_deals: openDeals(p.id),
}));

async function join({ product_id, max_usd, deadline }: { product_id: string; max_usd: number; deadline?: string | null },
  buyer: string, returnUrl: string) {
  const product = getProduct(product_id);
  if (!product) throw new UserError(`unknown product ${product_id}; call find_deal for ids`);
  if (!(Number.isFinite(max_usd) && max_usd > 0)) throw new UserError('max_usd must be a positive number');
  // Same rules as lib/intake.ts: cap at list, drop a malformed or past deadline.
  const maxCents = Math.min(Math.round(max_usd * 100), product.list_cents);
  const today = now().toISOString().slice(0, 10);
  const by = deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline >= today ? deadline : null;
  const grouped = group({ productId: product.id, maxCents, deadline: by }, now());
  if ('ask' in grouped) return { question: grouped.ask };
  const { orderId, approveUrl } = await startHold(grouped.dealId, buyer, maxCents, { returnUrl });
  const deal = getDeal(grouped.dealId)!;
  return {
    hold: orderId, approve_url: approveUrl, hold_amount: usd(maxCents),
    deal: { deal_id: deal.id, product: deal.product, new: grouped.isNew, buyers: heldCount(deal.id), target: deal.target, closes_at: deal.closes_at },
    next: `Buyer opens approve_url to approve the ${usd(maxCents)} hold. Nothing is charged until the deal closes.`,
  };
}

function holdStatus(orderId: string) {
  const hold = mustGetHold(orderId);
  const deal = getDeal(hold.deal_id)!;
  // If the agents negotiated at close: the price before and after (public; the transcript stays seller-side).
  const neg = db.prepare("select data from events where deal_id = ? and type = 'NEGOTIATED' order by id desc limit 1").get(deal.id) as { data: string } | undefined;
  const n = neg && JSON.parse(neg.data);
  return {
    hold: orderId, hold_status: hold.status, hold_amount: usd(hold.max_cents),
    deal: { deal_id: deal.id, product_id: deal.product_id, product: deal.product, status: deal.status, buyers: heldCount(deal.id),
      target: deal.target, closes_at: deal.closes_at, ...(deal.price_cents && { price: usd(deal.price_cents) }),
      ...(n && n.to_cents < n.from_cents && { negotiated: { from: usd(n.from_cents), to: usd(n.to_cents) } }) },
  };
}

server.addTool({
  name: 'find_deal',
  description: 'List products (id, name, list price, group prices by buyer count, description) and the open group deals for each.',
  annotations: { readOnlyHint: true },
  parameters: z.object({ product_id: z.string().optional().describe('only this product') }),
  execute: async ({ product_id }) => json(catalog(product_id)),
});

server.addTool({
  name: 'join_deal',
  description: "Join (or open) the best group deal for a product. Places a PayPal hold for max_usd once the buyer " +
    'approves at approve_url. If the result is a question, ask the buyer and call again with their answer.',
  parameters: z.object({
    product_id: z.string().describe('id from find_deal'),
    max_usd: z.number().positive().describe('the most the buyer will pay for one item'),
    deadline: z.string().optional().describe('YYYY-MM-DD the buyer needs it by, if they said'),
  }),
  execute: async args => json(await join(args, BUYER, `${BASE_URL}/paypal/return`)),
});

server.addTool({
  name: 'deal_status',
  description: "Status of the buyer's hold and its deal.",
  annotations: { readOnlyHint: true },
  parameters: z.object({ hold: z.string().describe('hold id from join_deal') }),
  execute: async ({ hold: orderId }) => json(holdStatus(orderId)),
});

server.addTool({
  name: 'leave_deal',
  description: "Leave an open deal: releases the buyer's PayPal hold. Nothing is charged.",
  annotations: { destructiveHint: true },
  parameters: z.object({ hold: z.string().describe('hold id from join_deal') }),
  execute: async ({ hold: orderId }) => {
    const hold = mustGetHold(orderId);
    try { await leaveDeal(hold.id); } catch (e) { throw new UserError((e as Error).message); }
    return json({ hold: orderId, hold_status: 'LEFT', message: 'Hold released. Nothing was charged.' });
  },
});

// PayPal sends the buyer here after approval (?token=<order id>) or cancel (?cancel).
// /paypal/return/web is the website's flow: same work, then back to the site's /joined page.
const page = (title: string, text: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;margin:3rem"><h1>${title}</h1><p>${text}`;
const app = server.getApp();
app.get('/paypal/return/:via?', async c => {
  const web = c.req.param('via') === 'web';
  const token = c.req.query('token') ?? '';
  if (c.req.query('cancel') !== undefined)
    return web ? c.redirect(`${WEB_URL}/joined?cancelled=1`) : c.html(page('Cancelled', 'No hold was placed. You can close this tab.'));
  try {
    const hold = await authorizeHold(token);
    if (web) return c.redirect(`${WEB_URL}/joined?hold=${encodeURIComponent(token)}`);
    return c.html(page('Hold placed', `${usd(hold.max_cents)} is on hold for deal ${hold.deal_id}. ` +
      'You pay only the final group price. Go back to your chat.'));
  } catch {
    return web ? c.redirect(`${WEB_URL}/joined?error=1`) : c.html(page('Hold not placed', 'This approval link is not valid or the deal has closed.'), 400);
  }
});

// PayPal webhooks: signature-verified, applied once per event id (lib/webhook.ts).
app.post('/paypal/webhook', async c => {
  const h: Record<string, string | undefined> = {};
  c.req.raw.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  const r = await handleWebhook(await c.req.text(), h);
  return c.json(r.body, r.status as 200);
});

// Website API. The site proxies /api/* here (web/next.config.ts), so no CORS.
// UserError = the buyer's mistake (400); anything else is ours (500, logged).
const api = async (c: Context, fn: () => unknown) => {
  try { return c.json(await fn()); } catch (e) {
    if (e instanceof UserError) return c.json({ error: e.message }, 400);
    console.error('api error:', (e as Error).message);
    return c.json({ error: 'Something went wrong. Try again.' }, 500);
  }
};
app.get('/api/products', c => api(c, () => catalog()));
app.get('/api/holds/:hold', c => api(c, () => holdStatus(c.req.param('hold'))));
app.post('/api/join', c => api(c, async () => {
  const body = await c.req.json().catch(() => ({}));
  // ponytail: the buyer's name is just a label on the hold; add accounts when sellers need verified buyers.
  const name = String(body.name ?? '').trim().slice(0, 40) || 'web-buyer';
  const deadline = typeof body.deadline === 'string' ? body.deadline : null;
  return join({ product_id: String(body.product_id ?? ''), max_usd: Number(body.max_usd), deadline }, name, `${BASE_URL}/paypal/return/web`);
}));

// Free text -> what the buyer wants, or one follow-up question. Read-only: opens no deal and holds nothing;
// the site shows the result for the buyer to confirm, then calls /api/join.
// ponytail: no rate limit; every call spends LLM tokens. Add a per-IP limit before sharing the URL widely.
app.post('/api/intake', c => api(c, async () => {
  const body = await c.req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw.slice(-12).flatMap(m => {
    const { role, content } = (m ?? {}) as Record<string, unknown>;
    return (role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()
      ? [{ role, content: content.slice(0, 500) }] : [];
  });
  if (messages.at(-1)?.role !== 'user') throw new UserError('Say what you want to buy.');
  const r = await intake(messages, now());
  if ('ask' in r || 'declined' in r) return r;
  const p = getProduct(r.productId)!;
  return { product_id: p.id, product: p.name, max_usd: r.maxCents / 100, list_usd: p.list_cents / 100, deadline: r.deadline };
}));

// Seller dashboard API. These expose floor prices and move money (Close now), so when SELLER_KEY is set every
// call must send it as x-seller-key. Unset (local dev) = open.
// ponytail: one shared key, no seller accounts; add per-seller logins when real sellers sign up.
const sellerOk = (c: Context) => !process.env.SELLER_KEY || c.req.header('x-seller-key') === process.env.SELLER_KEY;
const seller = (fn: (c: Context) => unknown) => async (c: Context) =>
  sellerOk(c) ? api(c, () => fn(c)) : c.json({ error: 'Seller key required.' }, 401);
const asProductInput = (b: Record<string, unknown>) => ({
  name: String(b.name ?? ''), description: String(b.description ?? ''),
  list_cents: Math.round(Number(b.list_usd) * 100), floor_cents: Math.round(Number(b.floor_usd) * 100),
  tiers: (Array.isArray(b.tiers) ? b.tiers : []).map((t: { buyers?: unknown; price_usd?: unknown }) =>
    ({ buyers: Number(t.buyers), price_cents: Math.round(Number(t.price_usd) * 100) })) as Tier[],
});
const userError = (fn: () => unknown) => { try { return fn(); } catch (e) { throw new UserError((e as Error).message); } };

// Everything the dashboard shows for one seller, in one call (it polls).
app.get('/api/seller', seller(c => {
  const sellers = (db.prepare('select distinct seller from products order by seller').all() as { seller: string }[]).map(r => r.seller);
  const who = c.req.query('seller') || sellers[0];
  const products = getProducts().filter(p => p.seller === who);
  const ids = new Set(products.map(p => p.id));
  const deals = (db.prepare('select id from deals order by id desc').all() as { id: number }[])
    .map(({ id }) => getDeal(id)!).filter(d => ids.has(d.product_id))
    .map(d => ({ ...d, holds: getHolds(d.id), ends_in_ms: Math.max(0, (Date.parse(d.closes_at) - now().getTime()) / Number(process.env.CLOCK_SPEED ?? 1)) }));
  const dealIds = deals.map(d => d.id);
  const events = dealIds.length ? db.prepare(`select * from events where deal_id in (${dealIds.map(() => '?').join(',')}) order by id desc limit 200`).all(...dealIds) : [];
  return { sellers, seller: who, products, deals, events };
}));
app.post('/api/seller/products', seller(async c => {
  const b = await c.req.json().catch(() => ({}));
  const who = String(b.seller ?? '').trim();
  if (!who) throw new UserError('Seller name is required.');
  return userError(() => saveProduct(who, asProductInput(b)));
}));
app.patch('/api/seller/products/:id', seller(async c => {
  const b = await c.req.json().catch(() => ({}));
  return userError(() => saveProduct(String(b.seller ?? ''), { id: c.req.param('id'), ...asProductInput(b) }));
}));
// Close a group now (demos): capture at the best tier reached, else release every hold.
app.post('/api/seller/deals/:id/close', seller(async c => {
  const deal = getDeal(Number(c.req.param('id')));
  if (!deal) throw new UserError('No such group.');
  if (deal.status !== 'OPEN') throw new UserError(`This group is already ${deal.status.toLowerCase()}.`);
  return settleDeal(deal.id);
}));

// Stateless: no sessions to lose, so a server restart never strands a connected client.
if (import.meta.main) {
  startClock();
  await server.start({ transportType: 'httpStream', httpStream: { port: PORT, host: process.env.HOST, stateless: true } });
  console.error(`group-buy MCP on ${BASE_URL}/mcp`);
}
