import { describe, expect, it } from "vitest";
import { rankDishes, topRevenue, type SalesRow } from "./dishSales";

const dishes: SalesRow[] = [
  { id: "a", dish: "红烧蟹肉翅", price: "48", soldMonth: "1286" },
  { id: "b", dish: "白灼虾", price: "36", soldMonth: "1102" },
  { id: "c", dish: "避风塘炒蟹", price: "88", soldMonth: "0" },
  { id: "d", dish: "海鲜粥", price: "18", soldMonth: "" },
];

describe("rankDishes", () => {
  it("ranks by quantity sold, descending", () => {
    const r = rankDishes(dishes);
    expect(r.map((d) => d.row.dish).slice(0, 2)).toEqual(["红烧蟹肉翅", "白灼虾"]);
  });

  // The bug this whole review started from: the module exists to answer
  // 「哪些菜卖不动」 and the old filter deleted the answer.
  it("KEEPS zero-selling dishes and ranks them last", () => {
    const r = rankDishes(dishes);
    expect(r).toHaveLength(4);
    expect(r.slice(-2).map((d) => d.row.dish).sort()).toEqual(["海鲜粥", "避风塘炒蟹"]);
    expect(r.every((d) => d.sold >= 0)).toBe(true);
  });

  it("treats a blank or missing quantity as zero, not as a parse failure", () => {
    const r = rankDishes([{ dish: "海鲜粥", price: "18", soldMonth: "" }]);
    expect(r[0].sold).toBe(0);
    expect(r[0].revenue).toBe(0);
  });

  it("breaks ties on revenue so the pricier dish ranks higher at equal counts", () => {
    const r = rankDishes([
      { dish: "便宜菜", price: "10", soldMonth: "100" },
      { dish: "贵菜", price: "50", soldMonth: "100" },
    ]);
    expect(r[0].row.dish).toBe("贵菜");
  });

  it("computes revenue as price x quantity", () => {
    expect(rankDishes(dishes)[0].revenue).toBe(48 * 1286);
  });

  it("handles an empty menu without throwing", () => {
    expect(rankDishes([])).toEqual([]);
  });
});

describe("topRevenue", () => {
  it("returns the single highest revenue figure", () => {
    expect(topRevenue(rankDishes(dishes))).toBe(48 * 1286);
  });

  // Guards the emerald accent: with nothing sold there is no winner to mark.
  it("returns 0 when nothing sold, so no $0 row gets accented as the top", () => {
    const allZero = rankDishes([
      { dish: "避风塘炒蟹", price: "88", soldMonth: "0" },
      { dish: "海鲜粥", price: "18", soldMonth: "0" },
    ]);
    expect(topRevenue(allZero)).toBe(0);
  });
});
