// ─────────────────────────────────────────────────────────────────────────
//  TenantTemplate — 开店的唯一底层 schema（ONE schema, TWO frontends）
//
//  templates/*.json 描述一种"店型"：模块组合、桌号、分类、配送区、示例
//  菜单（全量形状：多规格/时价/图片）。两个消费者：
//    1. scripts/provision-sql.ts —— 生成可审查的 SQL（懂终端的运营者）
//    2. 未来的建店向导 UI（TODOS P2，等商家 #2）
//  设计文档: docs/designs/qr-gates-tenant-templates.md
//
//  约束：本文件零副作用 import（守卫测试和 SQL 生成脚本在无 env 环境跑）。
// ─────────────────────────────────────────────────────────────────────────

import { MODULES } from "./catalog";
import { SLUG_PATTERN, isValidSlug } from "./qrContract";

export const TEMPLATE_VERSION = 1;

/** 模版菜条 —— 全量菜单形状（eng OV5：不降级，variants/时价/图片都承载） */
export interface TemplateMenuItem {
  /** 幂等键：同租户内唯一，重跑 provision 时按它 upsert（qr-lock.sql 唯一索引） */
  key: string;
  name_zh: string;
  name_en?: string;
  /** null/缺省 + is_market=true = 时价菜 */
  price?: number | null;
  category: string;
  is_market?: boolean;
  variants?: { label_zh: string; label_en?: string; price: number }[];
  image_url?: string;
}

export interface TenantTemplate {
  version: typeof TEMPLATE_VERSION;
  /** 店型标识，如 "chinese-restaurant" / "counter-service" */
  type: string;
  label: { zh: string; en: string };
  /** 预选模块（lib/catalog.ts 的 id） */
  modules: string[];
  /** 桌号（自取小店型为空数组 —— 合法） */
  tables: string[];
  /** 菜单分类（顾客端左栏顺序） */
  categories: string[];
  /** 配送区 FSA 白名单（无配送则空） */
  delivery_fsas: string[];
  hours?: string;
  menu: TemplateMenuItem[];
}

const FSA_RE = /^[A-Z]\d[A-Z]$/;
const MODULE_IDS = new Set(MODULES.map((m) => m.id));

/** 校验模版；返回全部问题（不是遇错即停 —— 修一轮就能修完） */
export function validateTemplate(t: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const tt = t as Partial<TenantTemplate> | null;
  if (!tt || typeof tt !== "object") return { ok: false, errors: ["模版不是对象"] };

  if (tt.version !== TEMPLATE_VERSION)
    errors.push(`未知模版版本 ${String(tt.version)}（当前支持 ${TEMPLATE_VERSION}）—— 需要迁移器`);
  if (!tt.type || !SLUG_PATTERN.test(tt.type)) errors.push("type 必须是 kebab-case 标识");
  if (!tt.label?.zh) errors.push("label.zh 缺失");

  if (!Array.isArray(tt.modules) || tt.modules.length === 0) errors.push("modules 至少一个");
  for (const m of tt.modules ?? [])
    if (!MODULE_IDS.has(m)) errors.push(`未知模块 id: ${m}（见 lib/catalog.ts）`);

  if (!Array.isArray(tt.tables)) errors.push("tables 必须是数组（自取小店可为空数组）");
  const tset = new Set(tt.tables ?? []);
  if (tset.size !== (tt.tables ?? []).length) errors.push("tables 有重复桌号");
  for (const label of tt.tables ?? [])
    if (!/^[A-Za-z0-9]{1,4}$/.test(label)) errors.push(`桌号 "${label}" 不合法（1-4 位字母数字）`);

  if (!Array.isArray(tt.categories) || tt.categories.length === 0) errors.push("categories 至少一个");
  if (new Set(tt.categories ?? []).size !== (tt.categories ?? []).length) errors.push("categories 有重复");

  for (const f of tt.delivery_fsas ?? [])
    if (!FSA_RE.test(f)) errors.push(`配送区 "${f}" 不是合法 FSA（如 M5T）`);

  const keys = new Set<string>();
  for (const [i, item] of (tt.menu ?? []).entries()) {
    const at = `menu[${i}]`;
    if (!item.key) errors.push(`${at} 缺 key（幂等键）`);
    else if (keys.has(item.key)) errors.push(`${at} key "${item.key}" 重复`);
    else keys.add(item.key);
    if (!item.name_zh) errors.push(`${at} 缺 name_zh`);
    if (item.category && !(tt.categories ?? []).includes(item.category))
      errors.push(`${at} 分类 "${item.category}" 不在 categories 里`);
    const hasVariants = (item.variants?.length ?? 0) > 0;
    if (!hasVariants && !item.is_market && !(Number(item.price) > 0))
      errors.push(`${at} "${item.name_zh}" 无价格：要么给 price，要么 is_market: true，要么给 variants`);
    for (const [j, v] of (item.variants ?? []).entries()) {
      if (!v.label_zh) errors.push(`${at}.variants[${j}] 缺 label_zh`);
      if (!(Number(v.price) > 0)) errors.push(`${at}.variants[${j}] price 必须 > 0`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** provision 目标（一家具体的店） */
export interface ProvisionTarget {
  slug: string;
  name_zh: string;
  name_en?: string;
  /** Supabase auth user uuid（店主账号；Supabase → Authentication 页可查） */
  owner_id: string;
  address?: string;
}

export function validateTarget(t: ProvisionTarget): string[] {
  const errors: string[] = [];
  const v = isValidSlug(t.slug);
  if (!v.ok) errors.push(v.reason === "reserved" ? `slug "${t.slug}" 是保留字（撞路由）` : `slug "${t.slug}" 格式不合法（^[a-z0-9-]{3,30}$）`);
  if (!t.name_zh) errors.push("name_zh 缺失");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.owner_id ?? ""))
    errors.push("owner_id 必须是 Supabase auth 用户 uuid");
  return errors;
}

// ── SQL 生成（eng 3A：全部字符串走 lit() 转义，防 Sang's 的单引号和恶意模版）──

/** SQL 字符串字面量：单引号翻倍，拒绝控制字符注入换行以外的花样 */
export function lit(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}
/** jsonb 字面量 */
export function litJsonb(v: unknown): string {
  return `${lit(JSON.stringify(v))}::jsonb`;
}
const litNum = (n: number | null | undefined) => (n === null || n === undefined ? "null" : Number(n).toString());

/**
 * 模版 + 目标 → 可审查、可重跑（幂等）的 SQL。
 * 生成的 SQL 本身就是 dry-run 预览（评审 E6）：先读一遍，再贴进
 * Supabase SQL Editor 执行。重跑安全：tenant 按 slug upsert，菜按
 * (tenant_slug, template_key) upsert（qr-lock.sql 的唯一索引）。
 */
export function buildProvisionSql(template: TenantTemplate, target: ProvisionTarget): string {
  const tv = validateTemplate(template);
  if (!tv.ok) throw new Error(`模版不合法:\n- ${tv.errors.join("\n- ")}`);
  const te = validateTarget(target);
  if (te.length > 0) throw new Error(`目标不合法:\n- ${te.join("\n- ")}`);

  const name = { zh: target.name_zh, en: target.name_en || target.name_zh };
  const lines: string[] = [];
  lines.push(`-- ============================================================`);
  lines.push(`-- Provision: ${target.name_zh} (${target.slug})`);
  lines.push(`-- 店型: ${template.label.zh} (${template.type}) · 模版 v${template.version}`);
  lines.push(`-- 生成自 scripts/provision-sql.ts —— 可重复执行（幂等）`);
  lines.push(`-- 将创建: ${template.tables.length} 个桌号 · ${template.modules.length} 个模块 · ${template.categories.length} 个分类 · ${template.delivery_fsas.length} 个配送区 · ${template.menu.length} 道菜`);
  lines.push(`-- ============================================================`);
  lines.push(``);
  lines.push(`insert into public.tenants (slug, name, industry, address, enabled, tables, delivery_fsas, cat_order, owner_id)`);
  lines.push(`values (`);
  lines.push(`  ${lit(target.slug)},`);
  lines.push(`  ${litJsonb(name)},`);
  lines.push(`  'restaurant',`);
  lines.push(`  ${lit(target.address ?? "")},`);
  lines.push(`  ${litJsonb(template.modules)},`);
  lines.push(`  ${litJsonb(template.tables)},`);
  lines.push(`  ${litJsonb(template.delivery_fsas)},`);
  lines.push(`  ${litJsonb(template.categories)},`);
  lines.push(`  ${lit(target.owner_id)}::uuid`);
  lines.push(`)`);
  lines.push(`on conflict (slug) do update set`);
  lines.push(`  enabled = excluded.enabled,`);
  lines.push(`  tables = excluded.tables,          -- 锁定后触发器会拦缩水，安全`);
  lines.push(`  delivery_fsas = excluded.delivery_fsas,`);
  lines.push(`  cat_order = excluded.cat_order;`);
  lines.push(``);
  lines.push(`-- 店主计入成员名册（roster UI）。members.name 与 role 均 NOT NULL，`);
  lines.push(`-- 店主 role = 'owner'，name 缺省用中文店名（无个人姓名可填时的安全默认）。`);
  lines.push(`insert into public.members (tenant_slug, member_id, name, role)`);
  lines.push(`select ${lit(target.slug)}, ${lit(target.owner_id)}::uuid, ${lit(target.name_zh)}, 'owner'`);
  lines.push(`where not exists (select 1 from public.members where tenant_slug = ${lit(target.slug)} and member_id = ${lit(target.owner_id)}::uuid);`);
  lines.push(``);
  if (template.menu.length > 0) {
    lines.push(`-- 菜单（按 template_key 幂等 upsert —— 重跑不会双倍菜）`);
    lines.push(`insert into public.menu_items (tenant_slug, name_zh, name_en, price, category, image_url, is_market, variants, template_key, sort)`);
    lines.push(`values`);
    const rows = template.menu.map((m, i) => {
      const variants = m.variants ?? [];
      return `  (${lit(target.slug)}, ${lit(m.name_zh)}, ${lit(m.name_en ?? "")}, ${litNum(m.is_market ? null : m.price ?? null)}, ${lit(m.category)}, ${lit(m.image_url ?? "")}, ${m.is_market ? "true" : "false"}, ${litJsonb(variants)}, ${lit(m.key)}, ${i})`;
    });
    lines.push(rows.join(",\n"));
    lines.push(`on conflict (tenant_slug, template_key) do update set`);
    lines.push(`  name_zh = excluded.name_zh, name_en = excluded.name_en, price = excluded.price,`);
    lines.push(`  category = excluded.category, image_url = excluded.image_url,`);
    lines.push(`  is_market = excluded.is_market, variants = excluded.variants, sort = excluded.sort;`);
    lines.push(``);
  }
  lines.push(`-- 验证`);
  lines.push(`select slug, jsonb_array_length(tables) as tables, jsonb_array_length(delivery_fsas) as fsas,`);
  lines.push(`       (select count(*) from public.menu_items where tenant_slug = ${lit(target.slug)}) as dishes`);
  lines.push(`  from public.tenants where slug = ${lit(target.slug)};`);
  return lines.join("\n") + "\n";
}
