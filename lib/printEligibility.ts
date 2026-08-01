// Which unprinted orders the kitchen printer may pick up, by tenant payment model.
// Returns a PostgREST .or() filter string, or null for "no payment gate at all".
//
// order_only (the default — 富来 and every campus truck): the shop has NO online
// payment anywhere. Togo/delivery orders are confirmed by phone callback and
// settled at handover, exactly like dine-in settles at checkout. They are unpaid
// BY DESIGN, so every order type is print-eligible the moment it lands. The
// status layer got this same rule in supabase/payment-gate-order-only.sql; this
// is the print layer's half. (Previously only 'pickup' was exempted here, so
// 自取/配送 kitchen tickets never printed — payment_status never becomes 'paid'
// in a shop with no online payment.)
//
// pay_first: togo/delivery/pickup print only once payment_status='paid' —
// pay-first online ordering, where an unpaid ticket reaching the kitchen means
// giving away food. Dine-in always prints; it settles at checkout.
export function printEligibilityOr(paymentMode: string | null | undefined): string | null {
  const orderOnly = !paymentMode || paymentMode === "order_only";
  return orderOnly ? null : "order_type.eq.dine_in,payment_status.eq.paid";
}
