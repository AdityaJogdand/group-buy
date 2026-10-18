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
