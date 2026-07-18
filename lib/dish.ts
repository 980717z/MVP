// ─────────────────────────────────────────────────────────────────────────
//  Pure dish helpers — naming, pricing, and kitchen-routing rules for a single
//  menu item. ZERO imports on purpose: the pickup order route runs server-side
//  and must not pull in lib/menu (which builds the browser Supabase client).
//  lib/menu re-exports these, so the menu page's imports are unchanged.
//
//  These are the rules the SERVER re-applies when it rebuilds a submitted order
//  from menu_items. The client computes the same values for display; the server
//  never trusts them.
// ─────────────────────────────────────────────────────────────────────────

/** A size/portion option for a dish (多规格): 全/半, 位/小/中/大/特大, etc. */
export interface VariantLike {
  label_zh: string;
  label_en?: string;
  price: number;
}

/** Structural shape of a dish — satisfied by MenuItem and by a raw menu_items
 *  row, so both the client and the server route can use these helpers. */
export interface DishLike {
  name_zh: string;
  name_en?: string;
  price?: number | null;
  variants?: VariantLike[] | null;
  category?: string;
  is_market?: boolean;
}

/** Display name with the size baked in, so kitchen ticket / receipt / ledger all
 *  read "红烧蟹肉翅（中）". The server rebuilds names with this rather than
 *  trusting the client — a crafted request must not print an arbitrary name. */
export function lineName(d: DishLike, v: VariantLike | null, en = false): string {
  return en
    ? v ? `${d.name_en || d.name_zh} (${v.label_en || v.label_zh})` : d.name_en || d.name_zh
    : v ? `${d.name_zh}（${v.label_zh}）` : d.name_zh;
}

/** Dishes the kitchen doesn't cook (drinks / plain rice). A round that is ALL
 *  no-cook skips the kitchen ticket but still prints on the bill. Derived from
 *  the dish, never from a client-sent flag. */
export function isNoCookDish(d: DishLike): boolean {
  return d.category === "酒水饮品" || /^白\s*米?\s*饭$/.test((d.name_zh || "").trim());
}

/** Unit price for a cart entry: the chosen variant's price, else the base price. */
export function unitPrice(d: DishLike, vi: number | null): number {
  if (vi != null && d.variants?.[vi]) return Number(d.variants[vi].price) || 0;
  return Number(d.price) || 0;
}
