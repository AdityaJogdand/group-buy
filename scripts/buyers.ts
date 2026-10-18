// Simulated buyer: approves a PayPal order in a headless browser with the sandbox buyer account.
import { chromium } from 'playwright';

export const RETURN_URL = 'http://localhost:3000/paypal/return';

// Sandbox pages sometimes time out; one retry.
export async function approve(approveUrl: string) {
  try { return await approveOnce(approveUrl); } catch { return approveOnce(approveUrl); }
}

async function approveOnce(approveUrl: string) {
  const { PAYPAL_BUYER_EMAIL: email, PAYPAL_BUYER_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('PAYPAL_BUYER_EMAIL / PAYPAL_BUYER_PASSWORD missing');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Nothing listens on the return URL; answer it here so the redirect lands.
    await page.route(RETURN_URL + '**', r => r.fulfill({ body: 'ok' }));
    await page.goto(approveUrl);
    await page.locator('#email').fill(email, { timeout: 30_000 });
    if (await page.locator('#btnNext').isVisible()) await page.locator('#btnNext').click();
    await page.locator('#password').fill(password, { timeout: 30_000 });
    await page.locator('#btnLogin').click();
    await page.locator('#payment-submit-btn, button:has-text("Continue"), button:has-text("Complete Purchase"), button:has-text("Pay")')
      .first().click({ timeout: 60_000 });
    await page.waitForURL(u => u.href.startsWith(RETURN_URL), { timeout: 60_000 });
    if (page.url().includes('cancel')) throw new Error('buyer cancelled');
  } finally {
    await browser.close();
  }
}
