import { describe, expect, it, vi } from "vitest";
import { runChargeFlow, type OrderStore, type ChargeableOrder, type PaidFields } from "./chargeFlow";
import type { ChargeResult } from "./clover";
import type { MenuItem } from "./menu";

// hotpot 65.99 → togo total 74.57 → 7457 cents
const MENU = [{ id: "hotpot", name_zh: "火锅", price: 65.99, is_market: false, variants: [] }] as unknown as MenuItem[];

function makeOrder(over: Partial<ChargeableOrder> = {}): ChargeableOrder {
  return {
    id: "ord-1",
    tenant_slug: "fulai",
    order_type: "togo",
    payment_status: "unpaid",
    items: [{ id: "hotpot", name_zh: "火锅", name_en: "hotpot", price: 65.99, qty: 1 }],
    customer_email: null,
    ...over,
  };
}

/** In-memory store that honours the CAS semantics the real DB enforces. */
class FakeStore implements OrderStore {
  order: ChargeableOrder;
  menu: MenuItem[];
  markPaidFail = 0; // number of leading markPaid calls that fail (transient)
  markReconcileCalls = 0;
  resetCalls = 0;
  constructor(order: ChargeableOrder, menu = MENU) {
    this.order = order;
    this.menu = menu;
  }
  async loadOrder() {
    return { ...this.order };
  }
  async loadMenu() {
    return this.menu;
  }
  async claimPending(_id: string) {
    if (this.order.payment_status === "unpaid") {
      this.order.payment_status = "pending";
      return true;
    }
    return false;
  }
  async markPaid(_id: string, _fields: PaidFields) {
    if (this.markPaidFail > 0) {
      this.markPaidFail--;
      return false;
    }
    if (this.order.payment_status === "pending") {
      this.order.payment_status = "paid";
      return true;
    }
    return false;
  }
  async resetUnpaid(_id: string) {
    this.resetCalls++;
    if (this.order.payment_status === "pending") this.order.payment_status = "unpaid";
  }
  async markReconcile(_id: string) {
    this.markReconcileCalls++;
    this.order.payment_status = "reconcile_pending";
  }
}

const succeeded = (): Promise<ChargeResult> =>
  Promise.resolve({ ok: true, outcome: "succeeded", chargeId: "ch_1", brand: "visa", last4: "1111", amountCents: 7457 });
const declined = (): Promise<ChargeResult> => Promise.resolve({ ok: false, outcome: "declined", error: "Card declined." });
const unknown = (): Promise<ChargeResult> => Promise.resolve({ ok: false, outcome: "error", error: "timeout" });

const noSleep = async () => {};
const deps = (store: FakeStore, charge: () => Promise<ChargeResult>, sleep = noSleep) =>
  ({ store, charge, sleep, now: () => "2026-07-07T00:00:00Z" });

describe("runChargeFlow — money state machine", () => {
  it("charges a valid order and marks it paid, sending the quoted cents", async () => {
    const store = new FakeStore(makeOrder());
    const charge = vi.fn(succeeded);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7457 }, deps(store, charge));
    expect(r.http).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(store.order.payment_status).toBe("paid");
    expect(charge).toHaveBeenCalledOnce();
    expect(charge.mock.calls[0][0].idempotencyKey).toBe("ord-1:clv_x");
    expect(charge.mock.calls[0][0].amountCents).toBe(7457);
  });

  it("already-paid is idempotent, never re-charges", async () => {
    const store = new FakeStore(makeOrder({ payment_status: "paid" }));
    const charge = vi.fn(succeeded);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x" }, deps(store, charge));
    expect(r.http).toBe(200);
    expect(r.body.alreadyPaid).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it("an order already 'pending' bails as in-progress, never double-charges", async () => {
    const store = new FakeStore(makeOrder({ payment_status: "pending" }));
    const charge = vi.fn(succeeded);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x" }, deps(store, charge));
    expect(r.http).toBe(409);
    expect(r.body.inProgress).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it("declined resets to unpaid so the diner can retry with another card", async () => {
    const store = new FakeStore(makeOrder());
    const charge = vi.fn(declined);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7457 }, deps(store, charge));
    expect(r.http).toBe(402);
    expect(store.order.payment_status).toBe("unpaid");
    expect(store.resetCalls).toBe(1);
  });

  it("UNKNOWN outcome parks in reconcile_pending and blocks retry", async () => {
    const store = new FakeStore(makeOrder());
    const charge = vi.fn(unknown);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7457 }, deps(store, charge));
    expect(r.http).toBe(409);
    expect(r.body.reconcile).toBe(true);
    expect(store.order.payment_status).toBe("reconcile_pending");
  });

  it("retries a transient mark-paid failure, then settles paid", async () => {
    const store = new FakeStore(makeOrder());
    store.markPaidFail = 2; // fail twice, succeed on the third
    const sleep = vi.fn(noSleep);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7457 }, deps(store, succeeded, sleep));
    expect(r.http).toBe(200);
    expect(store.order.payment_status).toBe("paid");
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("mark-paid failing all 3× parks for reconcile (charge already succeeded)", async () => {
    const store = new FakeStore(makeOrder());
    store.markPaidFail = 3;
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7457 }, deps(store, succeeded));
    expect(r.http).toBe(202);
    expect(r.body.pending).toBe(true);
    expect(store.order.payment_status).toBe("reconcile_pending");
  });

  it("rejects a charge above the quoted amount (never bill more than shown)", async () => {
    const store = new FakeStore(makeOrder());
    const charge = vi.fn(succeeded);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 7000 }, deps(store, charge)); // 7457 > 7000
    expect(r.http).toBe(409);
    expect(r.body.priceChanged).toBe(true);
    expect(charge).not.toHaveBeenCalled();
    expect(store.order.payment_status).toBe("unpaid"); // claim released
  });

  it("charges LESS than the quote without complaint (menu dropped)", async () => {
    const store = new FakeStore(makeOrder());
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x", quotedCents: 9999 }, deps(store, succeeded));
    expect(r.http).toBe(200);
    expect(store.order.payment_status).toBe("paid");
  });

  it("normalizes not-found and non-payable to one response (no id enumeration)", async () => {
    const nf = new FakeStore(makeOrder());
    nf.loadOrder = async () => null;
    const a = await runChargeFlow({ orderId: "x", token: "clv_x" }, deps(nf, succeeded));
    const b = await runChargeFlow({ orderId: "ord-1", token: "clv_x" }, deps(new FakeStore(makeOrder({ order_type: "dine_in" })), succeeded));
    expect(a.http).toBe(400);
    expect(b.http).toBe(400);
    expect(a.body).toEqual(b.body);
  });

  it("a tampered price fails re-pricing and releases the claim", async () => {
    const store = new FakeStore(makeOrder({ items: [{ id: "hotpot", name_zh: "火锅", name_en: "hotpot", price: 1.0, qty: 1 }] }));
    const charge = vi.fn(succeeded);
    const r = await runChargeFlow({ orderId: "ord-1", token: "clv_x" }, deps(store, charge));
    expect(r.http).toBe(400);
    expect(charge).not.toHaveBeenCalled();
    expect(store.order.payment_status).toBe("unpaid");
  });
});
