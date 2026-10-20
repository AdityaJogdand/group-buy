// Group-buy MCP server (FastMCP, HTTP stream on /mcp) + the PayPal return page.
// The calling model (Claude Desktop etc.) parses the buyer's chat into tool args; code checks every field.
// No close/capture or seller tools: money only moves when a deal closes, never on a model's say-so.
// Run: npm run server   then connect a client to http://localhost:3000/mcp
import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import { db, getProduct, getProducts, getDeal, getHold, startHold, authorizeHold, leaveDeal } from './lib/deals.ts';
import { group } from './lib/grouping.ts';
import { now, startClock } from './lib/clock.ts';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
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

server.addTool({
  name: 'find_deal',
  description: 'List products (id, name, list price, description) and the open group deals for each.',
  annotations: { readOnlyHint: true },
  parameters: z.object({ product_id: z.string().optional().describe('only this product') }),
  execute: async ({ product_id }) => json(getProducts().filter(p => !product_id || p.id === product_id).map(p => ({
    id: p.id, name: p.name, list_price: usd(p.list_cents), description: p.description,
    open_deals: (db.prepare("select id from deals where product_id = ? and status = 'OPEN' and closes_at > ?")
      .all(p.id, now().toISOString()) as { id: number }[])
      .map(({ id }) => ({ deal_id: id, buyers: heldCount(id), target: getDeal(id)!.target, closes_at: getDeal(id)!.closes_at })),
  }))),
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
  execute: async ({ product_id, max_usd, deadline }) => {
    const product = getProduct(product_id);
    if (!product) throw new UserError(`unknown product ${product_id}; call find_deal for ids`);
    // Same rules as lib/intake.ts: cap at list, drop a malformed or past deadline.
    const maxCents = Math.min(Math.round(max_usd * 100), product.list_cents);
    const today = now().toISOString().slice(0, 10);
    const by = deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline >= today ? deadline : null;
    const grouped = group({ productId: product.id, maxCents, deadline: by }, now());
    if ('ask' in grouped) return json({ question: grouped.ask });
    const { orderId, approveUrl } = await startHold(grouped.dealId, BUYER, maxCents, { returnUrl: `${BASE_URL}/paypal/return` });
    const deal = getDeal(grouped.dealId)!;
    return json({
      hold: orderId, approve_url: approveUrl, hold_amount: usd(maxCents),
      deal: { deal_id: deal.id, product: deal.product, new: grouped.isNew, buyers: heldCount(deal.id), target: deal.target, closes_at: deal.closes_at },
      next: `Buyer opens approve_url to approve the ${usd(maxCents)} hold. Nothing is charged until the deal closes.`,
    });
  },
});

server.addTool({
  name: 'deal_status',
  description: "Status of the buyer's hold and its deal.",
  annotations: { readOnlyHint: true },
  parameters: z.object({ hold: z.string().describe('hold id from join_deal') }),
  execute: async ({ hold: orderId }) => {
    const hold = mustGetHold(orderId);
    const deal = getDeal(hold.deal_id)!;
    return json({
      hold: orderId, hold_status: hold.status, hold_amount: usd(hold.max_cents),
      deal: { deal_id: deal.id, product: deal.product, status: deal.status, buyers: heldCount(deal.id), target: deal.target,
        closes_at: deal.closes_at, ...(deal.price_cents && { price: usd(deal.price_cents) }) },
    });
  },
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
const page = (title: string, text: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;margin:3rem"><h1>${title}</h1><p>${text}`;
server.getApp().get('/paypal/return', async c => {
  if (c.req.query('cancel') !== undefined) return c.html(page('Cancelled', 'No hold was placed. You can close this tab.'));
  try {
    const hold = await authorizeHold(c.req.query('token') ?? '');
    return c.html(page('Hold placed', `${usd(hold.max_cents)} is on hold for deal ${hold.deal_id}. ` +
      'You pay only the final group price. Go back to your chat.'));
  } catch {
    return c.html(page('Hold not placed', 'This approval link is not valid or the deal has closed.'), 400);
  }
});

if (import.meta.main) {
  startClock();
  await server.start({ transportType: 'httpStream', httpStream: { port: PORT } });
  console.error(`group-buy MCP on ${BASE_URL}/mcp`);
}
