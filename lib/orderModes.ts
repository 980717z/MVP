// ─────────────────────────────────────────────────────────────────────────
//  Order modes a vendor offers. ZERO imports so the customer menu, the admin
//  orders portal, and (later) the server can all resolve identically.
//
//  A campus food truck offers PICKUP only (the pickup flow carries both instant
//  ASAP and scheduled time). A sit-down restaurant offers everything. Stored on
//  tenants.order_modes (text[]); absent/empty → ALL (back-compat, so nothing
//  changes for existing tenants before the migration runs).
// ─────────────────────────────────────────────────────────────────────────

export type OrderMode = "dine" | "togo" | "delivery" | "pickup" | "market";

/** Every mode the app knows, in display order. */
export const ALL_ORDER_MODES: OrderMode[] = ["dine", "togo", "delivery", "pickup", "market"];

/** The modes a shop offers. Falls back to ALL when unset (pre-migration or a
 *  tenant that never configured it), so existing restaurants are unaffected.
 *  Order preserved; unknown values dropped; de-duped. */
export function resolveOrderModes(raw: unknown): OrderMode[] {
  const valid = Array.isArray(raw)
    ? raw.filter((m): m is OrderMode => (ALL_ORDER_MODES as string[]).includes(m as string))
    : [];
  const seen = new Set<OrderMode>();
  const out = valid.filter((m) => (seen.has(m) ? false : (seen.add(m), true)));
  return out.length ? out : [...ALL_ORDER_MODES];
}

/** Is this mode one the shop offers? Used to gate the customer `?m=` param and
 *  the admin order tabs. */
export function isModeAllowed(mode: OrderMode, offered: OrderMode[]): boolean {
  return offered.includes(mode);
}

/** Market-price (时价) dishes + tab only make sense when the shop offers the
 *  market mode. A campus truck (pickup only) has no seafood market price. */
export function offersMarket(offered: OrderMode[]): boolean {
  return offered.includes("market");
}
