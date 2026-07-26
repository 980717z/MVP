// ─────────────────────────────────────────────────────────────────────────
//  把一家在营店的真实配置倒导成模版 JSON（评审 E1）—— 自动匿名化（OV5）：
//    · delivery_fsas / hours / address → 占位符（书面授权红线）
//    · 桌号 → 通用 1..12（模版是店型骨架，不是这家店的复刻）
//    · 菜单 → 每分类抽样 N 道（默认 2，优先带多规格/时价的，保住全量形状）
//
//  用法: npx vite-node scripts/export-template.ts -- --slug fulai \
//          [--per-category 2] [--out templates/chinese-restaurant.json]
//  需要 .env.local（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）—— 只读公开数据。
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE_VERSION, validateTemplate, type TemplateMenuItem, type TenantTemplate } from "../lib/tenantTemplate";

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

// 手动读 .env.local（脚本不经过 Next 的 env 注入）
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("缺 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY（.env.local）"); process.exit(1); }
const db = createClient(url, key);

const slug = arg("slug", "fulai")!;
const perCat = Number(arg("per-category", "2"));
const out = arg("out", "templates/chinese-restaurant.json")!;

const { data: shop } = await db.from("storefront").select("cat_order").eq("slug", slug).maybeSingle();
const { data: items, error } = await db
  .from("menu_items")
  .select("name_zh, name_en, price, category, is_market, variants")
  .eq("tenant_slug", slug)
  .order("sort", { ascending: true });
if (error || !items) { console.error("菜单读取失败：", error?.message); process.exit(1); }

const catOrder: string[] = Array.isArray(shop?.cat_order) && shop!.cat_order.length > 0
  ? shop!.cat_order
  : [...new Set(items.map((i) => i.category).filter(Boolean))];

// 每分类抽样：优先带多规格的、其次时价的（保证模版承载全量形状），再补普通菜
const keyify = (zh: string, i: number) =>
  (zh.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "dish") + "-" + i;
const menu: TemplateMenuItem[] = [];
for (const cat of catOrder) {
  const inCat = items.filter((i) => i.category === cat);
  const ranked = [
    ...inCat.filter((i) => (i.variants?.length ?? 0) > 0),
    ...inCat.filter((i) => i.is_market && !(i.variants?.length > 0)),
    ...inCat.filter((i) => !i.is_market && !(i.variants?.length > 0)),
  ].slice(0, perCat);
  for (const d of ranked) {
    menu.push({
      key: keyify(d.name_zh, menu.length),
      name_zh: d.name_zh,
      name_en: d.name_en || undefined,
      price: d.is_market ? null : d.price != null ? Number(d.price) : null,
      category: cat,
      is_market: d.is_market || undefined,
      variants: (d.variants?.length ?? 0) > 0
        ? d.variants.map((v: any) => ({ label_zh: v.label_zh, label_en: v.label_en || undefined, price: Number(v.price) }))
        : undefined,
    });
  }
}

const template: TenantTemplate = {
  version: TEMPLATE_VERSION,
  type: "chinese-restaurant",
  label: { zh: "中餐馆（堂食 + 外卖）", en: "Chinese restaurant (dine-in + takeout)" },
  modules: ["menu-generator", "qr-menu", "online-orders"],
  // 匿名化：通用桌号骨架，不是源店的桌位复刻
  tables: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  categories: catOrder,
  // 匿名化占位符 —— 开店时在配送范围地图上按实际情况点选
  delivery_fsas: ["M5T"],
  hours: "11:00-22:00",
  menu,
};

const v = validateTemplate(template);
if (!v.ok) { console.error(`导出结果没过校验：\n- ${v.errors.join("\n- ")}`); process.exit(1); }
writeFileSync(out, JSON.stringify(template, null, 2) + "\n");
console.log(`✓ ${out} — ${catOrder.length} 分类 · ${menu.length} 道示例菜（源菜单 ${items.length} 道，每分类抽样 ${perCat}）`);
console.log(`  匿名化：配送区/营业时间为占位符，桌号为通用骨架。`);
