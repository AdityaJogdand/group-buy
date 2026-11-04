// PayPal webhook receiver. PayPal signs every delivery; we ask PayPal to verify the signature against our
// webhook id (PAYPAL_WEBHOOK_ID, from developer.paypal.com → your app → Webhooks) before acting on anything.
// Unverified or unconfigured = rejected, so nobody can forge an "order approved" or "capture completed".
import { paypal } from './paypal.ts';
import { applyPaymentEvent, type PayPalEvent } from './deals.ts';

export type Verify = (headers: Record<string, string | undefined>, event: unknown) => Promise<boolean>;

export const verifyWithPayPal: Verify = async (h, event) => {
  const webhook_id = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhook_id) return false;
  try {
    const r = await paypal('POST', '/v1/notifications/verify-webhook-signature', {
      auth_algo: h['paypal-auth-algo'], cert_url: h['paypal-cert-url'], transmission_id: h['paypal-transmission-id'],
      transmission_sig: h['paypal-transmission-sig'], transmission_time: h['paypal-transmission-time'],
      webhook_id, webhook_event: event,
    });
    return r.verification_status === 'SUCCESS';
  } catch {
    return false; // missing headers or a bad cert URL come back as 4xx: not verified
  }
};

// Returns the HTTP status to answer PayPal with. 200 = done (or already done); 400 = rejected;
// 503 = not configured; 500 = our failure, so PayPal retries later.
export async function handleWebhook(raw: string, headers: Record<string, string | undefined>, verify: Verify = verifyWithPayPal) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return { status: 503, body: { error: 'webhook not configured' } };
  let event: PayPalEvent;
  try { event = JSON.parse(raw); } catch { return { status: 400, body: { error: 'bad json' } }; }
  if (!event?.id || !event.event_type) return { status: 400, body: { error: 'not a PayPal event' } };
  if (!(await verify(headers, event))) return { status: 400, body: { error: 'signature not verified' } };
  try {
    return { status: 200, body: await applyPaymentEvent(event) };
  } catch (e) {
    console.error('webhook apply failed:', (e as Error).message);
    return { status: 500, body: { error: 'try again' } };
  }
}
