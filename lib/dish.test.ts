import { describe, expect, it } from "vitest";
import { unitPrice, lineName, isNoCookDish, type DishLike } from "./dish";

// 时价 (market) dishes carry cooking-style variants (清蒸/姜葱/豉椒) that have NO
// price of their own — today's price is set on the DISH each morning from the
// 时价更新 panel. Reported from the floor: 生猛龙虾 had $35.99 entered but the menu
// still showed 时价 and would have billed $0.
describe("unitPrice — 时价 dishes with cooking-style variants", () => {
  const lobster: DishLike = {
    name_zh: "生猛龙虾", name_en: "Live Lobster", price: 35.99, is_market: true,
    variants: [
      { label_zh: "清蒸", price: 0 },
      { label_zh: "姜葱", price: 0 },
      { label_zh: "豉椒", price: 0 },
    ],
  };

  it("falls back to today's market price when the variant carries none", () => {
    expect(unitPrice(lobster, 0)).toBe(35.99);
    expect(unitPrice(lobster, 2)).toBe(35.99);
  });

  it("still reads $0 before the owner sets today's price", () => {
    expect(unitPrice({ ...lobster, price: null }, 0)).toBe(0);
  });

  it("a priced variant always wins over the dish price", () => {
    const sized: DishLike = {
      name_zh: "游水青斑", price: 50, is_market: true,
      variants: [{ label_zh: "小", price: 40 }, { label_zh: "大", price: 60 }],
    };
    expect(unitPrice(sized, 0)).toBe(40);
    expect(unitPrice(sized, 1)).toBe(60);
  });

  it("NON-market dishes do not inherit the base price (a $0 size stays $0)", () => {
    const notMarket: DishLike = {
      name_zh: "白饭", price: 2, is_market: false,
      variants: [{ label_zh: "例", price: 0 }],
    };
    expect(unitPrice(notMarket, 0)).toBe(0);
  });

  it("no variant chosen → the dish price", () => {
    expect(unitPrice(lobster, null)).toBe(35.99);
  });
});

describe("lineName / isNoCookDish", () => {
  const d: DishLike = { name_zh: "红烧蟹肉翅", name_en: "Crab Shark Fin", price: 20 };
  it("bakes the size into the name for kitchen ticket and bill", () => {
    expect(lineName(d, { label_zh: "中", price: 20 })).toBe("红烧蟹肉翅（中）");
    expect(lineName(d, { label_zh: "中", label_en: "M", price: 20 }, true)).toBe("Crab Shark Fin (M)");
  });
  it("falls back to the Chinese name when there is no English one", () => {
    expect(lineName({ name_zh: "油菜", price: 9 }, null, true)).toBe("油菜");
  });
  it("drinks and plain rice skip the kitchen ticket", () => {
    expect(isNoCookDish({ name_zh: "可乐", category: "酒水饮品", price: 2 })).toBe(true);
    expect(isNoCookDish({ name_zh: "白饭", price: 2 })).toBe(true);
    expect(isNoCookDish({ name_zh: "白米饭", price: 2 })).toBe(true);
    expect(isNoCookDish({ name_zh: "红烧肉", price: 20 })).toBe(false);
  });
});
