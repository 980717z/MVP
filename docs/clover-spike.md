# Phase 0 — Clover sandbox spike (GATE before any payment code)

The 扫码配送 + payments architecture rests on four Clover assumptions. This spike
answers all four in a sandbox **before** we write `/api/pay/*` or the schema-
consuming code. If any answer differs from the assumption, the noted pivot applies.

Plan: `~/.gstack/projects/980717z-MVP/ceo-plans/2026-07-03-qr-delivery-clover-payments.md`

Do NOT touch production. Do NOT put real cards in. Sandbox only.

---

## 0. One-time setup (~15 min, needs your email)

1. Create a Clover **developer sandbox** account: https://sandbox.dev.clover.com/
   → sign up → this gives you a developer dashboard + a test merchant.
2. Dev dashboard → **Create App** (name it "BentoOS Dev"). Note the **App ID**.
3. App → **Ecommerce** settings → generate an **Ecommerce API token** for the
   test merchant (the "private token" / OAuth-less API key path). Note:
   - `CLOVER_ENV=sandbox`
   - `CLOVER_BASE=https://scl-sandbox.dev.clover.com`   (Ecommerce/HCO sandbox host)
   - `CLOVER_ECOMM_TOKEN=<token>`
   - `CLOVER_MERCHANT_ID=<test merchant id>`
4. Put those in `.env.local` (gitignored). Confirm the merchant's country is **CA**
   in the dashboard — if the sandbox only offers a US merchant, that itself is a
   partial answer to Q1 (flag it).

Sandbox test card: `4111 1111 1111 1111`, any future expiry, any CVV.

---

## Q1 — Does Canadian Hosted Checkout work at all? (the biggest unknown)

Create a Hosted Checkout session for a CAD amount:

```bash
source .env.local
curl -s -X POST "$CLOVER_BASE/invoicingcheckoutservice/v1/checkouts" \
  -H "Authorization: Bearer $CLOVER_ECOMM_TOKEN" \
  -H "X-Clover-Merchant-Id: $CLOVER_MERCHANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": { "email": "test@example.com" },
    "shoppingCart": {
      "lineItems": [
        { "name": "游水青斑火锅", "price": 6599, "unitQty": 1 },
        { "name": "HST 13%",     "price": 858,  "unitQty": 1 },
        { "name": "配送小费 10%",  "price": 660,  "unitQty": 1 }
      ]
    }
  }' | tee /tmp/hco.json
```
(Clover amounts are in **cents**. $65.99 → 6599.)

**RECORD:**
- HTTP status + whether a `href`/`checkoutSessionUrl` came back.
- Open that URL in a browser — does a CAD-denominated card page render? Pay with the
  test card. Does it succeed?

**DECISION:**
- ✅ Works → proceed to Q2, architecture stands.
- ❌ 4xx "not available in your region" / no CAD / merchant forced US →
  **PIVOT: drop Hosted Checkout, use the Clover iframe/SDK tokenization flow**
  (card tokenized client-side → server creates a charge). Re-plan the redirect
  step; the rest of the schema/gate design is unaffected.

---

## Q2 — How do we learn payment succeeded WITHOUT an installed app?

Phase 1 avoids OAuth/app-install. Two possible truths:

**A. Webhooks work with the ecommerce token.**
- Dev dashboard → App → **Webhooks** → set URL to a tunnel:
  `npx localtunnel --port 3100` (or ngrok) → `https://xxxx.loca.lt/api/pay/webhook`.
- Clover sends a **verification code** first (one-time handshake) — capture it,
  echo it back per the dashboard prompt. RECORD the exact header Clover signs with
  (expected: `X-Clover-Auth`) and whether a signing secret is issued.
- Pay a sandbox checkout → does a POST hit your tunnel within seconds? RECORD the
  payload shape (does it carry the checkout/order id + paid amount?).

**B. No push — polling only.**
- After paying, poll the session/charge:
  ```bash
  curl -s "$CLOVER_BASE/invoicingcheckoutservice/v1/checkouts/<id>" \
    -H "Authorization: Bearer $CLOVER_ECOMM_TOKEN" \
    -H "X-Clover-Merchant-Id: $CLOVER_MERCHANT_ID" | jq '.status,.paymentStatus'
  ```
- RECORD: does the status flip to paid, and how fast?

**DECISION:**
- Webhook fires → architecture stands (webhook primary, reconcile fallback).
- No webhook → **PIVOT: reconcile-polling is PRIMARY.** Drop the webhook endpoint
  from Phase 1; the return-URL `/api/pay/status` poller calls `/api/pay/reconcile`
  which queries Clover by checkout id. (This is already in the plan as the fallback
  — it just becomes the main path.)

---

## Q3 — Can a tip line be UNTAXED while food is taxed 13%?

Our receipt must show: food taxed at 13%, tip with **zero** tax. Check whether
Clover applies merchant-level auto-tax to the whole cart (which would double-tax,
since we pre-compute HST as its own line).

- In the Q1 cart above we sent HST and tip as **explicit line items** with the
  merchant's tax **disabled**. After paying, pull the resulting order/payment and
  RECORD the tax total Clover recorded.

**DECISION:**
- Charged total == our computed total (no extra tax added) → ✅ send explicit
  lines, keep merchant auto-tax OFF.
- Clover added its own tax on top → **PIVOT:** either disable merchant tax in
  settings, or send a single pre-computed total as one line item labelled
  「合计（含税）」so Clover can't re-tax. RECORD which one the sandbox requires.
- Note the `amount_mismatch` guard in the plan depends on this matching exactly.

---

## Q4 — Session TTL vs our 30-min order expiry

- From the Q1 response, RECORD any `expirationTime` / TTL on the checkout session.
- Leave a session unpaid; RECORD when the URL stops accepting payment.

**DECISION:**
- Set the order-expiry sweep to `min(session TTL, 30 min)` so we never show a live
  order with a dead pay link. If TTL < 30 min, the `pending+expired-session`
  branch in `/api/pay/checkout` (reconcile-then-new-session) is the common case,
  not an edge case — size the code accordingly.

---

## Deliverable: fill this in and we start Phase 1

```
Q1 CAD Hosted Checkout:   [ works / NOT available → iframe pivot ]   notes:
Q2 payment signal:        [ webhook works / poll-only → reconcile primary ]  header/secret:
Q3 tip untaxed:           [ explicit lines ok / must send single total ]     tax recorded:
Q4 session TTL:           ____ min   → order-expiry sweep set to ____ min
Env confirmed:            CLOVER_ENV, CLOVER_BASE, CLOVER_MERCHANT_ID, CLOVER_ECOMM_TOKEN in .env.local
```

Paste those four answers back and I'll build `lib/clover.ts` + the `/api/pay/*`
routes + the integration/E2E test layer against the shape the sandbox actually has —
no guessing, no rework.
