# PRD — Countersign

Owner: team · Status: draft · Last updated: Oct 17, 2026
Plan and dates: `PHASES.md` · Screens: `FRONTEND.md` · Team doc: https://claude.ai/code/artifact/a2e33310-b750-496e-baae-7ff7682e0d6f

## 1. Summary
**Escrow where neither side can cheat.** Client and freelancer both sign a checklist. The client's money is held by PayPal (authorized, not charged). The freelancer delivers; code and Claude vision check the work item by item and attach visual evidence. The verdict binds **both** sides: it executes automatically unless someone appeals to a human reviewer.

## 2. Problem
- Creative freelancers get burned after delivery: clients cancel and keep using the work, or demand endless "revisions" ([Fiverr #346271](https://community.fiverr.com/forums/topic/346271-unfair-order-cancellation-after-5-star-review-%E2%80%93-sellers-at-risk), [#306430](https://community.fiverr.com/forums/topic/306430-fiverr-declined-compensation-following-fraudulent-behavior-from-the-buyer)).
- 85% of freelancers are paid late at least sometimes ([Agiled / Remote 2025](https://agiled.app/statistics/late-payment-statistics)).
- Clients pay upfront and get junk, or the freelancer disappears.
- Arbitration costs too much for small jobs (Upwork: $291 per party).

## 3. Competition (same hackathon)
| | Holdfast | Milestone Escrow | **Countersign** |
|---|---|---|---|
| Who approves checklist | Client only | ? | **Both sides sign** |
| Who decides payout | Client (can pick 0%) | ? | **Verdict binds; appeal to human** |
| Deliverables checked | GitHub repos, text pages | Websites | **Images and PDFs, with visual evidence** |
| Client keeps work without paying | Possible | ? | **Blocked: watermarked previews** |
| Hold expiry (3-day / 29-day) | Not handled | ? | **Countdown + reauthorize** |
| Webhooks, Venmo | No | ? | **Webhooks yes; Venmo in production (sandbox rejects it)** |

Pitch leads with fairness and creative work. Never say "AI escrow".

## 4. Lead persona
**Maya, freelance brand designer, $300–800 logo and packaging jobs.** Her work is visual (Holdfast can't check it), usable the moment it's delivered (watermarking matters), and too small for $291 arbitration.

## 5. Goals and non-goals
**Goals (hackathon)**
1. Fair flow end to end in PayPal sandbox: sign → hold → deliver → verify → binding settle, with void, reauthorize, Venmo payout and webhooks.
2. Verification of **images and PDFs**: code checks + Claude vision, evidence for every item.
3. A hosted demo on Render by **Nov 4**.

**Non-goals:** code/repo deliverables (Holdfast covers them), an MCP server, login/accounts, non-USD, gigs over 29 days without milestones, PayPal Disputes API (doesn't fit a hold), PayPal multiparty (needs partner approval; noted as production path in the README).

## 6. Fairness rules
| # | Rule | Protects |
|---|---|---|
| 1 | Both parties sign the same checklist version (with item weights) before the hold | Both |
| 2 | Delivery deadline set at signing; nothing delivered by then → hold voided automatically | Client |
| 3 | Client sees **watermarked, low-res previews** until release; originals unlock on capture | Freelancer |
| 4 | The verdict executes after a **72-hour review window** unless either side appeals; silence = verdict stands | Freelancer |
| 5 | The client cannot lower a verdict. They can request changes (max 2), and each request must name a failed item | Freelancer |
| 6 | Either side may appeal once. A human reviewer sees checklist, files and AI evidence; their decision is final | Both |
| 7 | Partial credit comes from the weights agreed at signing: pass = full, partial = half, fail = 0 | Both |
| 8 | `unsure` is never scored as a fail: it goes to the reviewer | Freelancer |

Demo mode shortens the 72-hour window to 60 seconds (simulated clock).

## 7. Contract lifecycle
```
DRAFT ─► PROPOSED ─► SIGNED ─► FUNDED ─► SUBMITTED ─► VERIFYING ─► VERDICT (72 h window)
                        │         │                                   │
                        │         ├─ deadline passed ─► VOIDED         ├─ no appeal ─► SETTLED (capture + payout)
                        │         └─ client cancels before delivery    ├─ change request ─► FUNDED (resubmit)
                        │            ─► VOIDED                         └─ appeal ─► IN_APPEAL ─► SETTLED
                        └─ either side edits ─► PROPOSED (signatures reset)
```
- `FUNDED` holds a PayPal authorization; `SETTLED` = captured share + payout, remainder returned (or void at 0%).
- After 2 change requests, the next verdict is final except for appeal.

## 8. Functional requirements

### 8.1 Checklist
- Claude drafts 3–8 items from the brief, each with `{id, criterion, check: code|vision, weight 1–5}`; uncheckable wishes go to `rejected[]` with a concrete suggestion.
- Code-checkable items (format, pixel size, transparency, page count, word count, dominant colors) are tagged `code` and never sent to the model.
- Any edit resets both signatures.

### 8.2 Verification
- **Code first** (`sharp`, PDF parser): file type by magic bytes, dimensions, alpha, colors, page/word count. Also produces derived images: 32 px render (upscaled for vision), crops, grayscale.
- **Vision second:** Claude gets labelled images ("Image 1: original", "Image 2: at 32 px") and judges only the `vision` items.
- Per item: `{id, result: pass|partial|fail|unsure, evidence_ids[], reason, fix}`. No evidence → `unsure`.
- Borderline (any `unsure`, or a low-confidence fail) → a second pass seeing only that item + its evidence; disagreement → reviewer.
- Code results override vision when they conflict.
- The release % is computed in code from item results and weights; the model never outputs an amount.
- Prompt injection: criteria in the system prompt, files wrapped as untrusted data, a `manipulation` field reports text addressing the reviewer.
- Known vision limits ([Claude docs](https://platform.claude.com/docs/en/build-with-claude/vision)): approximate counts, weak below 200 px → counting done in code, small renders upscaled.

### 8.3 Payments (PayPal sandbox)
| Event | Call |
|---|---|
| Fund | Orders v2 `intent: AUTHORIZE` → `/authorize` |
| Keep hold alive | `POST /v2/payments/authorizations/{id}/reauthorize` from day 4 (3-day honor, 29-day validity); store the new ID |
| Settle | `/capture` with `final_capture: true` for the earned share → Payouts to email (`recipient_wallet: VENMO` in production only; the sandbox rejects it), minus 5% fee |
| Void | `/void` at 0%, on cancel, or when the deadline passes |
| Webhooks | `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED/DECLINED`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED/UNCLAIMED/RETURNED/FAILED`; verified via `/v1/notifications/verify-webhook-signature` |
| Agent read-only | PayPal Agent Toolkit lookup tools so the audit trail shows the agent confirming PayPal state |

- Idempotency: `PayPal-Request-Id` = contract ID + action (+ amount for capture).
- Capture succeeded but payout failed → retry the payout only.
- Unclaimed payout → reminder to the freelancer, flagged in the timeline.
- Sources: [reauthorize](https://developer.paypal.com/api/payments/v2/authorizations-reauthorize), [honor period](https://developer.paypal.com/docs/checkout/standard/customize/authorization-honor/), [Venmo payouts](https://developer.paypal.com/payouts/use-payouts/venmo.md), [webhook events](https://developer.paypal.com/api/rest/webhooks/event-names/).

### 8.4 Audit trail
Append-only events `{at, actor, type, data}`: checklist versions and signatures, every check with evidence IDs, verdicts, appeals, every PayPal ID. Shown in AG Grid, exportable as JSON.

## 9. Data model (SQLite)
```
contracts   id, title, brief, amount_cents, fee_bps, status, deadline_at, review_ends_at,
            client_email, freelancer_email, freelancer_venmo, revisions,
            paypal_order_id, authorization_id, auth_honor_ends_at, capture_id, payout_batch_id
checklists  id, contract_id, version, items_json, client_signed_at, freelancer_signed_at
submissions id, contract_id, n, files_json, preview_files_json, created_at
checks      id, submission_id, results_json, release_pct, decision, raw_json
evidence    id, check_id, kind (crop|render|metric), path, note
appeals     id, contract_id, by_role, reason, decided_by, outcome, decided_at
events      id, contract_id, at, actor, type, data_json
```

## 10. Success metrics (demo)
- Verifier matches expected results on ≥ 9/10 test deliverables.
- Upload → verdict under 60 s.
- Every money movement in the demo has a PayPal ID in the audit trail.
- Hosted demo live on Render by Nov 4.

## 11. Risks
| Risk | Mitigation |
|---|---|
| Third escrow entry; innovation scored low | Lead with fairness + creative work; the 0%-blocked moment |
| Behind Holdfast on polish | Hosted demo by Nov 4; one polished flow over many features |
| AI wrong call | Evidence per item; second pass; `unsure` → reviewer; appeal |
| Reauthorize: once, day 4–29, real clock (sandbox-tested Oct 17) | Demo fakes it via the simulated clock; real call runs in the background job |
| Judging criteria unconfirmed (Devpost blocked our fetch) | Team reads Devpost directly in Phase 0 |

## 12. Open questions
- [ ] Final name: Countersign or Evenkeel?
- [ ] Who is the reviewer in the demo (a team member as "Countersign staff")?
- [ ] Appeal fee: skip in the hackathon build, or show it?
