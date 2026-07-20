import { describe, expect, it } from "vitest";
import { unitPrice, lineName, isNoCookDish, normVariants, normDish, type DishLike } from "./dish";

// ─────────────────────────────────────────────────────────────────────────
//  REGRESSION (eng review E1/E2). A cart references a size by INDEX into the
//  array the DINER saw — which listMenuItems filtered through normVariants.
//  /api/pickup/create used to index the RAW menu_items column instead, so the
//  two sides disagreed about what `vi` meant the moment a row was filtered out.
//  The menu editor stores half-typed rows on purpose (coerceVariants), so this
//  was reachable by an owner clicking "add size" and saving before typing.
//
//  These tests pin the CONTRACT, not the implementation: whatever the client
//  indexes, the server must index the same thing.
// ─────────────────────────────────────────────────────────────────────────
describe("client/server variant index alignment", () => {
  /** What the diner's browser does: listMenuItems → normVariants(raw, is_market). */
  const asClientSees = (d: DishLike) => normVariants(d.variants, !!d.is_market);

  it("a half-typed row shifts every later index — normDish keeps both sides in step", () => {
    // Owner clicked "+ 加规格", saved before typing a label.
    const dish: DishLike = {
      name_zh: "白灼虾", price: 0,
      variants: [{ label_zh: "", price: 0 }, { label_zh: "大", price: 12 }],
    };
    const client = asClientSees(dish);
    expect(client).toHaveLength(1);       // diner only ever sees 大
    const vi = 0;                          // ...so 大 is index 0 in the cart key

    // Raw indexing resolves the blank row — the old bug.
    expect(dish.variants![vi].label_zh).toBe("");
    // Normalized indexing resolves what the diner actually picked.
    expect(normDish(dish).variants![vi].label_zh).toBe("大");
  });

  it("the blank row would have blocked the dish outright (price check fails)", () => {
    const dish: DishLike = {
      name_zh: "白灼虾", price: 0,
      variants: [{ label_zh: "", price: 0 }, { label_zh: "大", price: 12 }],
    };
    expect(unitPrice(dish, 0)).toBe(0);            // raw → $0 → route returns MENU_CHANGED
    expect(unitPrice(normDish(dish), 0)).toBe(12); // normalized → the real price
  });

  it("a 时价 dish would have printed an empty cooking style to the kitchen", () => {
    const lobster: DishLike = {
      name_zh: "生猛龙虾", name_en: "Live Lobster", price: 35.99, is_market: true,
      variants: [{ label_zh: "", price: 0 }, { label_zh: "清蒸", price: 0 }],
    };
    const vi = 0; // diner picked 清蒸, the only style normVariants kept
    expect(asClientSees(lobster)[vi].label_zh).toBe("清蒸");
    // Raw: right money, wrong ticket — 生猛龙虾（） tells the kitchen nothing.
    expect(lineName(lobster, lobster.variants![vi])).toBe("生猛龙虾（）");
    const norm = normDish(lobster);
    expect(lineName(norm, norm.variants![vi])).toBe("生猛龙虾（清蒸）");
    expect(unitPrice(norm, vi)).toBe(35.99);
  });

  it("normDish is a no-op when nothing is filtered (the common case)", () => {
    const dish: DishLike = {
      name_zh: "炒饭", price: 0,
      variants: [{ label_zh: "小", price: 8 }, { label_zh: "大", price: 12 }],
    };
    expect(normDish(dish).variants).toEqual(dish.variants);
    expect(unitPrice(normDish(dish), 1)).toBe(12);
  });

  it("normVariants keeps priceless styles only for 时价 dishes", () => {
    const styles = [{ label_zh: "清蒸", price: 0 }];
    expect(normVariants(styles, false)).toHaveLength(0); // non-market: a $0 size is incomplete
    expect(normVariants(styles, true)).toHaveLength(1);  // 时价: a cooking style has no price
  });
});

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
