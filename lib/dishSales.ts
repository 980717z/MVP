// ─────────────────────────────────────────────────────────────────────────
//  菜品销量 ranking — pure, so the ordering rules are testable without a DOM.
//  Extracted from DishSalesRanking during the 2026-07-20 design review, whose
//  headline finding was a ranking that silently hid the dishes it existed to
//  surface.
// ─────────────────────────────────────────────────────────────────────────

/** Just the fields the ranking reads; the real rows carry more. */
export interface SalesRow {
  id?: string;
  dish?: string;
  price?: string | number | null;
  soldMonth?: string | number | null;
}

export interface RankedDish<T> {
  row: T;
  sold: number;
  revenue: number;
}

const n = (v: unknown): number => parseFloat(String(v ?? "")) || 0;

/** Rank by quantity sold, descending. Ties break on revenue so that at equal
 *  counts the dish actually bringing in more money ranks higher.
 *
 *  Dishes that sold ZERO are ranked LAST — never filtered out. The module's
 *  stated pain is 「不知道哪些菜卖得好、哪些卖不动」, and the pre-review code ran
 *  `.filter(d => d.sold > 0)`, which removed precisely the dishes an owner is
 *  hunting for when they ask what to cut from the menu. */
export function rankDishes<T extends SalesRow>(rows: T[]): RankedDish<T>[] {
  return rows
    .map((r) => ({ row: r, sold: n(r.soldMonth), revenue: n(r.price) * n(r.soldMonth) }))
    .sort((a, b) => b.sold - a.sold || b.revenue - a.revenue);
}

/** Highest revenue in the set, or 0 when nothing sold. The panel paints exactly
 *  one figure emerald; returning 0 for an all-zero month means the caller can
 *  guard on `> 0` and avoid decorating a $0 row as the winner. */
export function topRevenue<T>(ranked: RankedDish<T>[]): number {
  return ranked.reduce((m, d) => Math.max(m, d.revenue), 0);
}
