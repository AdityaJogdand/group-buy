# Group-Buy Agent

**Strangers pool together to get the bulk price.** A buyer tells an AI agent what they want and the most they'll pay. PayPal holds that amount (authorized, not charged). The agent groups buyers who want the same thing and negotiates a volume price with the seller's agent.

- Deal closes → every hold is captured at the lower group price, all at once.
- Deal fails or expires → every hold is voided. Nobody pays.

Built for the PayPal AI Hackathon (deadline Nov 12, 2026; hosted demo Nov 4).

## Problem
- Bulk prices exist (seats, licenses, courses, tickets), but one buyer alone can't reach them.
- Sellers want volume but pay for ads and lose sales to abandoned carts.
- Group-buy sites need a human to set every deal and trust that buyers will pay.

## How it works
1. **Intake agent**: turns free text ("a UX course, under $160, before December") into `{product, max_price, deadline}`; asks one follow-up if unclear.
2. **Grouping agent**: puts the request into an open deal for that product, or opens one ("18 of 20, you'd save $40").
3. **Negotiation agent**: buyer-side agent argues from pool size against the seller agent (tiers and a secret floor). Max 4 rounds, transcript stored and shown.
4. **PayPal payments**: Orders v2 `AUTHORIZE` on join → capture at the group price on close (`final_capture`) → void on failure or leave. Webhooks are signature-verified.

## Deal rules (enforced in code, never by the model)
1. A buyer's hold is their max price; the final charge is never above it.
2. Final price is always within `[seller floor, list]`; the model proposes, code rejects anything outside.
3. Closes when buyers ≥ target and a price is agreed; buyers whose max is below the final price drop out and are voided.
4. Deal window ≤ 3 days (PayPal honor period); expired → void all.
5. A buyer can leave before close → their hold is voided.
6. All holds in a deal are captured or voided together.

```
OPEN ─► NEGOTIATING ─► CLOSED ─► CAPTURED
  │           │
  └► EXPIRED  └► FAILED ─► all VOIDED
```

## Why it's different
Most entries are 1 buyer agent vs 1 seller agent. This is **a pool of buyers vs the seller**, money is **held first and captured only if the deal closes**, and the failure case (void) is shown.

## Stack
- **Backend** (repo root): Node 24 + TypeScript, SQLite, FastMCP server (`find_deal`, `join_deal`, `deal_status`, `leave_deal`) at `:3000/mcp`, plus REST API.
- **Website** (`web/`): Next.js 16, React 19, Tailwind 4 at `:3001`; Ask AI side panel, category filters, featured group with price ladder.
- **Deploy**: Render blueprint (`render.yaml`), two services.
- Demo uses digital goods/seats; a simulated clock (3 days → 60 s) and simulated buyers (Playwright approving real sandbox holds) make the demo runnable.

## Running
```
npm install && npm start          # backend  → :3000
cd web && npm install && npm run dev   # website → :3001
```
Needs `.env` with `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` for PayPal checkout and AI features. Tests: `npm run test:money | test:clock | test:autoclose | test:intake | test:grouping | test:mcp`.

## More
`PRD.md` (spec), `PHASES.md` (build plan), `FRONTEND.md` (screens).
