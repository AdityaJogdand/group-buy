# Countersign — Build Phases

PayPal AI Hackathon · Deadline **Nov 12, 2026** · Hosted demo **Nov 4** · Code freeze **Nov 9** · Submit **Nov 11**
Spec: `PRD.md` · Screens: `FRONTEND.md` · Team doc: https://claude.ai/code/artifact/a2e33310-b750-496e-baae-7ff7682e0d6f

Escrow where neither side can cheat: both sign the checklist, PayPal holds the money, code + Claude vision check the work with evidence, and the verdict binds both sides unless appealed.

Stack: Next.js + SQLite, Claude (Anthropic SDK, vision), `sharp` for image checks, PayPal REST sandbox, AG Grid, Render.
Prize targets: Most Impactful, Best Use of PayPal + AI, AG Grid sponsor prize.

---

## Phase 0: Validate (Oct 17–19)
- [ ] Read the Devpost page directly: confirm criteria, prizes, submission rules (agents couldn't fetch it)
- [ ] Sandbox: how many reauthorizes are allowed?
- [ ] Sandbox: Venmo payout field (`VENMO` vs `Venmo`), US phone receiver
- [ ] Add `ANTHROPIC_API_KEY` to `.env`
- [ ] Decide the final name

**Exit:** no blocker, or the plan is adjusted.

---

## Phase 1: Money path (Oct 19–24)
- [ ] Authorize order (hold)
- [ ] Capture the earned share with `final_capture`, remainder returned
- [ ] Void (0%, cancel, missed deadline)
- [ ] Reauthorize from day 4; store the new authorization ID
- [x] Payouts (works in `phase1.mjs`) → add `recipient_wallet: VENMO`
- [ ] Webhook endpoint + signature check; events from PRD 8.3
- [ ] Simulated clock for demo mode (72 h → 60 s, hold days)

**Exit:** one script runs hold → reauthorize → partial capture → Venmo payout, and hold → void; webhooks land.

---

## Phase 2: AI core (Oct 24–30)
- [ ] Checklist drafting: items tagged `code` or `vision`, weights, rejected uncheckable wishes
- [ ] Code checks with `sharp` + PDF parser; derived images (32 px render, crops)
- [ ] Vision verifier: labelled multi-image input, per-item result + evidence IDs
- [ ] Second pass on borderline items; disagreement → reviewer
- [ ] Release % computed in code from weights
- [ ] Watermarked low-res preview generation
- [ ] Test set: ~10 logos/PDFs (good and flawed) with expected results

**Exit:** ≥ 9/10 test deliverables match expected results.

---

## Phase 3: App + UI (Oct 31–Nov 4)
- [ ] Contract page with Client / Freelancer / Reviewer role switcher
- [ ] Both-side checklist signing; edits reset signatures
- [ ] Fund with PayPal buttons (authorize); hold countdown
- [ ] Upload → watermarked previews → verdict with evidence images
- [ ] 72 h review window: change request (names a failed item, max 2) or appeal; otherwise settles
- [ ] Reviewer queue + audit trail in AG Grid
- [ ] Live money timeline fed by webhooks
- [ ] **Nov 4: deployed on Render**

**Exit:** the whole demo runs on the hosted URL without touching code.

---

## Phase 4: Polish + submit (Nov 5–11)
- [ ] *(Stretch)* v1 → v2 visual diff: fixed items confirmed, no regressions
- [ ] *(Stretch)* KERNEL browser agent for website deliverables
- [ ] Record the demo (< 3 min, YouTube)
- [ ] README: setup, sandbox logins, architecture, limits, multiparty as production path; open-source license
- [ ] Devpost write-up
- [ ] **Nov 9: code freeze**
- [ ] **Nov 11: submit**

### Demo script
| Time | Beat |
|---|---|
| 0:00 | Maya, a brand designer: "The client used my logo and cancelled." |
| 0:20 | Client and Maya both sign a 5-item checklist for a logo |
| 0:45 | Client funds $400; PayPal holds it, with a countdown |
| 1:00 | Maya uploads v1; the client only sees a watermarked preview |
| 1:15 | Verdict: 2 of 5 fail, with the 32 px render as proof; client requests changes on those items |
| 1:45 | v2 passes. Client tries to release 0% — **blocked**; only "appeal" is offered |
| 2:15 | Window closes → capture → Maya's Venmo +$380; originals unlock for the client |
| 2:40 | Audit trail in AG Grid: every check, every PayPal ID |

---

## Kill switches
- Money path not working by Oct 24 → drop reauthorize and webhooks; demo hold → capture → payout
- Vision verifier under 7/10 on Oct 30 → limit to code checks + 2 vision items
- Not deployed by Nov 4 → stop features, fix deployment
