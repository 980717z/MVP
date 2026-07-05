import { describe, expect, it } from "vitest";
import { buildProvisionSql, lit, litJsonb, validateTemplate, validateTarget, type TenantTemplate } from "./tenantTemplate";

const OWNER = "a1b2c3d4-1111-2222-3333-444455556666";

const T: TenantTemplate = {
  version: 1,
  type: "test-shop",
  label: { zh: "测试店型", en: "Test" },
  modules: ["qr-menu", "menu-generator", "online-orders"],
  tables: ["1", "2", "2A"],
  categories: ["招牌精选", "海鲜"],
  delivery_fsas: ["M5T", "M5V"],
  menu: [
    { key: "crab-rice", name_zh: "荷香笼仔蒸蟹饭", name_en: "Steamed Crab Rice", price: 99.99, category: "招牌精选" },
    { key: "market-fish", name_zh: "游水海斑", category: "海鲜", is_market: true },
    { key: "chicken-pot", name_zh: "大补走地鸡窝", category: "招牌精选", variants: [
      { label_zh: "全只", price: 65.99 }, { label_zh: "半只", price: 35.99 },
    ] },
  ],
};

describe("validateTemplate", () => {
  it("accepts a full-shape template (variants + market + priced)", () => {
    expect(validateTemplate(T)).toEqual({ ok: true, errors: [] });
  });
  it("accepts empty tables (counter-service archetype)", () => {
    expect(validateTemplate({ ...T, tables: [], delivery_fsas: [] }).ok).toBe(true);
  });
  it("rejects unknown version — forces a migrator instead of guessing", () => {
    const r = validateTemplate({ ...T, version: 2 as any });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("未知模版版本");
  });
  it("rejects unknown module ids, duplicate tables/keys, orphan categories, priceless dishes", () => {
    const r = validateTemplate({
      ...T,
      modules: ["nope"],
      tables: ["1", "1"],
      menu: [
        { key: "a", name_zh: "菜A", category: "不存在的分类", price: 1 },
        { key: "a", name_zh: "菜B", category: "海鲜", price: 2 },
        { key: "c", name_zh: "无价菜", category: "海鲜" },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("未知模块");
    expect(r.errors.join()).toContain("重复桌号");
    expect(r.errors.join()).toContain('key "a" 重复');
    expect(r.errors.join()).toContain("不在 categories 里");
    expect(r.errors.join()).toContain("无价格");
  });
  it("rejects bad FSAs", () => {
    expect(validateTemplate({ ...T, delivery_fsas: ["m5t"] }).ok).toBe(false);
  });
});

describe("validateTarget", () => {
  it("rejects reserved and malformed slugs (route-collision gate)", () => {
    expect(validateTarget({ slug: "demo", name_zh: "x", owner_id: OWNER }).join()).toContain("保留字");
    expect(validateTarget({ slug: "Fu Lai", name_zh: "x", owner_id: OWNER }).join()).toContain("格式不合法");
    expect(validateTarget({ slug: "golden-wok", name_zh: "x", owner_id: "not-a-uuid" }).join()).toContain("uuid");
  });
});

describe("lit() escaping (eng 3A — Sang's apostrophe day one)", () => {
  it("doubles single quotes", () => {
    expect(lit("Sang's Seafood")).toBe("'Sang''s Seafood'");
  });
  it("survives newlines, unicode, backslashes, injection attempts", () => {
    expect(lit("a\nb")).toBe("'a\nb'");
    expect(lit("富来小厨 🦀")).toBe("'富来小厨 🦀'");
    expect(lit("C:\\path")).toBe("'C:\\path'");
    expect(lit("'; drop table tenants; --")).toBe("'''; drop table tenants; --'");
  });
  it("litJsonb escapes quotes inside JSON", () => {
    expect(litJsonb({ en: "Sang's" })).toBe(`'{"en":"Sang''s"}'::jsonb`);
  });
});

describe("buildProvisionSql", () => {
  const sql = buildProvisionSql(T, { slug: "golden-wok", name_zh: "老王面馆", name_en: "Golden Wok", owner_id: OWNER });
  it("is idempotent by construction (upserts, no bare inserts)", () => {
    expect(sql).toContain("on conflict (slug) do update");
    expect(sql).toContain("on conflict (tenant_slug, template_key) do update");
  });
  it("market dishes get null price + is_market", () => {
    const marketRow = sql.split("\n").find((l) => l.includes("游水海斑"))!;
    expect(marketRow).toContain("null");
    expect(marketRow).toContain("true");
  });
  it("variants carried through as jsonb", () => {
    expect(sql).toContain("全只");
  });
  it("header doubles as the dry-run preview (E6)", () => {
    expect(sql).toContain("将创建: 3 个桌号 · 3 个模块 · 2 个分类 · 2 个配送区 · 3 道菜");
  });
  it("throws on invalid template instead of emitting broken SQL", () => {
    expect(() => buildProvisionSql({ ...T, version: 9 as any }, { slug: "ok-shop", name_zh: "x", owner_id: OWNER })).toThrow("模版不合法");
    expect(() => buildProvisionSql(T, { slug: "demo", name_zh: "x", owner_id: OWNER })).toThrow("目标不合法");
  });
});
