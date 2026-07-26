import { describe, it, expect } from "vitest";
import { isCookPotDish, withCookVariants, TOGO_COOK_SURCHARGE, type DishLike } from "./dish";

describe("isCookPotDish", () => {
  it("matches dishes whose name contains 鸡锅", () => {
    expect(isCookPotDish({ name_zh: "药材竹丝鸡锅" })).toBe(true);
    expect(isCookPotDish({ name_zh: "半竹丝鸡 + 半走地鸡锅" })).toBe(true);
    expect(isCookPotDish({ name_zh: "游水青斑火锅" })).toBe(false);
    expect(isCookPotDish({ name_zh: "扬州窝面" })).toBe(false);
  });
});

describe("withCookVariants", () => {
  it("turns a single-price pot into 生 (current price) / 熟 (+surcharge)", () => {
    const d: DishLike = { name_zh: "药材竹丝鸡锅", price: 50.99, variants: [] };
    const out = withCookVariants(d);
    expect(out.variants).toEqual([
      { label_zh: "生", label_en: "Raw", price: 50.99 },
      { label_zh: "熟", label_en: "Cooked", price: 50.99 + TOGO_COOK_SURCHARGE },
    ]);
  });

  it("crosses existing sizes with 生/熟 (全只生/全只熟/半只生/半只熟)", () => {
    const d: DishLike = {
      name_zh: "大补走地鸡锅",
      price: 45.99,
      variants: [
        { label_zh: "全只", label_en: "Whole", price: 45.99 },
        { label_zh: "半只", label_en: "Half", price: 35.99 },
      ],
    };
    const out = withCookVariants(d);
    expect(out.variants).toEqual([
      { label_zh: "全只生", label_en: "Whole Raw", price: 45.99 },
      { label_zh: "全只熟", label_en: "Whole Cooked", price: 50.99 },
      { label_zh: "半只生", label_en: "Half Raw", price: 35.99 },
      { label_zh: "半只熟", label_en: "Half Cooked", price: 40.99 },
    ]);
  });

  it("does not mutate the input dish", () => {
    const d: DishLike = { name_zh: "药材竹丝鸡锅", price: 50.99, variants: [] };
    withCookVariants(d);
    expect(d.variants).toEqual([]);
  });
});
