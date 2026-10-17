// Phase 1 sandbox proof: order -> capture -> partial refund -> payout -> transaction search.
// Run: node --env-file=.env phase1.mjs <token|order|capture|refund|payout|search>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API = 'https://api-m.sandbox.paypal.com';
const BUYER = 'sb-noebc53187450@personal.example.com';
const STATE = '.state.json';
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

async function token() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing from .env');
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token failed: ${JSON.stringify(body)}`);
  return body;
}

async function call(method, path, body) {
  const { access_token } = await token();
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data, null, 2)}`);
  return data;
}

const steps = {
  async token() {
    const t = await token();
    console.log('OK token. Scopes include payouts:', t.scope.includes('payouts'),
      '| reporting:', t.scope.includes('reporting'));
  },

  // Order with line items (SKU, qty, unit price) so Transaction Search returns cart_info later.
  async order() {
    const o = await call('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      // Without a return_url the sandbox checkout page just reloads after approval.
      payment_source: { paypal: { experience_context: {
        return_url: 'https://example.com/approved', cancel_url: 'https://example.com/cancelled', user_action: 'PAY_NOW' } } },
      purchase_units: [{
        invoice_id: `TB-${Date.now()}`,
        amount: { currency_code: 'USD', value: '47.00',
          breakdown: { item_total: { currency_code: 'USD', value: '42.00' },
                       handling: { currency_code: 'USD', value: '5.00' } } }, // handling = the $5 tariff surcharge
        items: [{ name: 'Ceramic lamp', sku: 'LAMP-01', quantity: '1',
                  unit_amount: { currency_code: 'USD', value: '42.00' } }],
      }],
    });
    state.orderId = o.id; save();
    console.log('Order', o.id, '\nApprove it as the buyer (', BUYER, '):\n',
      o.links.find(l => l.rel === 'approve' || l.rel === 'payer-action').href, '\nThen run: capture');
  },

  async capture() {
    const c = await call('POST', `/v2/checkout/orders/${state.orderId}/capture`, {});
    state.captureId = c.purchase_units[0].payments.captures[0].id; save();
    console.log('Captured', state.captureId, 'status', c.status);
  },

  // Partial refund of the $5 surcharge on the original capture (the <=180-day path).
  async refund() {
    const r = await call('POST', `/v2/payments/captures/${state.captureId}/refund`, {
      amount: { currency_code: 'USD', value: '5.00' },
      note_to_payer: 'IEEPA tariff refund',
    });
    console.log('Refund', r.id, r.status);
  },

  // Payout to the buyer's email (the >180-day path).
  async payout() {
    const p = await call('POST', '/v1/payments/payouts', {
      sender_batch_header: { sender_batch_id: `TB-${Date.now()}`, email_subject: 'Your tariff refund',
        email_message: 'We passed our IEEPA tariff refund back to you.' },
      items: [{ recipient_type: 'EMAIL', receiver: BUYER, note: 'IEEPA tariff refund',
        sender_item_id: state.captureId ?? 'demo-old-order',
        amount: { currency: 'USD', value: '4.80' } }],
    });
    console.log('Payout batch', p.batch_header.payout_batch_id, p.batch_header.batch_status);
  },

  // Transaction Search (can lag up to ~3h behind new transactions).
  async search() {
    const end = new Date(), start = new Date(end - 30 * 864e5);
    const q = new URLSearchParams({ start_date: start.toISOString(), end_date: end.toISOString(), fields: 'all' });
    const s = await call('GET', `/v1/reporting/transactions?${q}`);
    console.log(`${s.transaction_details.length} transactions`);
    for (const t of s.transaction_details)
      console.log(t.transaction_info.transaction_id, t.transaction_info.transaction_amount?.value,
        t.payer_info?.email_address ?? '-', (t.cart_info?.item_details ?? []).map(i => i.item_code).join(','));
  },
};

const step = process.argv[2];
if (!steps[step]) { console.log('steps:', Object.keys(steps).join(' | ')); process.exit(1); }
steps[step]().catch(e => { console.error(e.message); process.exit(1); });
