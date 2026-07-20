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

/** Read/display: keep complete sizes (label + positive price). For 时价 dishes
 *  pass allowPriceless=true — their variants are cooking-style/brand CHOICES
 *  (清蒸/姜葱/豉椒) with no fixed price; keep any labelled row.
 *
 *  LOAD-BEARING FOR CORRECTNESS, not just display. A cart entry references a
 *  size by INDEX (`id#vi`), and that index is into the FILTERED array. The menu
 *  editor deliberately stores half-typed rows (see coerceVariants), so raw and
 *  filtered arrays routinely differ:
 *
 *    raw       [ {小,0}, {大,12} ]        ← what menu_items stores
 *    filtered  [ {大,12} ]                ← what the diner picks from, vi=0
 *
 *  Index 0 means 大 to the client and 小 to anyone reading raw. Any server that
 *  resolves a client `vi` MUST normalize first or it charges/cooks the wrong
 *  row. Lives here (not lib/menu) so the pickup route can apply it without
 *  pulling in the browser Supabase client. */
export function normVariants(raw: unknown, allowPriceless = false): VariantLike[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => ({
      label_zh: String(v?.label_zh ?? "").trim(),
      label_en: String(v?.label_en ?? "").trim() || undefined,
      price: Number(v?.price) || 0,
    }))
    .filter((v) => v.label_zh && (allowPriceless || v.price > 0));
}

/** Apply normVariants to a dish using its own is_market flag — the exact
 *  transform listMenuItems does on the client. Server code resolving a client
 *  `vi` should pass the dish through this first. */
export function normDish<T extends DishLike>(d: T): T {
  return { ...d, variants: normVariants(d.variants, !!d.is_market) };
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

/** Unit price for a cart entry: the chosen variant's price, else the base price.
 *
 *  时价 (market) dishes are the exception. Their variants are COOKING STYLES
 *  (清蒸 / 姜葱 / 豉椒), not sizes, so they carry no price of their own — today's
 *  price lives on the dish and is set each morning from the 时价更新 panel. Without
 *  the fallback below, a market dish with cooking-style variants read as $0 no
 *  matter what the owner typed, so it kept showing 时价 on the menu and would have
 *  been charged as $0 on the bill. */
export function unitPrice(d: DishLike, vi: number | null): number {
  if (vi != null && d.variants?.[vi]) {
    const v = Number(d.variants[vi].price) || 0;
    if (v > 0) return v;
    if (d.is_market) return Number(d.price) || 0; // today's market price
    return 0;
  }
  return Number(d.price) || 0;
}
