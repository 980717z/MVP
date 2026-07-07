import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloverCharge, cloverFindPaidCharge, chargeNeedle, chargeDescription } from "./clover";

const OK_BODY = { id: "ch_1", status: "succeeded", paid: true, amount: 7457, source: { brand: "visa", last4: "1111" } };

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("CLOVER_BASE", "https://sandbox.test");
  vi.stubEnv("CLOVER_ECOMM_PRIVATE_KEY", "sk_test");
  vi.stubEnv("CLOVER_MERCHANT_ID", "MID123");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cloverCharge — outcome classification", () => {
  it("succeeded when Clover returns status=succeeded & paid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, OK_BODY)));
    const r = await cloverCharge({ amountCents: 7457, token: "clv_x" });
    expect(r).toMatchObject({ ok: true, outcome: "succeeded", chargeId: "ch_1", brand: "visa", last4: "1111" });
  });

  it("declined on a 402 (definitively not charged → retryable)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(402, { error: { message: "Card declined." } })));
    const r = await cloverCharge({ amountCents: 7457, token: "clv_x" });
    expect(r).toMatchObject({ ok: false, outcome: "declined", error: "Card declined." });
  });

  it("declined on a 200 that isn't succeeded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { status: "failed" })));
    const r = await cloverCharge({ amountCents: 7457, token: "clv_x" });
    expect(r.outcome).toBe("declined");
  });

  it("error (UNKNOWN) on a network throw — may have charged", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const r = await cloverCharge({ amountCents: 7457, token: "clv_x" });
    expect(r).toMatchObject({ ok: false, outcome: "error" });
  });

  it("error (UNKNOWN) on a 5xx — Clover may have charged before erroring", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(503, {})));
    const r = await cloverCharge({ amountCents: 7457, token: "clv_x" });
    expect(r.outcome).toBe("error");
  });

  it("rejects a bad token before any network call (declined, not charged)", async () => {
    const spy = vi.fn(async () => res(200, OK_BODY));
    vi.stubGlobal("fetch", spy);
    const r = await cloverCharge({ amountCents: 7457, token: "nope" });
    expect(r.outcome).toBe("declined");
    expect(spy).not.toHaveBeenCalled();
  });

  it("passes the idempotency-key header through", async () => {
    const spy = vi.fn(async () => res(200, OK_BODY));
    vi.stubGlobal("fetch", spy);
    await cloverCharge({ amountCents: 7457, token: "clv_x", idempotencyKey: "ord-1:clv_x" });
    const headers = spy.mock.calls[0][1].headers;
    expect(headers["idempotency-key"]).toBe("ord-1:clv_x");
  });
});

describe("charge description ↔ reconcile needle", () => {
  it("needle is the first 8 chars of the id, prefixed with #", () => {
    expect(chargeNeedle("1a2b3c4d-9999-4000-8000-abc")).toBe("#1a2b3c4d");
  });
  it("description embeds the needle so reconcile can match it", () => {
    const d = chargeDescription("fulai", "1a2b3c4d-9999-4000-8000-abc");
    expect(d).toContain("#1a2b3c4d");
    expect(d).toContain("fulai");
  });
});

describe("cloverFindPaidCharge — reconcile lookup", () => {
  it("finds a paid, succeeded charge whose description contains the needle", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { elements: [
      { id: "ch_old", paid: true, status: "succeeded", description: "BentoOS fulai #99999999" },
      { id: "ch_hit", paid: true, status: "succeeded", description: "BentoOS fulai #1a2b3c4d" },
    ] })));
    const hit = await cloverFindPaidCharge("#1a2b3c4d");
    expect(hit?.id).toBe("ch_hit");
  });

  it("returns null when no charge matches (safe to release to unpaid)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { elements: [{ id: "ch_x", paid: true, status: "succeeded", description: "BentoOS fulai #zzzzzzzz" }] })));
    expect(await cloverFindPaidCharge("#1a2b3c4d")).toBeNull();
  });

  it("ignores an unpaid charge that happens to match", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { elements: [{ id: "ch_x", paid: false, status: "failed", description: "BentoOS fulai #1a2b3c4d" }] })));
    expect(await cloverFindPaidCharge("#1a2b3c4d")).toBeNull();
  });
});
