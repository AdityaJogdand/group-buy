// Group-buy spike: buyers approve a $160 hold; on deal we capture less, on no-deal we void.
// Also checks how far a capture may go above the hold (for per-region shipping).
// Run: node --env-file=../.env groupbuy.mjs
import { chromium } from 'playwright';
import { paypal } from './server.mjs';

const { PAYPAL_BUYER_EMAIL: email, PAYPAL_BUYER_PASSWORD: password } = process.env;

async function holdOne(amount) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:3000/?nocapture&intent=AUTHORIZE&amount=${amount}`);
  await page.getByText('ready').waitFor({ timeout: 20_000 });
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#paypal-button').click()]);
  await popup.locator('#email').fill(email, { timeout: 30_000 });
  if (await popup.locator('#btnNext').isVisible()) await popup.locator('#btnNext').click();
  await popup.locator('#password').fill(password, { timeout: 30_000 });
  await popup.locator('#btnLogin').click();
  await popup.locator('#payment-submit-btn, button:has-text("Complete Purchase"), button:has-text("Pay"), button:has-text("Continue")').first().click({ timeout: 60_000 });
  const id = (await page.getByText(/approved \w+/).textContent({ timeout: 60_000 })).split(' ')[1];
  await browser.close();
  const { status, data } = await paypal('POST', `/v2/checkout/orders/${id}/authorize`, {});
  const a = data.purchase_units?.[0]?.payments?.authorizations?.[0];
  console.log(`hold ${amount}:`, status, a?.status, a?.amount?.value, '| expires', a?.expiration_time);
  return a.id;
}

const capture = (auth, value) => paypal('POST', `/v2/payments/authorizations/${auth}/capture`,
  { amount: { currency_code: 'USD', value }, final_capture: true });
const show = (label, r) => console.log(label, r.status, r.data.status ?? r.data.details?.[0]?.issue ?? '', r.data.amount?.value ?? '');

const a = await holdOne('160.00');
show('deal: capture 150 of 160 ->', await capture(a, '150.00'));

const b = await holdOne('160.00');
show('no deal: void ->', await paypal('POST', `/v2/payments/authorizations/${b}/void`, {}));
show('  auth after void ->', await paypal('GET', `/v2/payments/authorizations/${b}`));

const c = await holdOne('160.00');
show('over: capture 230 of 160 ->', await capture(c, '230.00'));
show('over: capture 184 of 160 ->', await capture(c, '184.00'));
process.exit(0);
