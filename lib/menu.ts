// ─────────────────────────────────────────────────────────────────────────
//  菜单设置 data layer — talks to the dedicated `menu_items` table and the
//  `menu-images` storage bucket (see supabase/menu.sql).
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

/** A size/portion option for a dish (多规格): 全/半, 位/小/中/大/特大, etc. */
export interface Variant {
  label_zh: string;
  label_en?: string;
  price: number;
}

export interface MenuItem {
  id: string;
  tenant_slug: string;
  name_zh: string;
  name_en: string;
  price: number | null;
  /** Market-priced (时价): gold tag on the menu; owner sets today's price from
   *  the 今日时价 panel. No price set → dish can't be added to the cart. */
  is_market: boolean;
  /** When non-empty, the dish is multi-size: `price` is ignored and the diner
   *  picks one of these. Empty/absent = single-price dish (uses `price`). */
  variants: Variant[];
  category: string;
  image_url: string;
  sort: number;
  created_at: string;
}

/** Read/display: only complete, valid sizes (label + positive price). */
export function normVariants(raw: any): Variant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => ({
      label_zh: String(v?.label_zh ?? "").trim(),
      label_en: String(v?.label_en ?? "").trim() || undefined,
      price: Number(v?.price) || 0,
    }))
    .filter((v) => v.label_zh && v.price > 0);
}

/** Write: keep every row (even half-typed) so the editor doesn't lose them
 *  mid-edit; coerce price to a number. Empty rows are filtered on read. */
function coerceVariants(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => ({
    label_zh: String(v?.label_zh ?? ""),
    label_en: String(v?.label_en ?? ""),
    price: v?.price === "" || v?.price == null ? 0 : Number(v.price) || 0,
  }));
}

/** English names for the standard menu categories (category values are stored
 *  in Chinese in menu data). Unknown categories fall back to the Chinese name. */
export const CATEGORY_EN: Record<string, string> = {
  招牌精选: "Signatures",
  滋补菜式: "Nourishing",
  火锅: "Hot Pot",
  火锅配菜: "Hot Pot Sides",
  海鲜: "Seafood",
  汤羹: "Soups",
  头盘: "Appetizers",
  蔬菜豆腐: "Veggie & Tofu",
  猪肉牛肉: "Pork & Beef",
  鸡鸭: "Chicken & Duck",
  铁板煲仔: "Sizzling & Clay Pot",
  芙蓉蛋: "Egg Foo Young",
  炒粉面: "Fried Noodles",
  煲仔饭: "Clay Pot Rice",
  饭类: "Rice",
  炒饭: "Fried Rice",
  汤粉面: "Noodle Soup",
  粥类: "Congee",
  酒水饮品: "Drinks",
};

/** Category label in the requested language. */
export function catLabel(category: string, lang: "zh" | "en"): string {
  return lang === "en" ? CATEGORY_EN[category] ?? category : category;
}

/** The price to show on the dish row: the min variant price ("起"), else `price`. */
export function displayPrice(d: MenuItem): number | null {
  if (d.variants?.length) return Math.min(...d.variants.map((v) => v.price));
  return d.price;
}

/** Variants at ONE price = a "choose one" dish（如 菠菜/唐生菜 二选一），
 *  not sizes: show the plain price (no 起) and a 选择 button (not 选规格). */
export function isChoiceDish(d: MenuItem): boolean {
  const vs = d.variants ?? [];
  return vs.length > 1 && new Set(vs.map((v) => Number(v.price))).size === 1;
}

/** Cart key: dish id for single-price, `id#variantIndex` for a chosen size. */
export function cartKey(id: string, vi: number | null | undefined): string {
  return vi == null ? id : `${id}#${vi}`;
}
export function parseCartKey(key: string): { id: string; vi: number | null } {
  const i = key.indexOf("#");
  return i < 0 ? { id: key, vi: null } : { id: key.slice(0, i), vi: Number(key.slice(i + 1)) };
}
/** Unit price for a cart entry (variant price when a size is chosen, else base). */
export function unitPrice(d: MenuItem, vi: number | null): number {
  if (vi != null && d.variants?.[vi]) return Number(d.variants[vi].price) || 0;
  return Number(d.price) || 0;
}
/** Total for a cart, resolving each key's dish + variant. Pure — unit-tested. */
export function cartTotal(cart: Record<string, number>, byId: Record<string, MenuItem>): number {
  let sum = 0;
  for (const [key, qty] of Object.entries(cart)) {
    const { id, vi } = parseCartKey(key);
    const d = byId[id];
    if (!d) continue;
    sum += unitPrice(d, vi) * qty;
  }
  return Math.round(sum * 100) / 100;
}

export async function listMenuItems(slug: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listMenuItems", error);
    return [];
  }
  return (data ?? []).map((r: any) => ({ ...r, variants: normVariants(r.variants) })) as MenuItem[];
}

/** Editor read: keep variant rows exactly as stored (even half-typed), so the
 *  menu editor doesn't drop a size the moment you add it. The customer menu uses
 *  the filtering listMenuItems instead. */
export async function listMenuItemsRaw(slug: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listMenuItemsRaw", error);
    return [];
  }
  return (data ?? []).map((r: any) => ({ ...r, variants: Array.isArray(r.variants) ? r.variants : [] })) as MenuItem[];
}

export async function addMenuItem(
  slug: string,
  item: { name_zh: string; name_en?: string; price?: string | number | null; category?: string; image_url?: string; variants?: Variant[] }
): Promise<{ error?: string }> {
  const price =
    item.price === "" || item.price === undefined || item.price === null
      ? null
      : Number(item.price);
  const { error } = await supabase.from("menu_items").insert({
    tenant_slug: slug,
    name_zh: item.name_zh,
    name_en: item.name_en ?? "",
    price,
    variants: coerceVariants(item.variants),
    category: item.category ?? "",
    image_url: item.image_url ?? "",
  });
  if (error) {
    console.error("addMenuItem", error);
    return { error: error.message };
  }
  return {};
}

export async function updateMenuItem(
  id: string,
  patch: Partial<Pick<MenuItem, "name_zh" | "name_en" | "price" | "category" | "image_url" | "variants" | "is_market">>
): Promise<{ error?: string }> {
  const clean: Record<string, any> = { ...patch };
  if ("price" in clean) {
    const p = clean.price;
    clean.price = p === "" || p === null || p === undefined ? null : Number(p);
  }
  if ("variants" in clean) clean.variants = coerceVariants(clean.variants);
  const { error } = await supabase.from("menu_items").update(clean).eq("id", id);
  if (error) {
    console.error("updateMenuItem", error);
    return { error: error.message };
  }
  return {};
}

// ── category order ─────────────────────────────────────────────────────────

/** Read a tenant's custom category order (public-safe via storefront view). */
export async function getCatOrder(slug: string): Promise<string[]> {
  const { data } = await supabase.from("storefront").select("cat_order").eq("slug", slug).maybeSingle();
  const v = (data as any)?.cat_order;
  return Array.isArray(v) ? v : [];
}

export async function saveCatOrder(slug: string, order: string[]): Promise<void> {
  const { error } = await supabase.from("tenants").update({ cat_order: order }).eq("slug", slug);
  if (error) console.error("saveCatOrder", error);
}

/** Order the present categories: custom order first, then the fallback order. */
export function orderedCategories(present: string[], catOrder: string[], fallback: string[]): string[] {
  const rank = (c: string) => {
    const i = catOrder.indexOf(c);
    if (i >= 0) return i;
    const j = fallback.indexOf(c);
    return 1000 + (j < 0 ? 999 : j);
  };
  return [...present].sort((a, b) => rank(a) - rank(b));
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) console.error("deleteMenuItem", error);
}

/** Upload a dish image to the tenant's folder; returns its public URL. */
export async function uploadMenuImage(slug: string, file: File): Promise<{ url?: string; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("menu-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("uploadMenuImage", error);
    return { error: error.message };
  }
  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return { url: data.publicUrl };
}
