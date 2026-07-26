import { describe, it, expect } from "vitest";
import { aggregateSales, shiftDate, monthStart, quarterStart, type SessionRow } from "./salesStats";

const r2 = (n: number) => Math.round(n * 100) / 100;

describe("aggregateSales", () => {
  it("sums pre-tax sales, tax, tips separately and attributes methods", () => {
    const rows: SessionRow[] = [
      { closed_at: "", business_date: "2026-07-12", payment_method: "cash", subtotal: 100, gst: 5, pst: 8, total: 113, tip: 10 },
      { closed_at: "", business_date: "2026-07-12", payment_method: "card", subtotal: 50, gst: 2.5, pst: 4, total: 56.5, tip: 0 },
    ];
    const a = aggregateSales(rows);
    expect(a.txns).toBe(2);
    expect(a.sales).toBeCloseTo(150, 2);   // pre-tax
    expect(a.hst).toBeCloseTo(19.5, 2);    // 5+8+2.5+4
    expect(a.tips).toBeCloseTo(10, 2);
    expect(a.collected).toBeCloseTo(113 + 10 + 56.5, 2);
    expect(a.avgTicket).toBeCloseTo(75, 2);
    expect(a.byMethod.cash.collected).toBeCloseTo(123, 2); // 113 + 10 tip
    expect(a.byMethod.cash.tips).toBeCloseTo(10, 2);
    expect(a.byMethod.card.collected).toBeCloseTo(56.5, 2);
    expect(a.byMethod.emt.collected).toBe(0);
  });

  it("decomposes a split checkout across methods and counts per-method txns", () => {
    const rows: SessionRow[] = [
      {
        closed_at: "", business_date: "2026-07-12", payment_method: "split",
        subtotal: 98.99, gst: 4.95, pst: 7.92, total: 111.86, tip: 15,
        splits: [
          { method: "cash", total: 37.29, tip: 5 },
          { method: "emt", total: 3.39, tip: 0 },
          { method: "card", total: 71.18, tip: 10 },
        ],
      },
    ];
    const a = aggregateSales(rows);
    expect(a.txns).toBe(1);                 // one table
    expect(a.sales).toBeCloseTo(98.99, 2);
    expect(a.tips).toBeCloseTo(15, 2);
    // per-method collected sums back to table total + tips
    const sumCollected = a.byMethod.cash.collected + a.byMethod.emt.collected + a.byMethod.card.collected + a.byMethod.other.collected;
    expect(r2(sumCollected)).toBeCloseTo(r2(111.86 + 15), 2);
    expect(a.byMethod.cash.collected).toBeCloseTo(42.29, 2); // 37.29 + 5
    expect(a.byMethod.card.tips).toBeCloseTo(10, 2);
    expect(a.byMethod.cash.txns).toBe(1);
    expect(a.byMethod.card.txns).toBe(1);
    expect(a.byMethod.emt.txns).toBe(1);
  });

  it("maps unknown/legacy methods to 'other'", () => {
    const rows: SessionRow[] = [{ closed_at: "", business_date: "2026-07-12", payment_method: "server", subtotal: 10, gst: 0.5, pst: 0.8, total: 11.3 }];
    const a = aggregateSales(rows);
    expect(a.byMethod.other.collected).toBeCloseTo(11.3, 2);
  });

  it("empty set → all zeros, no divide-by-zero", () => {
    const a = aggregateSales([]);
    expect(a.txns).toBe(0);
    expect(a.avgTicket).toBe(0);
    expect(a.sales).toBe(0);
  });
});

describe("shiftDate (DST-safe day math)", () => {
  it("shifts across a DST boundary without slipping a day", () => {
    expect(shiftDate("2026-03-08", -6)).toBe("2026-03-02"); // spring-forward week
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31"); // fall-back
    expect(shiftDate("2026-07-12", -29)).toBe("2026-06-13");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31"); // year boundary
  });
});

describe("monthStart / quarterStart", () => {
  it("resolves the first day of the containing month", () => {
    expect(monthStart("2026-07-22")).toBe("2026-07-01");
    expect(monthStart("2026-01-31")).toBe("2026-01-01");
    expect(monthStart("2026-12-01")).toBe("2026-12-01");
  });

  it("resolves the first day of the containing calendar quarter", () => {
    expect(quarterStart("2026-01-15")).toBe("2026-01-01"); // Q1
    expect(quarterStart("2026-03-31")).toBe("2026-01-01"); // Q1
    expect(quarterStart("2026-04-01")).toBe("2026-04-01"); // Q2
    expect(quarterStart("2026-07-22")).toBe("2026-07-01"); // Q3
    expect(quarterStart("2026-11-05")).toBe("2026-10-01"); // Q4
  });
});
