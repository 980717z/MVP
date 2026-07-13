import { describe, it, expect } from "vitest";
import { tableOccupancy, evenPartition, reconcileShares, itemizePartitions } from "./tableSessions";
import { computeTax } from "./tax";
import type { Order } from "./orders";

const r2 = (n: number) => Math.round(n * 100) / 100;

describe("bill split reconciles to the cent", () => {
  const subs = [10.1, 116.98, 65.99, 172.47, 3, 999.99, 0.05, 100.01, 33.33, 250, 87.65];

  it("evenPartition sums exactly to the subtotal for N=2..12", () => {
    for (const s of subs)
      for (let n = 2; n <= 12; n++) {
        const parts = evenPartition(s, n);
        expect(parts.length).toBe(n);
        expect(r2(parts.reduce((a, b) => a + b, 0))).toBeCloseTo(r2(s), 2);
      }
  });

  it("even split: Σ share subtotal/gst/pst/total == table, exactly", () => {
    for (const s of subs)
      for (let n = 2; n <= 12; n++) {
        const table = computeTax(s, false);
        const shares = reconcileShares(s, evenPartition(s, n));
        const sum = (k: "subtotal" | "gst" | "pst" | "total") => r2(shares.reduce((a, x) => a + x[k], 0));
        expect(sum("subtotal")).toBeCloseTo(r2(table.subtotal), 2);
        expect(sum("gst")).toBeCloseTo(r2(table.gst), 2);
        expect(sum("pst")).toBeCloseTo(r2(table.pst), 2);
        expect(sum("total")).toBeCloseTo(r2(table.total), 2);
        // each share's own hst == its gst+pst (single-line HST holds per share)
        for (const sh of shares) expect(r2(sh.hst)).toBeCloseTo(r2(sh.gst + sh.pst), 2);
      }
  });

  it("itemized split: item-partition sums to table, gst/pst/total reconcile", () => {
    // three people: [65.99], [1.50 + 1.50], [30] → subtotal 98.99
    const partitions = [65.99, 3.0, 30.0];
    const subtotal = r2(partitions.reduce((a, b) => a + b, 0));
    const table = computeTax(subtotal, false);
    const shares = reconcileShares(subtotal, partitions);
    expect(r2(shares.reduce((a, x) => a + x.subtotal, 0))).toBeCloseTo(subtotal, 2);
    expect(r2(shares.reduce((a, x) => a + x.gst, 0))).toBeCloseTo(r2(table.gst), 2);
    expect(r2(shares.reduce((a, x) => a + x.pst, 0))).toBeCloseTo(r2(table.pst), 2);
    expect(r2(shares.reduce((a, x) => a + x.total, 0))).toBeCloseTo(r2(table.total), 2);
  });

  it("no share is ever negative and the remainder lands on share 0", () => {
    const shares = reconcileShares(100.01, evenPartition(100.01, 3));
    expect(shares.every((s) => s.subtotal >= 0 && s.total >= 0)).toBe(true);
    // share 0 carries the extra cent from 100.01/3
    expect(shares[0].subtotal).toBeGreaterThanOrEqual(shares[1].subtotal);
  });
});

describe("itemizePartitions (按菜分 assignment → per-guest subtotals)", () => {
  const U = (key: string, price: number) => ({ key, price });
  // 火锅 65.99 (shared), 白饭 ×2 @1.50, 肥牛片 30.00 → subtotal 98.99
  const units = [U("a", 65.99), U("b", 1.5), U("c", 1.5), U("d", 30.0)];
  const subtotal = 98.99;
  const ids = ["p0", "p1", "p2"];

  it("assigns whole/per-unit dishes and balances to the cent", () => {
    // p0: 白饭×1, p1: 白饭×1, p2: 肥牛片; hotpot shared 3-ways
    const a = { a: "shared", b: "p0", c: "p1", d: "p2" };
    const r = itemizePartitions(units, a, ids, subtotal);
    expect(r.unassigned).toBe(0);
    expect(r.balanced).toBe(true);
    expect(Math.round(r.personSubtotals.reduce((x, y) => x + y, 0) * 100) / 100).toBeCloseTo(subtotal, 2);
    expect(r.sharedTotal).toBeCloseTo(65.99, 2);
    // shared 65.99/3 = 21.9966… → 22.00 / 21.99 / 21.99, remainder cent to earliest
    expect(r.personSubtotals[0]).toBeGreaterThanOrEqual(r.personSubtotals[1]);
  });

  it("flags unassigned units and refuses to balance", () => {
    const r = itemizePartitions(units, { a: "p0" }, ids, subtotal); // b,c,d unassigned
    expect(r.unassigned).toBe(3);
    expect(r.balanced).toBe(false);
  });

  it("treats a removed guest's dishes as unassigned (they resurface)", () => {
    const a = { a: "p0", b: "p1", c: "p2", d: "p2" };
    const r = itemizePartitions(units, a, ["p0", "p1"], subtotal); // p2 removed
    expect(r.unassigned).toBe(2); // c,d were on the removed p2
    expect(r.balanced).toBe(false);
  });

  it("all-shared splits evenly and still balances", () => {
    const a = { a: "shared", b: "shared", c: "shared", d: "shared" };
    const r = itemizePartitions(units, a, ids, subtotal);
    expect(r.balanced).toBe(true);
    expect(r.sharedTotal).toBeCloseTo(subtotal, 2);
    expect(Math.round(r.personSubtotals.reduce((x, y) => x + y, 0) * 100) / 100).toBeCloseTo(subtotal, 2);
  });
});

function mk(p: Partial<Order>): Order {
  return {
    id: "x", tenant_slug: "fulai", items: [], total: 0, table_no: "", phone: "N/A", note: "",
    status: "new", created_at: new Date().toISOString(), order_type: "dine_in", payment_status: "unpaid",
    payment_method: "", tip: 0, subtotal: null, gst: null, pst: null, customer_email: null, address: null,
    eta_minutes: null, paid_at: null, printed_at: null, bill_at: null, bill_printed_at: null, ...p,
  } as Order;
}
const item = (name: string, price: number, qty = 1, extra: object = {}) => ({ id: name, name_zh: name, name_en: "", price, qty, ...extra });

describe("tableOccupancy", () => {
  it("groups unpaid dine-in rounds by table and sums active items", () => {
    const occ = tableOccupancy([
      mk({ id: "a", table_no: "8A", items: [item("鱼", 65.99)] as any }),
      mk({ id: "b", table_no: "8A", items: [item("饭", 1.5, 2)] as any }),
      mk({ id: "c", table_no: "5", items: [item("虾", 30)] as any }),
    ]);
    expect(occ.get("8A")!.orders.length).toBe(2);
    expect(occ.get("8A")!.total).toBeCloseTo(68.99, 2);
    expect(occ.get("8A")!.hasOrder).toBe(true);
    expect(occ.get("5")!.total).toBeCloseTo(30, 2);
  });

  it("excludes paid, cancelled, and non-dine-in orders", () => {
    const occ = tableOccupancy([
      mk({ id: "paid", table_no: "1", payment_status: "paid", items: [item("x", 10)] as any }),
      mk({ id: "canc", table_no: "2", status: "cancelled", items: [item("x", 10)] as any }),
      mk({ id: "togo", table_no: "3", order_type: "togo", items: [item("x", 10)] as any }),
    ]);
    expect(occ.size).toBe(0);
  });

  it("ignores cancelled items in the running total", () => {
    const occ = tableOccupancy([mk({ id: "a", table_no: "7", items: [item("a", 10), item("b", 5, 1, { cancelled: true })] as any })]);
    expect(occ.get("7")!.total).toBeCloseTo(10, 2);
  });

  it("served = true when ANY active dish is served (any-served → orange)", () => {
    const none = tableOccupancy([mk({ id: "a", table_no: "5", items: [item("鱼", 30), item("饭", 2)] as any })]);
    expect(none.get("5")!.served).toBe(false);
    const some = tableOccupancy([mk({ id: "b", table_no: "6", items: [item("鱼", 30, 1, { served: true }), item("饭", 2)] as any })]);
    expect(some.get("6")!.served).toBe(true);
    // a served-but-cancelled dish doesn't count
    const cx = tableOccupancy([mk({ id: "c", table_no: "8", items: [item("鱼", 30, 1, { served: true, cancelled: true })] as any })]);
    expect(cx.get("8")!.served).toBe(false);
  });
});

describe("HST single line reconciles with the split ledger", () => {
  it("round(gst+pst) === round(total-subtotal) across amounts", () => {
    for (const sub of [10.1, 116.98, 65.99, 172.47, 3, 999.99, 0.05]) {
      const { subtotal, gst, pst, total } = computeTax(sub, false);
      const hstLine = Math.round((gst + pst) * 100) / 100;
      expect(hstLine).toBeCloseTo(Math.round((total - subtotal) * 100) / 100, 2);
    }
  });
});

describe("cash change math", () => {
  it("change = tendered − total", () => {
    const total = computeTax(116.98, false).total; // 132.19
    expect(total).toBeCloseTo(132.19, 2);
    expect(Math.round((150 - total) * 100) / 100).toBeCloseTo(17.81, 2);
  });
});
