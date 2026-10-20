# Group-Buy Agent — Build Phases

PayPal AI Hackathon · Deadline **Nov 12, 2026, 12:00pm PST** · Hosted demo **Nov 4** · Code freeze **Nov 9** · Submit **Nov 11**
Spec: `PRD.md` · Screens: `FRONTEND.md`

Strangers pool together for the bulk price: PayPal holds each buyer's max, agents group and negotiate, and every hold is captured at the group price or voided.

Stack: Next.js + SQLite, Claude (Anthropic SDK), PayPal REST sandbox + v6 Web SDK, AG Grid, Render.
Prize targets: Best Use of Agentic Commerce **or** Best Use of PayPal + AI (max one Honorable Mention), plus AG Grid sponsor prize.
Judging: 5 equal criteria (Tech, Design, Impact, Innovation, Presentation); ties go to Tech. Judges may score from the video alone.

---

## Phase 0: Validate (Oct 17–19)
- [x] Devpost rules (Oct 17):
  - Win at most 1 Grand/Honorable Mention + 1 sponsor prize
  - Hosted demo stays up, free, until **Dec 15** (Render free tier sleeps and wipes disk → reseed on boot; cap Anthropic spend)
  - Public repo, license shown in About, README with sandbox logins
  - Video < 3 min on YouTube; no copyrighted music or third-party trademarks
- [x] Sandbox (Oct 18, `spike/groupbuy.mjs`): authorize $160 → capture $150 ✓; void ✓; capture up to 115% ✓, above → 422
- [x] Sandbox: headless buyer approval 10/10 (v6 SDK + Playwright) → simulated buyers are feasible
- [ ] Add `ANTHROPIC_API_KEY` to `.env`
- [ ] Create 4–5 extra sandbox buyer accounts (developer dashboard)
- [ ] Pick name and demo product

---

## Phase 1: Money path (Oct 19–24)
- [x] Join deal: authorize order with the buyer's max (`lib/deals.ts`)
- [x] Close deal: capture every hold at the group price (`final_capture: true`), idempotent
- [x] Fail / expire / leave: void
- [x] Drop-out: buyers below the final price voided, rest captured
- [ ] Webhook endpoint + signature check (needs a public URL → do with the Render deploy)
- [x] Simulated clock (3 days → 60 s): `lib/clock.ts`, CLOCK_SPEED=4320 (Oct 19: `npm run test:clock` → PASS)
- [x] Simulated buyers: `scripts/buyers.ts` approves through the real PayPal page (Oct 18: `npm run test:money` → PASS, 10 holds)

**Exit:** one script runs 5 buyers → close → 5 captures, and 5 buyers → expire → 5 voids; webhooks land.

---

## Phase 2: AI agents (Oct 24–30)
- [ ] Intake: free text → `{product, max, deadline}`, one follow-up when unclear
- [ ] Grouping: join an open deal or open a new one
- [ ] Negotiation: buyer-pool agent vs seller agent, max 4 rounds, transcript stored
- [ ] Code guard: price within `[floor, list]` and ≤ every captured hold
- [x] MCP server (FastMCP, `server.ts`, `npm run test:mcp` → PASS): `find_deal`, `join_deal` (returns the PayPal approval link; a human still approves), `deal_status`, `leave_deal`; Streamable HTTP, deployed with the app. PayPal Agent Toolkit 1.11 has `create_order` but no authorize/capture/void tools, so the hold logic stays in `lib/deals.ts`
- [ ] Test sets: 30 buyer requests with expected parse; 50 negotiation runs
- [ ] Results table for README and video

**Exit:** ≥ 90% intake accuracy; 0/50 negotiations outside bounds.

---

## Phase 3: App + UI (Oct 31–Nov 4)
- [ ] Buyer chat → hold → deal page
- [ ] Live deal page: progress bar, countdown, price as buyers join
- [ ] Negotiation transcript, streaming
- [ ] Seller dashboard in AG Grid: buyers, holds, status, PayPal IDs
- [ ] Seller products: edit in AG Grid cells + "Add product" form (name, description, list, floor, tiers); seed in `lib/deals.ts` stays for demo resets
- [ ] Audit trail in AG Grid
- [ ] "Run demo" button: seeded product, simulated buyers, demo clock
- [ ] **Nov 4: deployed on Render**

**Exit:** the whole demo runs on the hosted URL without touching code.

---

## Phase 4: Polish + submit (Nov 5–11)
- [ ] Polish deal page and seller dashboard
- [ ] Video (Nov 7–8): script, voiceover, captions; < 3 min, YouTube
- [ ] README: setup, sandbox logins, architecture, limits
- [ ] MIT `LICENSE`
- [ ] Keep Render demo up through Dec 15
- [ ] Devpost write-up
- [ ] **Nov 9: code freeze** · **Nov 11: submit**

### Demo script
| Time | Beat |
|---|---|
| 0:00 | Sam wants a $200 course; alone, no discount |
| 0:15 | Sam types "UX course under $160"; agent finds a deal: 14 of 20 |
| 0:35 | Sam approves a $160 PayPal hold — not charged |
| 0:50 | Buyers keep joining; progress bar fills to 20 |
| 1:10 | Negotiation live: pool agent vs seller agent → $150 |
| 1:35 | **Deal locks: 20 captures at $150 at once**; Sam's PayPal shows $150, not $160 |
| 1:55 | Second deal fails to fill → all holds voided, nobody charged |
| 2:15 | Seller dashboard in AG Grid: 20 sales, every PayPal ID |
| 2:35 | Close: "Bulk prices for everyone, and nobody pays unless the deal happens" |

---

## Kill switches
- Money path not working by Oct 24 → drop webhooks; poll PayPal instead
- Negotiation unreliable by Oct 30 → seller tiers set price; AI only explains the result
- Not deployed by Nov 4 → stop features, fix deployment
