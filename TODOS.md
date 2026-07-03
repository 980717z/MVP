# TODOS

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
