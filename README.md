# Group Buy

**Every buyer lowers the price. Pay together, or not at all.**

Strangers pool together for a seller's bulk price. PayPal **holds** each buyer's max (an authorization, not a charge). At the deadline every hold is **captured once at the same group price**, never more than what the buyer approved, or **voided** if the group falls short. Nobody is out of pocket for a deal that didn't happen.

Built for the PayPal AI Hackathon 2026.

- **Live demo:** https://group-buy-web.onrender.com
- **Seller dashboard:** https://group-buy-web.onrender.com/seller
- **MCP endpoint (for Claude):** `https://group-buy-api-4ai9.onrender.com/mcp`
- **Video:** https://youtu.be/-ivc9QVq4es

> Sandbox only. No real money moves. The free hosting sleeps after 15 minutes idle, so the first request can take up to a minute.

## Try it

**As a buyer**
1. Open the live demo → **Groups** → **Join** on any product, enter the most you'd pay.
2. Approve the hold on PayPal's sandbox page with a sandbox buyer account:
   - email: `_add sandbox buyer email_`
   - password: `_add sandbox buyer password_`
3. You land on **You're in**: PayPal is holding your max; nothing is charged.

Or tap **✦ Ask AI** and type what you want, e.g. _"noise-cancelling headphones, up to $320"_.

**As a seller**
Open `/seller`: list a product with a single price, up to three group prices and a private lowest price; watch groups fill; press **Close now** to settle a group immediately (the negotiation runs, then PayPal captures or voids).

**From Claude**
```
claude mcp add --transport http group-buy https://group-buy-api-4ai9.onrender.com/mcp
```
Then ask Claude for what you want. Tools: `find_deal`, `join_deal`, `deal_status`, `leave_deal`. You approve every hold yourself in PayPal.

## How it works

| Step | What happens | PayPal call |
|---|---|---|
| Join | Order for the buyer's max with `intent: AUTHORIZE` | `POST /v2/checkout/orders` |
| Approve | Buyer approves; we authorize the hold | `POST /v2/checkout/orders/{id}/authorize` |
| Close, group reached a tier | Negotiation (below), then every covering hold is captured at one price with `final_capture: true`; holds below it are voided | `POST /v2/payments/authorizations/{id}/capture` |
| Close, no tier / leave | Hold voided, nothing charged | `POST /v2/payments/authorizations/{id}/void` |

Every authorize, capture and void carries a `PayPal-Request-Id` built from PayPal's own IDs, so retries after a crash never charge twice.

### The AI

- **Intake agent:** turns free text into `{product, max, deadline}` with a strict JSON schema, asking one follow-up when unsure. Powers **Ask AI**.
- **Negotiation agents:** when a group closes, buyers whose max is below the earned tier price would be released. The **buyers' agent** argues for a lower price that keeps them in; the **seller's agent** weighs the extra sales against a private floor it never reveals. The transcript is shown on the seller dashboard.
- **Code referee:** the model only proposes; code decides. Price must stay within `[floor, earned tier]`, the seller can only come down and the buyers only go up, at most 4 rounds, invalid moves are rejected and logged. No agreement means the seller's last valid offer. Buyers can only pay the same or less than without negotiation.
- **MCP server:** Claude (or any MCP client) can find, join, check and leave groups.

The floor price never reaches buyers, the public API or the buyers' agent. Buyer text is treated as data, not instructions.

Model: `openai/gpt-oss-120b` on Groq (any OpenAI-compatible endpoint works).

## Architecture

```
web/  Next.js 16 (App Router), Tailwind, AG Grid  ──/api/*──►  server.ts  FastMCP + Hono (Node 24)
      landing · /listed-product · /seller · /joined                ├─ /mcp            MCP tools
                                                                    ├─ /api/*          website + seller API
                                                                    └─ /paypal/return  approval return
lib/deals.ts      money path: holds, capture, void, settle, product rules (SQLite, node:sqlite)
lib/negotiate.ts  pool vs seller agents + code referee
lib/intake.ts     free text → request          lib/grouping.ts  join an open deal or open one
lib/paypal.ts     PayPal REST (sandbox)        lib/clock.ts     settles due deals; demo clock
```

## Run locally

Requires Node 24 and Bun.

```
cp .env.example .env          # fill in sandbox + LLM keys
npm install && npm run server # backend on :3000
cd web && bun install && bun dev   # site on :3001
```

## Tests

All money tests run against the real PayPal sandbox; simulated buyers approve through PayPal's checkout page with Playwright.

| Command | Checks |
|---|---|
| `npm run test:money` | authorize → capture at a lower price, drop-outs, void |
| `npm run test:autoclose` | at the deadline, capture at the reached tier, else void |
| `npm run test:clock` | expired group voids every hold |
| `npm run test:negotiate` | referee rules, plus a live agent negotiation |
| `npm run test:negotiate:paypal` | agents agree a price; PayPal captures every buyer at it |
| `npm run test:mcp` | MCP tools and website API end to end |
| `npm run test:seller` | product rules, floor stays private, edits never change open groups |
| `npm run test:intake` / `test:grouping` | free-text parsing; grouping |

## Limits

- Sandbox only; no buyer accounts (a hold is labelled with the name the buyer types).
- PayPal webhooks are not wired yet; the return page authorizes the hold.
- The free host wipes the database on redeploy; products reseed on boot.
- Seller dashboard uses one shared key (`SELLER_KEY`), not per-seller logins.

## License

MIT. See [LICENSE](LICENSE).
