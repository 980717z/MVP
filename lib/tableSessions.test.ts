import { describe, it, expect } from "vitest";
import { tableOccupancy } from "./tableSessions";
import { computeTax } from "./tax";
import type { Order } from "./orders";

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
