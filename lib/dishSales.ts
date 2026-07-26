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
  cost?: string | number | null;
  soldMonth?: string | number | null;
}

export interface RankedDish<T> {
  row: T;
  sold: number;
  revenue: number;
  cost: number;             // per-serving cost; 0 when not entered
  hasCost: boolean;         // true once a real cost (>0) is entered — gates margin/costPct display
  margin: number;           // price - cost, per serving
  marginPct: number | null; // margin / price; null when cost isn't entered or price is 0
  costPct: number | null;   // cost / price (食材成本率); null when cost isn't entered or price is 0
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
    .map((r) => {
      const price = n(r.price);
      const cost = n(r.cost);
      const hasCost = cost > 0;
      const margin = price - cost;
      const marginPct = hasCost && price > 0 ? margin / price : null;
      const costPct = hasCost && price > 0 ? cost / price : null;
      return { row: r, sold: n(r.soldMonth), revenue: price * n(r.soldMonth), cost, hasCost, margin, marginPct, costPct };
    })
    .sort((a, b) => b.sold - a.sold || b.revenue - a.revenue);
}

/** Highest revenue in the set, or 0 when nothing sold. The panel paints exactly
 *  one figure emerald; returning 0 for an all-zero month means the caller can
 *  guard on `> 0` and avoid decorating a $0 row as the winner. */
export function topRevenue<T>(ranked: RankedDish<T>[]): number {
  return ranked.reduce((m, d) => Math.max(m, d.revenue), 0);
}
