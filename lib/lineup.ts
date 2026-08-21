// ─────────────────────────────────────────────────────────────────────────
//  Order line-up — the single time-ordered queue shown in the focus-mode rail.
//  Pure; only the Order type is imported.
//
//  ONE list across every channel (堂食 / 自取 / 外送 / 取餐). The kitchen fires in
//  time order regardless of how the order arrived, so a per-channel split would
//  make staff reassemble the real sequence in their head. The floor plan answers
//  "which TABLE is waiting"; this answers "which ORDER is next" — different
//  questions, no overlap.
// ─────────────────────────────────────────────────────────────────────────

import type { Order } from "./orders";

/** Still being worked on: not finished, not cancelled, not already collected. */
export function isInProgress(o: Order): boolean {
  if (o.status === "done" || o.status === "cancelled") return false;
  // A pickup order settles on picked_up_at even before its status catches up.
  if (o.order_type === "pickup" && o.picked_up_at) return false;
  return true;
}

/**
 * The queue: every in-progress order, OLDEST FIRST.
 *
 * Oldest-first is the whole point — the top of the list is what has been waiting
 * longest and should be fired next. A newest-first feed would bury the order
 * that's about to become a complaint.
 *
 * Ties (same timestamp, or an unparseable one) fall back to id so the order is
 * deterministic and rows don't shuffle between 8s polls.
 */
export function lineupOrders(orders: Order[]): Order[] {
  const at = (o: Order) => {
    const t = new Date(o.created_at).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  return orders
    .filter(isInProgress)
    .sort((a, b) => at(a) - at(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Where this order is going, for the rail's one-line destination. */
export function lineupDestination(o: Order): { icon: string; kind: "dine" | "togo" | "delivery" | "pickup" } {
  switch (o.order_type) {
    case "togo": return { icon: "📦", kind: "togo" };
    case "delivery": return { icon: "🚴", kind: "delivery" };
    case "pickup": return { icon: "🚚", kind: "pickup" };
    default: return { icon: "🍽", kind: "dine" };
  }
}
