import { describe, expect, it } from "vitest";
import { printEligibilityOr, roundNeedsKitchen } from "./printEligibility";
import { isNoCookDish } from "./dish";

// Regression for 富来's「自取厨房单不自动打印」: the print layer kept a pay-first
// gate on togo/delivery even for order_only shops, where payment_status never
// becomes 'paid' (no online payment) — so 自取 tickets were never eligible.
describe("printEligibilityOr", () => {
  it("order_only shop → no payment gate: unpaid 自取/配送 print like dine-in", () => {
    expect(printEligibilityOr("order_only")).toBeNull();
  });

  it("missing/NULL payment_mode counts as order_only (the column default)", () => {
    expect(printEligibilityOr(null)).toBeNull();
    expect(printEligibilityOr(undefined)).toBeNull();
    expect(printEligibilityOr("")).toBeNull();
  });

  it("pay_first shop keeps the strict gate: dine-in always, the rest once paid", () => {
    expect(printEligibilityOr("pay_first")).toBe("order_type.eq.dine_in,payment_status.eq.paid");
  });
});

// 富来 reported 加白饭/加饮料 still printing a kitchen ticket. The menu carries the
// paper-menu dish number inside name_zh ("F15. ]白饭"), so the old exact-match rule
// never fired. These use the REAL stored names.
describe("roundNeedsKitchen", () => {
  const RICE = "rice-id";
  const COKE = "coke-id";
  const FISH = "fish-id";
  const menu = new Map([
    [RICE, { name_zh: "F15. ]白饭", category: "炒饭" }],
    [COKE, { name_zh: "汽水 (罐)", category: "酒水饮品" }],
    [FISH, { name_zh: "143. 姜葱生蚝煲", category: "海鲜" }],
  ]);
  const round = (items: { id: string; noKitchen?: boolean; cancelled?: boolean }[]) =>
    roundNeedsKitchen(items, menu, isNoCookDish);

  it("加白饭 only → no kitchen ticket, even though the order never stamped noKitchen", () => {
    expect(round([{ id: RICE }])).toBe(false);
  });

  it("加饮料 only → no kitchen ticket", () => {
    expect(round([{ id: COKE }])).toBe(false);
  });

  it("白饭 + 饮料 → still no kitchen ticket", () => {
    expect(round([{ id: RICE }, { id: COKE }])).toBe(false);
  });

  it("a real dish in the round → prints, rice and drinks ride along for context", () => {
    expect(round([{ id: RICE }, { id: COKE }, { id: FISH }])).toBe(true);
  });

  it("the only cookable dish cancelled → the leftover rice must not print", () => {
    expect(round([{ id: FISH, cancelled: true }, { id: RICE }])).toBe(false);
  });

  it("current menu overrides a stale noKitchen flag written by an older order", () => {
    expect(round([{ id: RICE, noKitchen: false }])).toBe(false);
    expect(round([{ id: FISH, noKitchen: true }])).toBe(true);
  });

  it("dish deleted from the menu → falls back to the stored flag", () => {
    expect(roundNeedsKitchen([{ id: "gone", noKitchen: true }], menu, isNoCookDish)).toBe(false);
    expect(roundNeedsKitchen([{ id: "gone" }], menu, isNoCookDish)).toBe(true);
  });

  it("menu lookup failed (empty map) → stored flag decides, never silently mute a ticket", () => {
    const none = new Map<string, { name_zh: string; category?: string }>();
    expect(roundNeedsKitchen([{ id: RICE }], none, isNoCookDish)).toBe(true);
    expect(roundNeedsKitchen([{ id: RICE, noKitchen: true }], none, isNoCookDish)).toBe(false);
  });

  it("empty / fully cancelled round never prints", () => {
    expect(round([])).toBe(false);
    expect(round([{ id: FISH, cancelled: true }])).toBe(false);
  });
});
