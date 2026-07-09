import { describe, expect, it, vi, beforeEach } from "vitest";

// lib/store.ts talks to Supabase directly (no repository layer to swap), so
// these tests mock the query-builder chain itself. Each `.from(table)` call
// consumes the next scripted response in `script`, in call order — the
// builder is chainable (every method returns itself) and thenable (awaiting
// it at any point resolves to that response), matching how supabase-js's
// PostgrestFilterBuilder actually behaves.
function mockSupabase(script: { data?: any; error?: any }[]) {
  let i = 0;
  const calls: { table: string; method: string; args: any[] }[] = [];
  function from(table: string) {
    const resp = script[i] ?? { data: null, error: null };
    i++;
    const b: any = {};
    for (const m of ["select", "eq", "order", "limit", "insert", "update", "delete"]) {
      b[m] = (...args: any[]) => {
        calls.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (resolve: any, reject: any) => Promise.resolve(resp).then(resolve, reject);
    return b;
  }
  return { from: vi.fn(from), calls };
}

let supabaseMock: ReturnType<typeof mockSupabase>;

vi.mock("./supabase", () => ({
  get supabase() {
    return supabaseMock;
  },
}));

beforeEach(() => {
  supabaseMock = mockSupabase([]);
});

describe("recordOrderSale — idempotent order → sales-ledger posting", () => {
  it("inserts a sales row with the tax breakdown when the order hasn't been posted yet", async () => {
    supabaseMock = mockSupabase([
      { data: [] }, // existing orderId check: none found
      { error: null }, // insert
    ]);
    const { recordOrderSale } = await import("./store");
    await recordOrderSale("fulai", { id: "order-1", total: 100, items: [{ name_zh: "虾", qty: 2 }] });

    const insertCall = supabaseMock.calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    const data = insertCall!.args[0].data;
    expect(data.orderId).toBe("order-1");
    expect(data.subtotal).toBe("100");
    expect(data.gst).toBe("5");
    expect(data.pst).toBe("8");
    expect(data.total).toBe("113");
    expect(data.desc).toBe("虾×2");
  });

  it("does NOT insert a second time if this orderId is already recorded (no double-counting a re-completed order)", async () => {
    supabaseMock = mockSupabase([
      { data: [{ id: "existing-row" }] }, // already posted
    ]);
    const { recordOrderSale } = await import("./store");
    await recordOrderSale("fulai", { id: "order-1", total: 100, items: [] });

    const insertCall = supabaseMock.calls.find((c) => c.method === "insert");
    expect(insertCall).toBeUndefined();
  });
});

describe("postOrderSales — dish-margin qty aggregation", () => {
  it("aggregates repeated dish lines into one qty before updating", async () => {
    supabaseMock = mockSupabase([
      { data: [{ id: "row-虾", data: { dish: "虾", soldMonth: "10", price: "20" } }] },
      { error: null }, // update
    ]);
    const { postOrderSales } = await import("./store");
    await postOrderSales("fulai", [
      { name_zh: "虾", qty: 2, price: 20 },
      { name_zh: "虾", qty: 3, price: 20 }, // same dish twice in one order
    ]);

    const updateCall = supabaseMock.calls.find((c) => c.method === "update");
    expect(updateCall).toBeDefined();
    expect(updateCall!.args[0].data.soldMonth).toBe("15"); // 10 existing + 2 + 3
  });

  it("creates a new dish-margin row for a dish that isn't tracked yet", async () => {
    supabaseMock = mockSupabase([
      { data: [] }, // nothing tracked yet
      { error: null }, // insert
    ]);
    const { postOrderSales } = await import("./store");
    await postOrderSales("fulai", [{ name_zh: "新菜", qty: 4, price: 15 }]);

    const insertCall = supabaseMock.calls.find((c) => c.method === "insert");
    expect(insertCall!.args[0].data).toMatchObject({ dish: "新菜", soldMonth: "4", price: "15" });
  });

  it("skips zero-qty and blank-name lines entirely (no DB call for an empty order)", async () => {
    const { postOrderSales } = await import("./store");
    await postOrderSales("fulai", [{ name_zh: "", qty: 5, price: 10 }, { name_zh: "虾", qty: 0, price: 10 }]);
    expect(supabaseMock.calls.length).toBe(0);
  });
});

describe("syncMemberFromOrder — visits/spend accumulate, tier follows spend", () => {
  it("upgrades an existing member's spend/visits and assigns the correct tier", async () => {
    supabaseMock = mockSupabase([
      { data: [{ id: "member-1", data: { phone: "5145551234", visits: "3", spend: "400", tier: "普通" } }] }, // existing member
      { data: [] }, // loadTierRules: none configured -> DEFAULT_TIERS (普通/银卡500/金卡1000)
      { error: null }, // update
    ]);
    const { syncMemberFromOrder } = await import("./store");
    await syncMemberFromOrder("fulai", "5145551234", "", 150); // 400 + 150 = 550 -> 银卡

    const updateCall = supabaseMock.calls.find((c) => c.method === "update");
    const data = updateCall!.args[0].data;
    expect(data.visits).toBe("4");
    expect(data.spend).toBe("550");
    expect(data.tier).toBe("银卡");
  });

  it("creates a new member on their first order with visits=1", async () => {
    supabaseMock = mockSupabase([
      { data: [] }, // no existing member with this phone
      { data: [] }, // default tiers
      { error: null }, // insert
    ]);
    const { syncMemberFromOrder } = await import("./store");
    await syncMemberFromOrder("fulai", "6135559999", "张三", 50);

    const insertCall = supabaseMock.calls.find((c) => c.method === "insert");
    const data = insertCall!.args[0].data;
    expect(data.phone).toBe("6135559999");
    expect(data.name).toBe("张三");
    expect(data.visits).toBe("1");
    expect(data.spend).toBe("50");
    expect(data.tier).toBe("普通");
  });

  it("does nothing when no phone is given (dine-in order with no number)", async () => {
    const { syncMemberFromOrder } = await import("./store");
    await syncMemberFromOrder("fulai", "", "", 100);
    expect(supabaseMock.calls.length).toBe(0);
  });
});
