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

/** Minimal shape of an order line as stored in orders.items. */
type RoundItem = { id?: string; name_zh?: string; cancelled?: boolean; noKitchen?: boolean };
/** Minimal shape of the menu rows we look up by dish id. */
type NoCookLookup = Map<string, { name_zh: string; category?: string }>;

/**
 * Does this round have anything the kitchen actually cooks?
 *
 * A round of ONLY drinks / plain rice is claimed but never printed — 加一碗白饭
 * or a can of Coke doesn't belong on a kitchen ticket. It still shows on the bill.
 *
 * The stored `noKitchen` flag is a HINT, not the source of truth: it is stamped by
 * whichever surface wrote the order, and the back-office order editor didn't stamp
 * it at all. So when the dish is found in the current menu we re-derive from the
 * dish itself; the stored flag only decides lines whose dish is gone (deleted or
 * renamed away). `dishById` empty (menu lookup failed) → fall back to the flag,
 * which is the pre-existing behavior: prefer printing over losing a ticket.
 */
export function roundNeedsKitchen(
  items: RoundItem[] | null | undefined,
  dishById: NoCookLookup,
  isNoCook: (d: { name_zh: string; category?: string }) => boolean,
): boolean {
  const active = (items ?? []).filter((it) => !it.cancelled);
  if (active.length === 0) return false;
  return active.some((it) => {
    const dish = it.id ? dishById.get(it.id) : undefined;
    if (dish) return !isNoCook(dish);
    return !it.noKitchen;
  });
}
