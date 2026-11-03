# PRD — Group-Buy Agent (working name)

Owner: team · Status: draft · Last updated: Oct 18, 2026
Plan and dates: `PHASES.md` · Screens: `FRONTEND.md` · Sandbox proof: `spike/groupbuy.mjs`

## 1. Summary
**Strangers pool together to get the bulk price.** A buyer tells an AI agent what they want and the most they'll pay. PayPal holds that amount (authorized, not charged). The agent groups buyers who want the same thing and negotiates a volume price with the seller's agent. If the deal closes, every hold is captured at the lower group price at once. If it doesn't, every hold is voided and nobody pays.

## 2. Problem
- Bulk prices exist (seats, licenses, courses, tickets), but one buyer alone can't reach them.
- Sellers want volume but pay for ads and lose sales to abandoned carts.
- Group-buying sites need a human to set every deal and trust that buyers will actually pay.

## 3. Why PayPal, why AI
- **PayPal is the mechanism, not a button.** Hold → capture less → void is PayPal's authorization system. Without it, buyers would pay upfront and need refunds when deals fail.
- **AI does the work a human organizer did:** understand messy requests, group them, negotiate.

## 4. Competition
| | Organizer slide "Autonomous Negotiator" | **Group-Buy Agent** |
|---|---|---|
| Who negotiates | 1 buyer agent vs 1 seller agent | **A pool of buyers vs the seller** |
| Money | `pay_order` after a deal | **Held first; captured only if the deal closes** |
| Failure case | — | **Void: nobody charged** |

Expect many 1:1 negotiator entries. Pitch leads with pooling + "nobody pays unless the deal happens".

## 5. Personas
- **Buyer — Sam**, wants an online design course. List $200; Sam will pay up to $160.
- **Seller — Lena**, sells the course. Sets tiers and a secret floor ($120). Each extra seat costs her nothing.

Demo uses **digital goods / seats** (course, software licenses, workshop). Nothing ships.

## 6. Goals and non-goals
**Goals (hackathon)**
1. Full money flow in PayPal sandbox: hold → deal closes → capture at group price, and hold → deal fails → void.
2. Three agents: intake, grouping, negotiation, with a visible transcript.
3. Hosted demo on Render by **Nov 4**.

**Non-goals:** physical shipping (Tracking API works in sandbox, noted as next step), accounts/login, non-USD, deals longer than 3 days, payouts to sellers (seller is the PayPal merchant), Venmo (sandbox rejects it).

## 7. Deal rules (enforced in code, never by the model)
| # | Rule |
|---|---|
| 1 | Each buyer's hold = their max price. Final charge ≤ hold, always |
| 2 | Final price ≥ seller floor, always. The model proposes; code rejects anything outside `[floor, list]` |
| 3 | Deal closes when `buyers ≥ target` and a price is agreed; buyers whose max < final price drop out and are voided |
| 4 | Deal window ≤ 3 days (PayPal honor period). Expired → void all holds |
| 5 | A buyer can leave before close → their hold is voided |
| 6 | All holds in a deal are captured or voided together |

Demo mode: simulated clock (3 days → 60 s).

## 8. Deal lifecycle
```
OPEN (collecting holds) ─► NEGOTIATING ─► CLOSED ─► CAPTURED (all at group price)
   │                            │
   └─ window ends ─► EXPIRED    └─ no price ≥ floor ─► FAILED ─► all VOIDED
```

## 9. Functional requirements

### 9.1 Intake agent
- Free text ("a UX course, under $160, before December") → `{product_id, max_price, deadline}`.
- Matches against the seller catalog; unclear → asks one follow-up question.
- Max price is confirmed by the buyer on the PayPal hold, never taken silently from the model.

### 9.2 Grouping agent
- Puts new requests into an open deal for the same product, or opens one.
- Shows the buyer "18 of 20 — you'd save $40".

### 9.3 Negotiation agent
- Buyer-side agent argues from pool size and buyers' max prices; seller agent knows tiers and floor.
- Max 4 rounds; transcript stored and shown.
- Output: `{price}` → validated by rule 2; invalid → rejected and logged.
- Prompt injection: buyer text is untrusted data, never instructions to the negotiator.

### 9.4 Payments (PayPal sandbox, tested Oct 18 in `spike/groupbuy.mjs`)
| Event | Call | Sandbox result |
|---|---|---|
| Join deal | Orders v2 `intent: AUTHORIZE` → `/authorize` | 201, valid 29 days |
| Deal closes | `/v2/payments/authorizations/{id}/capture`, `final_capture: true`, group price | $150 of $160 → 201 COMPLETED |
| Deal fails / buyer leaves | `/void` | 204 → VOIDED |
| Over the hold | capture > hold | ≤115% OK ($184 of $160); $230 → 422 `MAX_CAPTURE_AMOUNT_EXCEEDED` |
| Webhooks | `PAYMENT.AUTHORIZATION.CREATED/VOIDED`, `PAYMENT.CAPTURE.COMPLETED/DECLINED`; verified via `/v1/notifications/verify-webhook-signature` | — |

- Idempotency: `PayPal-Request-Id` = deal ID + buyer ID + action.
- Partial capture failure → retry that capture only; deal shows "1 payment pending".
- Honor period is 3 days in production, so deals close within 3 days (reauthorize not needed).

### 9.5 Audit trail
Append-only events `{at, actor, type, data}`: requests, grouping, every negotiation round, every PayPal ID. Shown in AG Grid.

## 10. Data model (SQLite)
```
products     id, seller, name, list_cents, floor_cents, tiers_json
deals        id, product_id, status, target, price_cents, closes_at
requests     id, deal_id, buyer_email, text, max_cents, status
holds        id, request_id, order_id, authorization_id, capture_id, status
negotiation  id, deal_id, round, by, message, proposed_cents, valid
events       id, deal_id, at, actor, type, data_json
```

## 11. Success metrics (demo)
- Intake parses ≥ 9/10 test requests correctly.
- Negotiation never ends outside `[floor, list]` in 50 simulated runs.
- 20 holds → close → 20 captures in under 60 s.
- Every money movement has a PayPal ID in the audit trail.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Looks like the organizers' Negotiator slide | Lead with pooling + holds + void; show the failure case |
| 20 real buyers in a demo | Simulated buyers approve holds via Playwright (10/10 reliable in sandbox), labelled as simulated |
| Model proposes a bad price | Code enforces floor and holds; invalid offers rejected |
| Honor period (3 days) | Deal window ≤ 3 days |

## 13. Open questions
- [ ] Final name
- [ ] Demo product: course seats or software licenses?
- [ ] Use PayPal Agent Toolkit for the agents' PayPal calls, or direct REST?