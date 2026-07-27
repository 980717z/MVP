import { describe, expect, it } from "vitest";
import { lineupOrders, isInProgress, lineupDestination } from "./lineup";
import type { Order } from "./orders";

const T0 = new Date("2026-07-27T18:00:00Z").getTime();
const at = (msAgo: number) => new Date(T0 - msAgo).toISOString();
const MIN = 60_000;

const mk = (p: Partial<Order>): Order => ({
  id: "x", tenant_slug: "fulai", items: [], total: 0, table_no: "", phone: "N/A", note: "",
  status: "new", created_at: at(0), order_type: "dine_in", payment_status: "unpaid",
  payment_method: "", tip: 0, subtotal: null, gst: null, pst: null, customer_email: null,
  address: null, eta_minutes: null, paid_at: null, printed_at: null, bill_at: null,
  bill_printed_at: null, ready_at: null, picked_up_at: null, pickup_code: null,
  tracking_token: null, order_no: null, business_date: null, ...p,
} as Order);

describe("isInProgress", () => {
  it("keeps new, preparing and delivering", () => {
    expect(isInProgress(mk({ status: "new" }))).toBe(true);
    expect(isInProgress(mk({ status: "preparing" }))).toBe(true);
    expect(isInProgress(mk({ status: "delivering" }))).toBe(true);
  });

  it("drops done and cancelled", () => {
    expect(isInProgress(mk({ status: "done" }))).toBe(false);
    expect(isInProgress(mk({ status: "cancelled" }))).toBe(false);
  });

  // A pickup order settles on picked_up_at; waiting for status to catch up
  // would leave a collected order sitting at the top of the queue.
  it("drops a pickup order that was already collected", () => {
    expect(isInProgress(mk({ order_type: "pickup", status: "preparing", picked_up_at: at(0) }))).toBe(false);
  });
});

describe("lineupOrders", () => {
  // The core promise of the rail: the top row is what has waited longest.
  it("puts the OLDEST order first", () => {
    const out = lineupOrders([
      mk({ id: "new", created_at: at(2 * MIN) }),
      mk({ id: "oldest", created_at: at(40 * MIN) }),
      mk({ id: "mid", created_at: at(15 * MIN) }),
    ]);
    expect(out.map((o) => o.id)).toEqual(["oldest", "mid", "new"]);
  });

  it("mixes every channel into ONE queue", () => {
    const out = lineupOrders([
      mk({ id: "pickup", order_type: "pickup", created_at: at(5 * MIN) }),
      mk({ id: "dine", order_type: "dine_in", created_at: at(20 * MIN) }),
      mk({ id: "togo", order_type: "togo", created_at: at(10 * MIN) }),
      mk({ id: "deliv", order_type: "delivery", created_at: at(15 * MIN) }),
    ]);
    expect(out.map((o) => o.id)).toEqual(["dine", "deliv", "togo", "pickup"]);
  });

  it("excludes finished and cancelled work", () => {
    const out = lineupOrders([
      mk({ id: "live", created_at: at(5 * MIN) }),
      mk({ id: "done", status: "done", created_at: at(30 * MIN) }),
      mk({ id: "canc", status: "cancelled", created_at: at(30 * MIN) }),
    ]);
    expect(out.map((o) => o.id)).toEqual(["live"]);
  });

  // Rows must not shuffle between the portal's 8s polls.
  it("breaks ties deterministically so rows don't jump on refresh", () => {
    const a = lineupOrders([mk({ id: "b", created_at: at(MIN) }), mk({ id: "a", created_at: at(MIN) })]);
    const b = lineupOrders([mk({ id: "a", created_at: at(MIN) }), mk({ id: "b", created_at: at(MIN) })]);
    expect(a.map((o) => o.id)).toEqual(["a", "b"]);
    expect(b.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("treats an unparseable created_at as oldest rather than throwing", () => {
    const out = lineupOrders([mk({ id: "ok", created_at: at(MIN) }), mk({ id: "bad", created_at: "nope" })]);
    expect(out.map((o) => o.id)).toEqual(["bad", "ok"]);
  });

  it("does not mutate the input array", () => {
    const input = [mk({ id: "b", created_at: at(MIN) }), mk({ id: "a", created_at: at(9 * MIN) })];
    const copy = [...input];
    lineupOrders(input);
    expect(input.map((o) => o.id)).toEqual(copy.map((o) => o.id));
  });

  it("handles an empty service", () => {
    expect(lineupOrders([])).toEqual([]);
  });
});

describe("lineupDestination", () => {
  it("maps each channel to its own icon", () => {
    expect(lineupDestination(mk({ order_type: "dine_in" })).kind).toBe("dine");
    expect(lineupDestination(mk({ order_type: "togo" })).kind).toBe("togo");
    expect(lineupDestination(mk({ order_type: "delivery" })).kind).toBe("delivery");
    expect(lineupDestination(mk({ order_type: "pickup" })).kind).toBe("pickup");
  });
});
