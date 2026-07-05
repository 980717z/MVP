import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────
//  Delivery zone = a whitelist of postal FSAs (first 3 chars, e.g. "M5T")
//  stored per-tenant in tenants.delivery_fsas (jsonb string array).
//  Owner edits it on a map (DeliveryZoneEditor); the public menu reads it
//  through the anon `storefront` view (supabase/delivery-zone.sql) and
//  validates the customer's postal code before checkout.
// ─────────────────────────────────────────────────────────────────────────

/** Neighbourhood labels for Toronto FSAs — shown on the map + zone chips.
 *  Codes without a label just show the FSA itself. */
export const FSA_NAMES: Record<string, { zh: string; en: string }> = {
  M4E: { zh: "海滩区", en: "The Beaches" },
  M4K: { zh: "河谷区 · 希腊城", en: "Riverdale / Danforth" },
  M4L: { zh: "东湖滨", en: "India Bazaar / East End" },
  M4M: { zh: "莱斯利维尔", en: "Leslieville" },
  M4N: { zh: "劳伦斯公园", en: "Lawrence Park" },
  M4P: { zh: "戴维斯维尔北", en: "Davisville North" },
  M4R: { zh: "北多伦多", en: "North Toronto" },
  M4S: { zh: "戴维斯维尔", en: "Davisville" },
  M4T: { zh: "摩尔公园", en: "Moore Park" },
  M4V: { zh: "夏山 · 南山", en: "Summerhill" },
  M4W: { zh: "玫瑰谷", en: "Rosedale" },
  M4X: { zh: "卷心菜镇", en: "Cabbagetown" },
  M4Y: { zh: "教堂街", en: "Church-Wellesley" },
  M5A: { zh: "摄政公园 · 酿酒区", en: "Regent Park / Distillery" },
  M5B: { zh: "花园区 · 央街东", en: "Garden District" },
  M5C: { zh: "圣劳伦斯", en: "St. Lawrence" },
  M5E: { zh: "湖滨东", en: "Berczy Park" },
  M5G: { zh: "医院区", en: "Discovery District" },
  M5H: { zh: "金融区", en: "Financial District" },
  M5J: { zh: "湖滨 · 联合车站", en: "Harbourfront / Union" },
  M5K: { zh: "金融区（TD 中心）", en: "TD Centre" },
  M5L: { zh: "金融区（商业阁）", en: "Commerce Court" },
  M5M: { zh: "贝德福德公园", en: "Bedford Park" },
  M5N: { zh: "罗斯劳恩", en: "Roselawn" },
  M5P: { zh: "森林山", en: "Forest Hill" },
  M5R: { zh: "安尼克斯", en: "The Annex" },
  M5S: { zh: "多大校区", en: "U of T / Harbord" },
  M5T: { zh: "唐人街 · 肯辛顿", en: "Chinatown / Kensington" },
  M5V: { zh: "娱乐区 · CityPlace", en: "Entertainment / CityPlace" },
  M5X: { zh: "第一加拿大广场", en: "First Canadian Place" },
  M6G: { zh: "克里斯蒂", en: "Christie / Palmerston" },
  M6H: { zh: "达弗林林地", en: "Dufferin Grove" },
  M6J: { zh: "三一贝尔伍兹", en: "Trinity-Bellwoods" },
  M6K: { zh: "帕克代尔 · 自由村", en: "Parkdale / Liberty Village" },
  M6P: { zh: "高地公园 · 枢纽区", en: "High Park / Junction" },
  M6R: { zh: "朗塞斯瓦勒斯", en: "Roncesvalles" },
  M6S: { zh: "斯旺西 · 西布洛尔", en: "Swansea / Bloor West" },
};

/** Human label for one FSA: "M5T 唐人街 · 肯辛顿" (falls back to bare code). */
export function fsaLabel(fsa: string, lang: "zh" | "en" = "zh"): string {
  const n = FSA_NAMES[fsa.toUpperCase()];
  return n ? `${fsa.toUpperCase()} ${n[lang]}` : fsa.toUpperCase();
}

function asFsaList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const list = v.map((x) => String(x).toUpperCase()).filter((x) => /^[A-Z]\d[A-Z]$/.test(x));
  return list.length > 0 ? list : null;
}

/** Owner-side read (RLS: owner sees own tenant row). */
export async function getDeliveryFsas(slug: string): Promise<string[] | null> {
  const { data } = await supabase.from("tenants").select("delivery_fsas").eq("slug", slug).maybeSingle();
  return asFsaList(data?.delivery_fsas);
}

/** Owner-side write. Returns {error} for UI surfacing. */
export async function saveDeliveryFsas(slug: string, fsas: string[]): Promise<{ error?: string }> {
  const clean = Array.from(new Set(fsas.map((f) => f.toUpperCase()))).sort();
  const { error } = await supabase.from("tenants").update({ delivery_fsas: clean }).eq("slug", slug);
  return error ? { error: error.message } : {};
}

/** Public (anon) read via the storefront view — used by the customer menu.
 *  Returns null when the view predates delivery-zone.sql or the list is empty,
 *  so callers can fall back to a sensible default. */
export function publicDeliveryFsas(storefrontRow: any): string[] | null {
  return asFsaList(storefrontRow?.delivery_fsas);
}
