import { describe, expect, it } from "vitest";
import { printEligibilityOr } from "./printEligibility";

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
