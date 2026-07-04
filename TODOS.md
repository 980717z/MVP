# TODOS

## P1 — Clover payment routes + integration/E2E tests (bundled)
**What:** The `/api/pay/*` routes (checkout, webhook, status, reconcile, sweep), `lib/clover.ts`, the dine-in phone-pay + tip UI, driver ETA + Resend receipt/notify emails — AND the two deferred test layers: Supabase-integration (RLS forged-insert rejection, payment-gate trigger, CAS idempotency against the real schema) + Playwright E2E (sandbox checkout flows). One test-infra + CI setup, done together.
**Why:** Turns on 扫码配送 / takeout online payment. The togo/delivery flow is already built and SHIPPED-BUT-HIDDEN behind `NEXT_PUBLIC_PAYMENTS_LIVE`; flipping that flag after these land activates it.
**Blocked by:** **Phase 0 Clover sandbox spike** (user creates a Clover developer sandbox account → verify CAD Hosted Checkout availability, webhook-vs-poll, tip-line tax, session TTL). Those answers reshape ~20% of the route design, so no payment code before the spike.
**Context:** Full reviewed plan (CEO 8/10 + eng-review, 3 adversarial rounds): ~/.gstack/projects/980717z-MVP/ceo-plans/2026-07-03-qr-delivery-clover-payments.md. Schema (supabase/orders-payment.sql), pricing (lib/tax.ts + 22 unit tests), togo UI, per-table QRs are DONE.
**Effort:** L (human ~1.5-2wk / CC ~4-6h) after the spike.

## P2 — Promo codes (优惠码) at checkout
**What:** Code field at menu checkout applying % or $ discounts (e.g. GRAND10, 首单9折), with a codes table, validation, redemption tracking, and a discount line in the pricing math.
**Why:** Marketing hook for the delivery launch and future campaigns (flyers, first-order incentives).
**Pros:** Reusable campaign engine; strongest promotional lever a restaurant has.
**Cons:** Touches every money line — interacts with the $30 delivery minimum (pre- or post-discount?), the 10% tip base, and HST. The riskiest math in the ordering system gets riskier; needs its own test round.
**Context:** Deferred by explicit decision (D10, /plan-ceo-review 2026-07-03) so the core Clover payment path ships and gets proven in production first. When picked up: discount applies to pre-tax subtotal; decide minimum-order interaction; tip stays 10% of post-discount subtotal; HST on discounted amount. See ~/.gstack/projects/980717z-MVP/ceo-plans/2026-07-03-qr-delivery-clover-payments.md.
**Effort:** M (human ~2d / CC ~45min) · **Depends on:** Clover payments Phase 1 shipped and stable.

## P3 — SMS notifications (revisit only if needed)
**What:** Twilio SMS for 订单确认 / 骑手已出发, replacing or supplementing the email notify.
**Why:** Diners who skip the optional email field get no proactive updates.
**Context:** Explicitly replaced by Resend email notifications (D9, 2026-07-03). Revisit only if post-launch data shows diners don't leave emails and 「饭到哪了」calls burden the kitchen. Requires Canadian sender-number registration (days of lead time) + per-message cost.
**Effort:** M (human ~2d / CC ~45min) · **Depends on:** delivery live; email-notify adoption measured.

## P1 — DB-level staff access[] enforcement (records RLS per-module)
**What:** Extend the `records` RLS policies so a member with restricted `access[]` can only read/write records of their allowed modules (function like `can_access_module(tenant_slug, module_id)`), instead of today's tenant-wide access.
**Why:** UI enforcement shipped (sidebar + module-page block, 2026-07-04), but a technical staff member could still query other modules' records (sales, payroll, member phones) directly via the API with their own token.
**Blocked by:** Order completion currently posts to sales/dish-margin/members records FROM THE STAFF CLIENT — under module-scoped RLS, a limited-access staffer completing an order would have those posts rejected. Move completion side-effects server-side first (the Clover webhook work does exactly this), then tighten RLS.
**Effort:** M (human ~1d / CC ~30min once posting is server-side).
