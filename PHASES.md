# TariffBack — Build Phases

PayPal AI Hackathon · Deadline **Nov 12, 2026** · Code freeze **Nov 9** · Submit **Nov 11**

TariffBack takes the IEEPA tariff refund a brand gets back from CBP or its carrier and passes each customer's share back through PayPal. Orders 180 days old or less get a partial refund. Older orders get a Payouts payment. Every dollar has an audit trail.

Stack: Next.js (pages + API routes), SQLite, Claude through the Anthropic SDK (a plain tool-use loop), PayPal REST + Agent Toolkit, all in sandbox.

---

## Phase 0: Evidence check (Oct 17, half a day)
**Goal:** make sure the pitch's claims hold up. No outreach needed; the public evidence covers demand (Panic, NPR/Princess Awesome, CNN, class actions).

- [ ] Verify the unconfirmed claims: the 80–100+ class-action count, the CAPE Phase 3 date (Oct 6, 2026), and the $122–126B certified
- [ ] Confirm PayPal's 180-day refund limit in the main developer docs
- [ ] Confirm that cashback to past customers is an allowed Payouts use case
- [ ] *(Optional)* One public post in r/shopify or r/smallbusiness asking how merchants are handling tariff refunds to customers. Replies go into the pitch

**Exit:** the claims check out. If one is wrong, drop it from the pitch.

---

## Phase 1: Sandbox proof (Oct 17–23)
**Goal:** the whole PayPal money path works end to end in sandbox.

- [x] Sandbox business account + 3 personal buyer accounts
- [x] Seed orders with line items (`items[]` with SKU, quantity, unit price) through Orders v2, then capture them
- [ ] Transaction Search `GET /v1/reporting/transactions?fields=all`: confirm `payer_info.email_address`, `cart_info.item_details`, capture ID
- [x] Partial refund `POST /v2/payments/captures/{id}/refund` with `note_to_payer`
- [x] Payouts batch `POST /v1/payments/payouts` to email and Venmo, with `sender_item_id` = original transaction ID
- [ ] Webhook endpoint with signature check (`/v1/notifications/verify-webhook-signature`) for `PAYMENT.PAYOUTS-ITEM.UNCLAIMED` and `PAYMENT.CAPTURE.REFUNDED`
- [ ] Wire Agent Toolkit tools (`list_transactions`, `create_refund`, `get_refund`, `get_merchant_insights`) into the Claude tool loop

**Status (Oct 17):** order, capture, partial refund and payout all work (`phase1.mjs`). Transaction Search is still 403 NOT_AUTHORIZED; fallback is `GET /v2/checkout/orders/{id}` plus the brand's order export. Sender must be a **US** sandbox business account (an India account gets PAYOUT_NOT_AVAILABLE). eCheck captures stay PENDING and can't be partially refunded, so route those to Payouts.

**Exit:** one script runs seed → search → refund → payout → webhook received. Mind the up-to-3-hour Transaction Search lag.

---

## Phase 2: Parser + allocation (Oct 24–30)
**Goal:** turn a CBP refund notice into a refund amount per order.

- [ ] Claude parses CBP refund notices and 7501 entry summaries (PDF or image) into entry line → HTS code, value, quantity, and each duty layer
- [ ] Separate IEEPA (refundable) from Section 122, 232 and 301 (not refundable)
- [ ] Catalog import: SKU → HTS code and country of origin (CSV)
- [ ] Match orders to SKUs (line items from Transaction Search, or join `invoice_id` to the store export)
- [ ] Allocation in plain code, not the LLM: IEEPA cost per unit × quantity, capped pro rata at the refund actually received
- [ ] Routing: order date ≤ 180 days → refund, otherwise Payouts. The demo uses simulated order dates, since sandbox can't backdate
- [ ] Seed dataset: 1 fake brand, ~1,200 orders, 1 CBP notice

**Exit:** allocation totals add up exactly to the refund received. The run has an assert-based self-check.

---

## Phase 3: Audit pack + UI (Oct 31–Nov 6)
**Goal:** something a brand owner can click through, and a receipt for every dollar.

- [ ] Upload screen: CBP notice + catalog CSV
- [ ] Review screen: orders, amounts, path (refund / payout), confidence, with a human review queue for low confidence
- [ ] Execute button that sends the refunds and the Payouts batch
- [ ] Live tool-call trace pane showing each PayPal call and its ID
- [ ] Audit pack export (CSV + JSON): order, PayPal ID, formula, source-document hash
- [ ] A plain-language note drafted for each customer
- [ ] Unclaimed-payout handling: retry or flag
- [ ] "Not legal advice" line in the UI

**Exit:** the whole demo flow runs from the UI without touching code.

---

## Phase 4: Polish + demo (Nov 7–11)
**Goal:** submission ready.

- [ ] *(Stretch, only if ahead of schedule)* Estimate for tariffs folded into prices: price rise of tariffed SKUs vs domestic SKUs, capped at IEEPA cost per unit, labelled as an estimate
- [ ] Record the 3-minute demo (script below)
- [ ] README: setup, sandbox credentials, architecture, limits (simulated dates, 180-day rule)
- [ ] Devpost write-up + target prizes (PayPal + AI, Most Impactful, Most Creative)
- [ ] **Nov 9: code freeze**
- [ ] **Nov 11: submit** (one day of buffer before the Nov 12 deadline)

### Demo script
| Time | Beat |
|---|---|
| 0:00 | Supreme Court headline, then "Costco sued". "We got $38k back. Whose money is it?" |
| 0:25 | Drop in the CBP notice. The AI separates IEEPA from the Section 301 layer |
| 0:55 | Orders matched, with a confidence badge for each SKU |
| 1:30 | 1,214 orders, totals add up exactly to $38k |
| 1:50 | Path A: partial refund, the buyer sees "+$4.80 Tariff refund" |
| 2:15 | Path B: a 14-month-old order is paid through Payouts. A low-confidence order goes to review |
| 2:40 | Audit pack + "We gave it back" email |

---

## Kill switches
- Phase 1 chain doesn't work by Oct 23 → cut Payouts and demo the refund path only
- Behind schedule on Nov 6 → drop the stretch goal and the customer-note drafting
