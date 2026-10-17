# Frontend Spec — Countersign

Spec: `PRD.md` · Dates: `PHASES.md` (Phase 3, Oct 31–Nov 4)

## Principles
- **Demo-first.** Each screen reads clearly in a screen recording: big status, one primary action.
- **One shared contract page.** A role switcher (Client · Freelancer · Reviewer) changes which actions appear.
- **Where the money is, always visible.** A money timeline at the top: *Not funded → Held (2d 14h left) → Captured → Paid to PayPal*.
- **Fairness is visible.** Both signatures, the review-window countdown and "appeal" are always on screen when relevant.
- No login, no settings.

## Stack
| Piece | Choice |
|---|---|
| Framework | Next.js (App Router) + React |
| Styling | Tailwind CSS |
| Tables | **AG Grid Community** (audit trail, reviewer queue) — sponsor prize |
| PayPal | JS SDK buttons, `intent=authorize`, `enable-funding=venmo` |
| Data | `fetch` + polling every 2 s on the contract page |
| Hosting | Render |

## Routes
| Route | Screen | Who |
|---|---|---|
| `/` | Contract list + "New contract" (+ `?demo=1` seeds Maya's logo contract) | All |
| `/new` | Brief form | Client |
| `/c/[id]` | Contract page (all stages) | All |
| `/c/[id]/audit` | Audit trail (AG Grid) | All |
| `/review` | Reviewer queue (AG Grid) | Reviewer |

Role stored in `localStorage` (try/catch, default Client).

## Contract page layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Maya · Ember logo · $400                                         │
│ Money: [Not funded]──[HELD · 2d 14h]──[Captured]──[Paid → PayPal] │  ← live from webhooks
├────────────────────────────────┬─────────────────────────────────┤
│ Main panel (by status)         │ Checklist                       │
│                                │  ✓ c1 Contains "Ember"     w3   │
│                                │  ✗ c4 Readable at 32 px    w2   │
│                                │ Signed: Client ✓  Maya ✓        │
│                                │ Timeline of events              │
└────────────────────────────────┴─────────────────────────────────┘
```
Mobile: the side column moves below the main panel.

## Main panel by status
| Status | Panel | Client | Freelancer | Reviewer |
|---|---|---|---|---|
| `PROPOSED` | Editable checklist (text, weight, code/vision tag) + rejected wishes with suggestions | Edit, Sign | Edit, Sign | — |
| `SIGNED` | Locked checklist + deadline + PayPal button | Fund | — | — |
| `FUNDED` | Hold countdown, deadline, upload zone | Cancel (void) | Upload | — |
| `VERIFYING` | Items tick one by one as results arrive | — | — | — |
| `VERDICT` | Release % with working, per-item results + evidence images, **watermarked previews**, review-window countdown | Request changes (pick failed items), Appeal | Appeal | — |
| `IN_APPEAL` | Both sides' reasons + evidence | — | — | Uphold / Change % (note required) |
| `SETTLED` | "Paid $380 to Maya's PayPal", PayPal IDs, **originals unlocked** | Download originals | — | — |
| `VOIDED` | "Hold voided. Client was not charged." + reason | — | — | — |

There's deliberately no "release less" control for the client. The only paths are request changes (limited) and appeal.

## Key components
**Result row with evidence**
```
✗  c4 · Readable at 32×32 px                          weight 2
   [original]  [32 px render]      ← evidence thumbnails, click to enlarge
   Reason: at 32 px the wordmark blurs into the cup icon.
   Fix: simplify to the icon, or thicken the letterforms.
```
- pass ✓ green, partial ◐ amber, fail ✗ red, unsure ? grey. Never color alone.

**Watermarked preview:** a diagonal "PREVIEW · Countersign" overlay at low resolution, served from the API; originals are only served after `SETTLED`.

**Money timeline:** four steps; the active one shows the hold countdown and its PayPal ID; webhook-driven updates flash briefly.

**Countdown:** the review window and the hold honor period. Demo mode shows "(demo: 60 s)".

## API routes
| Method + path | Used by |
|---|---|
| `POST /api/contracts` · `GET /api/contracts[/id]` | Brief form, list, contract page |
| `PATCH /api/contracts/[id]/checklist` · `POST …/sign` | Checklist edit and signing |
| `POST …/paypal/order` · `POST …/paypal/authorize` | PayPal buttons |
| `POST …/submissions` (multipart) | Upload |
| `GET …/files/[fileId]?preview=1` | Watermarked preview / original after settle |
| `POST …/changes` · `POST …/appeal` · `POST …/cancel` | Client and freelancer actions |
| `POST …/review` | Reviewer decision |
| `GET …/events` | Audit trail |
| `POST /api/paypal/webhook` | PayPal (not the UI) |

The server derives every status change; the UI never sets status.

## PayPal button wiring
```js
paypal.Buttons({
  createOrder: () => post(`/api/contracts/${id}/paypal/order`).then(r => r.orderId),
  onApprove:   () => post(`/api/contracts/${id}/paypal/authorize`),
  onError:     () => showError('PayPal could not place the hold. Try again.'),
}).render('#paypal');
```

## States
- Loading: skeletons (except `VERIFYING`, which shows live progress).
- Errors: inline message + retry; PayPal errors show the debug ID.
- Empty list: "No contracts yet" + "New contract" + "Load demo".

## Accessibility
Real `<button>`s, visible focus, keyboard-reachable upload (a normal file input underneath), icons + text for results, alt text on evidence images.
