// PayPal REST (sandbox only). Throws on non-2xx with PayPal's issue + debug_id.
const API = 'https://api-m.sandbox.paypal.com';
let token: { value: string; exp: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now()) return token.value;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing');
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const r = await res.json();
  if (!res.ok) throw new Error(`PayPal token -> ${res.status} ${r.error}: ${r.error_description}`);
  // Refresh a minute early so a token never expires mid-request.
  token = { value: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
  return token.value;
}

// requestId -> PayPal-Request-Id, so a retried capture/void can't run twice.
// ponytail: responses typed `any`; add PayPal response types if field typos start biting.
export async function paypal(method: string, path: string, body?: unknown, requestId?: string): Promise<any> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...(requestId && { 'PayPal-Request-Id': requestId }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) {
    const msg = `${method} ${path} -> ${res.status} ${data.details?.[0]?.issue ?? data.name} (debug_id ${data.debug_id})`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}
