// Minimal v6 Web SDK checkout: one page, create-order and capture routes. Pattern from
// github.com/paypal-examples/v6-web-sdk-sample-integration (oneTimePayment/recommended).
// Run: node --env-file=../.env server.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const API = 'https://api-m.sandbox.paypal.com';
const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret, PORT = 3000 } = process.env;
if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing');

export async function paypal(method, path, body) {
  const t = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  }).then(r => r.json());
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: res.status === 204 ? {} : await res.json() };
}

const page = readFileSync(new URL('index.html', import.meta.url), 'utf8').replace('__CLIENT_ID__', id);

createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  try {
    if (req.method === 'GET' && req.url.split('?')[0] === '/') {
      // v6 popups need this, per the sample's crossOriginOpenerPolicyMiddleware.
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' });
      return res.end(page);
    }
    if (req.method === 'POST' && req.url.split('?')[0] === '/api/orders') {
      const q = new URL(req.url, 'http://x').searchParams;
      const { status, data } = await paypal('POST', '/v2/checkout/orders', {
        intent: q.get('intent') ?? 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: q.get('amount') ?? '10.00' } }],
      });
      return send(status, data);
    }
    const m = req.url.match(/^\/api\/orders\/([A-Z0-9]+)\/capture$/);
    if (req.method === 'POST' && m) {
      const { status, data } = await paypal('POST', `/v2/checkout/orders/${m[1]}/capture`, {});
      return send(status, data);
    }
    send(404, { error: 'not found' });
  } catch (e) {
    send(500, { error: e.message });
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
