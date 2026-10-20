# Frontend Spec — Group-Buy Agent

Spec: `PRD.md` · Dates: `PHASES.md` (Phase 3, Oct 31–Nov 4)

## Principles
- **Demo-first.** Each screen reads clearly in a screen recording: big number, one primary action.
- **The progress bar is the hero.** "18 of 20 buyers" is always the largest thing on the deal page.
- **Money state always visible.** Per buyer: *Held $160 → Charged $150* or *Held → Released*.
- **Show the agents working.** Negotiation streams in as chat bubbles.
- No login, no settings. Role switcher: Buyer · Seller.

## Stack
| Piece | Choice |
|---|---|
| Framework | Next.js (App Router) + React |
| Styling | Tailwind CSS |
| Tables | **AG Grid Community** (seller dashboard, audit trail) — sponsor prize |
| PayPal | v6 Web SDK, `<paypal-button>`, order created with `intent: AUTHORIZE`; page header `Cross-Origin-Opener-Policy: same-origin-allow-popups` |
| Data | `fetch` + polling every 2 s on the deal page |
| Hosting | Render |

## Routes
| Route | Screen | Who |
|---|---|---|
| `/` | Buyer chat ("What do you want, and your max price?") + open deals | Buyer |
| `/d/[id]` | Deal page (all stages) | All |
| `/seller` | Products (tiers, floor) + deals in AG Grid | Seller |
| `/d/[id]/audit` | Audit trail (AG Grid) | All |

`?demo=1` seeds a product and a "Run demo" button that adds simulated buyers.

## Deal page layout
```
┌──────────────────────────────────────────────────────────────┐
│ UX Design Course · list $200                                 │
│ ███████████████████████░░░░░  18 of 20 buyers  · 1d 4h left  │
│ Current best price: $150 (you save $50)                      │
├───────────────────────────────┬──────────────────────────────┤
│ Your hold                     │ Negotiation                  │
│  Held $160 · PayPal ID …      │  🛒 Pool: 20 buyers, $140?    │
│  [Leave deal]                 │  🏷 Seller: $155             │
│                               │  🛒 Pool: $150 and we close   │
│ Buyers (simulated labelled)   │  🏷 Seller: deal ✓           │
└───────────────────────────────┴──────────────────────────────┘
```
Mobile: negotiation moves below.

## Seller lists a product (`/seller`)
Buyers can only join products a seller has listed. Each product has a **single price** (buy alone, today) and **group prices** (cheaper as more buyers join).

```
┌─ Add product ────────────────────────────────────────────┐
│ Name         [Mechanical keyboard (75%)          ]       │
│ Description  [Compact 75%, hot-swap, wireless... ]       │
│ Single price [$150 ]   ← what one buyer pays alone       │
│ Group prices  Buyers  Price                              │
│              [10   ] [$130 ]  save 13%                   │
│              [30   ] [$115 ]  save 23%   [+ add tier]    │
│ Lowest price [$95  ]  🔒 never shown to buyers           │
│                                    [Cancel] [List it]    │
└──────────────────────────────────────────────────────────┘
```

| Field | Stored as | Rule (server rejects otherwise) |
|---|---|---|
| Name, description | `name`, `description` | Required. Description is what the agent matches buyers on, so make it specific. |
| Single price | `list_cents` | > 0. No buyer is ever held or charged more than this. |
| Group prices | `tiers: [{buyers, price_cents}]` | 1–3 rows. More buyers → lower price. Every price between lowest and single price. |
| Lowest price | `floor_cents` | > 0 and ≤ single price. Agents never close below it. **Seller-only**: never send to buyer pages or the model. |

- The first tier is a new deal's target ("10 buyers"). A deal opens when a buyer joins a product with no open deal.
- Edits apply to new deals only. Open deals keep the prices they opened with, so buyers who already joined see no change.
- Products list in AG Grid (sponsor prize); edit cells inline, the "Add product" form opens in a side panel. Show the live "save X%" next to each tier.
- Error messages say which rule failed, next to the field: "Group price $160 is above the single price $150."

### What buyers see for the same product
```
┌───────────────────────────────────────────┐
│ Mechanical keyboard (75%)        KeyLab   │
│ $150 alone                                │
│ $130 with 10 buyers · $115 with 30        │
│ ███░░░░░░░  3 of 10 joined · 2d left      │
│ [Join · hold up to $___]                  │
└───────────────────────────────────────────┘
```
The buyer enters the most they'd pay (prefilled with the first group price). PayPal holds that amount; at close they pay the group price, never more than their hold, or the hold is released.

## Main panel by status
| Status | Buyer sees | Seller sees |
|---|---|---|
| `OPEN` | Progress bar, PayPal button (if not joined) or "Held $160", Leave | Holds filling in the grid |
| `NEGOTIATING` | Streaming transcript | Same + their floor (never shown to buyers) |
| `CAPTURED` | "Charged $150 — saved $50", PayPal capture ID | 20 sales, total, IDs |
| `FAILED` / `EXPIRED` | "Deal didn't happen. Your $160 hold was released. You paid nothing." | Voided holds |

## Key components
- **Progress bar:** count + target, animates as buyers join.
- **Hold card:** amount held, status, PayPal ID; capture/void flashes when the webhook lands.
- **Negotiation bubble:** speaker, message, proposed price; invalid offers shown struck through with "rejected: below floor".
- **Seller grid (AG Grid):** buyer, max, hold status, captured amount, PayPal IDs; filter by status.

## API routes
| Method + path | Used by |
|---|---|
| `POST /api/intake` | Buyer chat → parsed request + matched deal |
| `GET /api/products` | Buyer product cards (no `floor_cents`) |
| `GET /api/seller/products` · `POST` · `PATCH /api/seller/products/[id]` | Seller grid + Add product (includes `floor_cents`) |
| `GET /api/deals[/id]` | Deal list, deal page |
| `POST /api/deals/[id]/order` · `POST …/authorize` | PayPal button (join) |
| `POST /api/deals/[id]/leave` | Buyer leaves → void |
| `GET /api/deals/[id]/events` | Audit trail |
| `POST /api/demo/buyers` | Run demo (simulated buyers) |
| `POST /api/paypal/webhook` | PayPal (not the UI) |

The server derives every status change and every amount; the UI never sets them.

## PayPal button wiring (v6, as in `spike/index.html`)
```js
const session = sdk.createPayPalOneTimePaymentSession({
  onApprove: () => post(`/api/deals/${id}/authorize`),
  onError:   () => showError('PayPal could not place the hold. Try again.'),
});
button.addEventListener('click', () =>
  // Don't await order creation before start(): it breaks the popup.
  session.start({ presentationMode: 'auto' }, post(`/api/deals/${id}/order`).then(o => ({ orderId: o.id }))));
```

## States
- Loading: skeletons. Errors: inline message + retry; PayPal errors show the debug ID.
- No deals: "No open deals — tell the agent what you want."

## Accessibility
Real `<button>`s, visible focus, progress bar with `role="progressbar"` and text, status in words not color alone.
