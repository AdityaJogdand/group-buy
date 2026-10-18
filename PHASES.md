# Countersign — Build Phases

PayPal AI Hackathon · Deadline **Nov 12, 2026** · Hosted demo **Nov 4** · Code freeze **Nov 9** · Submit **Nov 11**
Spec: `PRD.md` · Screens: `FRONTEND.md` · Team doc: https://claude.ai/code/artifact/a2e33310-b750-496e-baae-7ff7682e0d6f

Escrow where neither side can cheat: both sign the checklist, PayPal holds the money, code + Claude vision check the work with evidence, and the verdict binds both sides unless appealed.

Stack: Next.js + SQLite, Claude (Anthropic SDK, vision), `sharp` for image checks, PayPal REST sandbox, AG Grid, Render.
Prize targets: Most Impactful **or** Best Use of PayPal + AI (max one Honorable Mention), plus one sponsor prize (AG Grid; Render as a backup).
Judging: 5 equal criteria (Tech, Design, Impact, Innovation, Presentation); ties go to Tech first. Judges may score from the video alone.
Pitch for first place: **the fight never starts.** The freelancer's private pre-check catches failures before the client sees them; the binding verdict handles the rest. Weak spots to beat: Innovation (other escrow entries) and Presentation.

---

## Phase 0: Validate (Oct 17–19)
- [x] Read the Devpost rules (Oct 17). Findings:
  - Win at most 1 Grand/Honorable Mention + 1 sponsor prize
  - Hosted demo must stay up, free, until judging ends **Dec 15**. Render free tier sleeps and wipes local disk → SQLite needs a persistent disk or a reseed on boot; cap the Anthropic spend
  - Repo public, license file shown in the About section, README with sandbox logins
  - Video < 3 min on YouTube; no copyrighted music or third-party trademarks without permission
- [x] Sandbox: reauthorize is allowed **once**, day 4–29 only, on the real clock (day 0 → `422 REAUTHORIZATION_TOO_SOON`). The demo can't trigger it live, so the simulated clock has to fake that step
- [x] Sandbox: `VENMO` is a valid `recipient_wallet`, but the sandbox rejects it (`Recipient wallet not supported in sandbox`). `PAYPAL` works. Demo pays out to a PayPal sandbox account; Venmo stays a one-field production path
- [ ] Add `ANTHROPIC_API_KEY` to `.env`
- [x] Final name: **Countersign** (Oct 18). Rejected "Uphold": an existing payments company's trademark

**Exit:** no blocker, or the plan is adjusted.

## Ongoing from Oct 18 (needs lead time)
- [ ] Recruit 3–5 freelance designers (r/graphic_design, Fiverr/Upwork contacts, friends) to try the hosted demo from Nov 4
- [ ] Get on-camera clips or written quotes from at least 2 of them for the video
- [ ] Collect ~30 real logos/PDFs (good and flawed) for the test set

---

## Phase 1: Money path (Oct 19–24)
- [ ] Authorize order (hold)
- [ ] Capture the earned share with `final_capture`, remainder returned
- [ ] Void (0%, cancel, missed deadline)
- [ ] Reauthorize from day 4; store the new authorization ID (real call only, not a demo beat; one line in the video)
- [x] Payouts (works in `phase1.mjs`); `recipient_wallet: VENMO` is production-only (sandbox rejects it)
- [ ] Webhook endpoint + signature check; events from PRD 8.3
- [ ] Simulated clock for demo mode (72 h → 60 s, hold days)

**Exit:** one script runs hold → reauthorize → partial capture → PayPal payout, and hold → void; webhooks land.

---

## Phase 2: AI core (Oct 24–30)
- [ ] Checklist drafting: items tagged `code` or `vision`, weights, rejected uncheckable wishes
- [ ] Code checks with `sharp` + PDF parser; derived images (32 px render, crops)
- [ ] Vision verifier: labelled multi-image input, per-item result + evidence IDs
- [ ] Second pass on borderline items; disagreement → reviewer
- [ ] Freelancer pre-check: same verifier, results visible only to the freelancer, before submit
- [ ] Release % computed in code from weights
- [ ] Watermarked low-res preview generation
- [ ] Test set: ~30 logos/PDFs (good and flawed) with expected results set by a human
- [ ] Results table (matches vs human, per item type) for the README and video

**Exit:** ≥ 90% of test deliverables match the human result.

---

## Phase 3: App + UI (Oct 31–Nov 4)
- [ ] Contract page with Client / Freelancer / Reviewer role switcher
- [ ] Both-side checklist signing; edits reset signatures
- [ ] Fund with PayPal buttons (authorize); hold countdown
- [ ] Upload → pre-check → watermarked previews → verdict; the evidence image (e.g. 32 px render) is the largest element on the verdict screen
- [ ] 72 h review window: change request (names a failed item, max 2) or appeal; otherwise settles
- [ ] Reviewer queue in AG Grid as a real tool: filter by verdict, evidence thumbnails in cells, uphold/change inline
- [ ] Audit trail in AG Grid: every check, every PayPal ID
- [ ] Live money timeline fed by webhooks
- [ ] "Start demo contract" button on the hosted URL: seeded files, demo clock, no sandbox login needed
- [ ] **Nov 4: deployed on Render**

**Exit:** the whole demo runs on the hosted URL without touching code.

---

## Phase 4: Polish + submit (Nov 5–11)
- [ ] Polish the contract and verdict screens (Design criterion: complete product, not a proof of concept)
- [ ] Video, 2 full days (Nov 7–8): script, voiceover, captions, royalty-free music; re-cut until a stranger gets it on first viewing; < 3 min, YouTube
- [ ] README: setup, sandbox logins, architecture, limits, multiparty as production path
- [ ] MIT `LICENSE` file; check it shows in the GitHub About section
- [ ] Keep the Render demo up through Dec 15 (persistent disk or reseed, API spend cap)
- [ ] Devpost write-up
- [ ] **Nov 9: code freeze**
- [ ] **Nov 11: submit**

### Demo script
| Time | Beat |
|---|---|
| 0:00 | Maya, a brand designer: "The client used my logo and cancelled." Real designer clips back it up |
| 0:20 | Client and Maya both sign a 5-item checklist for a logo |
| 0:40 | Client funds $400; PayPal holds it, with a countdown |
| 0:55 | Maya runs the private pre-check: 2 of 5 would fail. **Hold on the 32 px render.** She fixes them before the client sees anything |
| 1:25 | She submits; the client sees only a watermarked preview; verdict 5/5 with evidence |
| 1:45 | Client tries to release 0% — **blocked**; only "appeal" is offered |
| 2:05 | Window closes → capture → Maya's PayPal +$380; originals unlock for the client |
| 2:25 | Reviewer queue and audit trail in AG Grid: every check, every PayPal ID |
| 2:40 | "28/30 matched a human reviewer" + designer quote; close on the pitch |

---

## Kill switches
- Money path not working by Oct 24 → drop reauthorize and webhooks; demo hold → capture → payout
- Vision verifier under 70% on Oct 30 → limit to code checks + 2 vision items
- Designers not recruited by Nov 1 → drop the clips, use written quotes from any freelancer feedback
- Not deployed by Nov 4 → stop features, fix deployment
