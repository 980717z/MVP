import { describe, expect, it } from "vitest";
import {
  cartKey,
  parseCartKey,
  unitPrice,
  cartTotal,
  displayPrice,
  isChoiceDish,
  normVariants,
  type MenuItem,
} from "./menu";

const dish = (over: Partial<MenuItem>): MenuItem => ({
  id: "d1",
  tenant_slug: "fulai",
  name_zh: "大补走地鸡窝",
  name_en: "Free Range Chicken Hot Pot",
  price: null,
  is_market: false,
  variants: [],
  category: "火锅",
  image_url: "",
  sort: 0,
  created_at: "",
  ...over,
});

describe("cartKey / parseCartKey", () => {
  it("single-price dish keys by id only", () => {
    expect(cartKey("d1", null)).toBe("d1");
    expect(parseCartKey("d1")).toEqual({ id: "d1", vi: null });
  });
  it("a chosen size keys by id#index and round-trips", () => {
    expect(cartKey("d1", 2)).toBe("d1#2");
    expect(parseCartKey("d1#2")).toEqual({ id: "d1", vi: 2 });
  });
});

describe("unitPrice", () => {
  const single = dish({ price: 39.99 });
  const multi = dish({
    price: null,
    variants: [
      { label_zh: "全", label_en: "Whole", price: 45.99 },
      { label_zh: "半", label_en: "Half", price: 35.99 },
    ],
  });
  it("single-price uses price", () => {
    expect(unitPrice(single, null)).toBe(39.99);
  });
  it("variant uses the chosen size's price", () => {
    expect(unitPrice(multi, 0)).toBe(45.99);
    expect(unitPrice(multi, 1)).toBe(35.99);
  });
});

describe("displayPrice — 起 price is the cheapest size", () => {
  it("single-price returns the price", () => {
    expect(displayPrice(dish({ price: 39.99 }))).toBe(39.99);
  });
  it("multi-size returns the minimum variant price", () => {
    const soup = dish({
      variants: [
        { label_zh: "位", price: 35.99 },
        { label_zh: "小", price: 59.99 },
        { label_zh: "中", price: 87.99 },
      ],
    });
    expect(displayPrice(soup)).toBe(35.99);
  });
});

describe("cartTotal — same dish, different sizes are separate lines", () => {
  const chicken = dish({
    id: "c",
    variants: [
      { label_zh: "全", price: 45.99 },
      { label_zh: "半", price: 35.99 },
    ],
  });
  const lamb = dish({ id: "l", price: 39.99, name_zh: "羊腩煲" });
  const byId = { c: chicken, l: lamb };

  it("totals a single-price dish", () => {
    expect(cartTotal({ l: 2 }, byId)).toBe(79.98);
  });
  it("totals the SAME dish in two sizes independently", () => {
    // 全 ×1 ($45.99) + 半 ×2 ($35.99) = 45.99 + 71.98
    expect(cartTotal({ "c#0": 1, "c#1": 2 }, byId)).toBe(117.97);
  });
  it("mixes single + multi-size", () => {
    expect(cartTotal({ "c#1": 1, l: 1 }, byId)).toBe(75.98);
  });
  it("ignores keys whose dish is gone", () => {
    expect(cartTotal({ "zzz#0": 3 }, byId)).toBe(0);
  });
});

describe("normVariants — read side filters half-typed rows", () => {
  it("drops rows without a label or with no price", () => {
    const raw = [
      { label_zh: "全", label_en: "Whole", price: 45.99 },
      { label_zh: "", label_en: "Half", price: 35.99 }, // no zh label
      { label_zh: "小", price: 0 }, // no price
      { label_zh: "中", price: "87.99" }, // string price coerced
    ];
    const v = normVariants(raw);
    expect(v).toHaveLength(2);
    expect(v[0]).toEqual({ label_zh: "全", label_en: "Whole", price: 45.99 });
    expect(v[1]).toEqual({ label_zh: "中", label_en: undefined, price: 87.99 });
  });
  it("non-array is empty", () => {
    expect(normVariants(null)).toEqual([]);
    expect(normVariants(undefined)).toEqual([]);
  });
});

describe("isChoiceDish — 同价多选 vs 不同价规格", () => {
  const base = { id: "x", name_zh: "菜", name_en: "", price: null, category: "", image_url: "", is_market: false } as unknown as MenuItem;
  it("same-price options = choice (菠菜/唐生菜)", () => {
    expect(isChoiceDish({ ...base, variants: [
      { label_zh: "菠菜", label_en: "Spinach", price: 8.99 },
      { label_zh: "唐生菜", label_en: "Lettuce", price: 8.99 },
    ] } as MenuItem)).toBe(true);
  });
  it("different prices = sizes, not a choice (全只/半只)", () => {
    expect(isChoiceDish({ ...base, variants: [
      { label_zh: "全只", label_en: "Whole", price: 39.99 },
      { label_zh: "半只", label_en: "Half", price: 20.99 },
    ] } as MenuItem)).toBe(false);
  });
  it("no variants / single variant = not a choice", () => {
    expect(isChoiceDish({ ...base, variants: [] } as MenuItem)).toBe(false);
    expect(isChoiceDish({ ...base, variants: [{ label_zh: "大", label_en: "L", price: 9 }] } as MenuItem)).toBe(false);
  });
});

describe("normVariants — market dishes keep priceless choices (龙虾做法)", () => {
  const styles = [{ label_zh: "清蒸", label_en: "Steamed", price: null }, { label_zh: "姜葱", price: 0 }];
  it("strips priceless variants by default (sizes need a price)", () => {
    expect(normVariants(styles)).toHaveLength(0);
  });
  it("keeps labelled priceless variants when allowPriceless (时价 styles)", () => {
    const r = normVariants(styles, true);
    expect(r.map((v) => v.label_zh)).toEqual(["清蒸", "姜葱"]);
  });
  it("still drops truly empty rows even when allowPriceless", () => {
    expect(normVariants([{ label_zh: "", price: null }], true)).toHaveLength(0);
  });
});

describe("isChoiceDish — market styles read as a choice (all same 0 price)", () => {
  const base = { id: "x", name_zh: "生猛龙虾", name_en: "", price: null, category: "海鲜", image_url: "", is_market: true } as unknown as MenuItem;
  it("3 priceless styles = a choice picker", () => {
    expect(isChoiceDish({ ...base, variants: [
      { label_zh: "清蒸", price: 0 }, { label_zh: "姜葱", price: 0 }, { label_zh: "豉椒", price: 0 },
    ] } as MenuItem)).toBe(true);
  });
});
