import { describe, expect, it } from "vitest";
import {
  cartKey,
  parseCartKey,
  unitPrice,
  cartTotal,
  displayPrice,
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
