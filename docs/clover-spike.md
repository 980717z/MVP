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

## Q4b — iframe tokenization + wallets (primary path per 2026-07-05 decision)

Decision update: **iframe/SDK tokenization is the primary integration**, not HCO
(synchronous charge result removes the webhook unknown; no redirect on mobile).
Verify in sandbox:
1. `clover.js` iframe card tokenization works for a **CA** merchant; token → server
   charge via Ecommerce API returns synchronous success/decline.
2. **Apple Pay / Google Pay**: does the CA ecommerce charge endpoint accept wallet
   tokens? What's the Apple Pay domain-registration flow in the Clover dashboard
   (apple-developer-merchantid-domain-association hosting on bentoos.io)?
3. Tip + tax as separate amounts on the charge (same as Q3, via API fields).
HCO (Q1) is now the FALLBACK — still record its answer for completeness.

## Q4 — Session TTL vs our 30-min order expiry

- From the Q1 response, RECORD any `expirationTime` / TTL on the checkout session.
- Leave a session unpaid; RECORD when the URL stops accepting payment.

**DECISION:**
- Set the order-expiry sweep to `min(session TTL, 30 min)` so we never show a live
  order with a dead pay link. If TTL < 30 min, the `pending+expired-session`
  branch in `/api/pay/checkout` (reconcile-then-new-session) is the common case,
  not an edge case — size the code accordingly.

---

## Deliverable — ANSWERED 2026-07-07 (sandbox, CA merchant, CAD)

```
Q1 CAD ecommerce:   ✅ WORKS. clv_ token (public key) → POST /v1/charges
                    (Bearer private key + X-Clover-Merchant-Id) charged 8117 cents
                    CAD, status:"succeeded", paid:true, approved_by_network. No US forcing.
Q2 payment signal:  ✅ SYNCHRONOUS. The charge HTTP-200 response IS the confirmation.
                    NO webhook, NO reconcile-poll needed. (This is why iframe > HCO.)
Q3 tip untaxed:     ✅ We send ONE total (food+HST+tip). Clover charges EXACTLY that,
                    adds nothing. We own the breakdown; Clover never re-taxes a charge.
Q4 session TTL:     ✅ MOOT — no session, charge is instant. Nothing to expire/sweep.
Decline shape:      TBD — both sandbox test cards approved; need the specific decline
                    trigger. Handle defensively (non-200 OR status!=succeeded = failed);
                    confirm exact trigger + body in the integration test.
```

### Confirmed endpoints
- **Tokenize (client, clover.js / iframe):** `POST https://token-sandbox.dev.clover.com/v1/tokens`
  header `apikey: <PUBLIC_KEY>`, body `{card:{number,exp_month,exp_year,cvv,brand}}` → `{id:"clv_…"}`. Single-use.
- **Charge (server):** `POST $CLOVER_BASE/v1/charges` header `Authorization: Bearer <PRIVATE_KEY>` +
  `X-Clover-Merchant-Id: <MID>`, body `{amount(cents),currency:"cad",source:"clv_…",ecomind:"ecom",description}`
  → `{id,status:"succeeded",paid,amount,currency,outcome,source:{last4,brand}}`.

### Architecture simplification (vs the original webhook/HCO plan)
The synchronous charge collapses the design: **drop `/api/pay/webhook`, `/api/pay/reconcile`,
session-TTL sweep**. New flow:
1. Order created `payment_status='unpaid'` (togo/delivery).
2. Client loads clover.js iframe (PUBLIC key) → customer enters card → iframe returns a `clv_` token.
3. Client POSTs `{orderId, token}` to `/api/pay/charge`.
4. Server **re-prices from DB items** (never trust client amount), charges Clover with the PRIVATE key,
   and on `succeeded` sets `payment_status='paid', paid_at=now()` — which is the DB gate that releases
   the order to the kitchen/printer.
5. Charge result returns synchronously → client shows success/decline.
Money settles to the merchant's own Clover MID; BentoOS never holds funds.
