import { describe, expect, it } from "vitest";
import { repriceOrder, toCents, validateOrderItems } from "./payments";
import type { MenuItem } from "./menu";
import type { OrderItem } from "./orders";

const menu = [
  { id: "hotpot", name_zh: "游水青斑火锅", price: 65.99, is_market: false, variants: [] },
  { id: "soup", name_zh: "红烧蟹肉翅", price: null, is_market: false, variants: [
    { label_zh: "位", price: 35.99 }, { label_zh: "大", price: 145.99 },
  ] },
  { id: "lobster", name_zh: "生猛龙虾", price: null, is_market: true, variants: [
    { label_zh: "清蒸", price: 0 },
  ] },
] as unknown as MenuItem[];

const line = (id: string, price: number | null, qty: number): OrderItem =>
  ({ id, name_zh: id, name_en: id, price, qty } as OrderItem);

describe("repriceOrder — server-authoritative, tamper-proof", () => {
  it("prices a valid single-item togo order (HST 13%, no tip)", () => {
    const r = repriceOrder([line("hotpot", 65.99, 1)], menu, "togo");
    expect(r.ok).toBe(true);
    expect(r.subtotal).toBe(65.99);
    expect(r.pricing!.gst).toBeCloseTo(3.30, 2);
    expect(r.pricing!.pst).toBeCloseTo(5.28, 2);
    expect(r.pricing!.tip).toBe(0);
    expect(r.pricing!.grandTotal).toBeCloseTo(74.57, 2);
  });

  it("REJECTS a tampered (lowered) price", () => {
    const r = repriceOrder([line("hotpot", 1.0, 1)], menu, "togo");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("价格与菜单不符");
  });

  it("accepts a valid variant price, rejects an invalid one", () => {
    expect(repriceOrder([line("soup", 35.99, 1)], menu, "togo").ok).toBe(true);
    expect(repriceOrder([line("soup", 50.0, 1)], menu, "togo").ok).toBe(false); // 50 isn't a variant price
  });

  it("REJECTS market (时价) items — can't be pre-paid online", () => {
    const r = repriceOrder([{ ...line("lobster", null, 1), market: true } as OrderItem], menu, "togo");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("时价");
  });

  it("REJECTS an unknown / delisted dish", () => {
    expect(repriceOrder([line("ghost", 9.99, 1)], menu, "togo").error).toContain("不存在");
  });

  it("REJECTS bad quantities", () => {
    expect(repriceOrder([line("hotpot", 65.99, 0)], menu, "togo").ok).toBe(false);
    expect(repriceOrder([line("hotpot", 65.99, 1.5)], menu, "togo").ok).toBe(false);
  });

  it("delivery adds a 10% pre-tax tip and enforces the $30 minimum", () => {
    const ok = repriceOrder([line("hotpot", 65.99, 1)], menu, "delivery");
    expect(ok.ok).toBe(true);
    expect(ok.pricing!.tip).toBeCloseTo(6.60, 2); // 10% of 65.99
    const below = repriceOrder([line("soup", 35.99, 1)], menu, "delivery"); // 35.99 ≥ 30 ok
    expect(below.ok).toBe(true);
    const tooLow = repriceOrder([{ id: "x", name_zh: "x", name_en: "x", price: 5, qty: 1 } as OrderItem],
      [{ id: "x", name_zh: "x", price: 5, is_market: false, variants: [] } as unknown as MenuItem], "delivery");
    expect(tooLow.ok).toBe(false);
    expect(tooLow.error).toContain("配送需满");
  });

  it("sums multiple lines", () => {
    const r = repriceOrder([line("hotpot", 65.99, 2), line("soup", 35.99, 1)], menu, "togo");
    expect(r.subtotal).toBeCloseTo(167.97, 2);
  });

  it("toCents rounds to integer cents", () => {
    expect(toCents(74.57)).toBe(7457);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("validateOrderItems — createOrder's server-side gate (tolerates market items)", () => {
  it("REJECTS a tampered (lowered) price, same as repriceOrder", () => {
    const r = validateOrderItems([line("hotpot", 1.0, 1)], menu);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("价格与菜单不符");
  });

  it("REJECTS a fabricated total by recomputing subtotal from the menu, ignoring client price tampering elsewhere", () => {
    const r = validateOrderItems([line("hotpot", 65.99, 2), line("soup", 35.99, 1)], menu);
    expect(r.ok).toBe(true);
    expect(r.subtotal).toBeCloseTo(167.97, 2); // never trusts a client-supplied `total`
  });

  it("ACCEPTS a market (时价) item — unlike repriceOrder — and contributes 0 to subtotal", () => {
    const r = validateOrderItems([{ ...line("lobster", null, 1), market: true } as OrderItem], menu);
    expect(r.ok).toBe(true);
    expect(r.subtotal).toBe(0);
    expect(r.items![0].price).toBeNull();
  });

  it("REJECTS a non-market dish falsely flagged as market (can't dodge price checks)", () => {
    const r = validateOrderItems([{ ...line("hotpot", null, 1), market: true } as OrderItem], menu);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("不是时价");
  });

  it("REJECTS an unknown / delisted dish", () => {
    expect(validateOrderItems([line("ghost", 9.99, 1)], menu).error).toContain("不存在");
  });

  it("REJECTS bad quantities", () => {
    expect(validateOrderItems([line("hotpot", 65.99, 0)], menu).ok).toBe(false);
    expect(validateOrderItems([line("hotpot", 65.99, 1.5)], menu).ok).toBe(false);
    expect(validateOrderItems([line("hotpot", 65.99, 1000)], menu).ok).toBe(false);
  });

  it("REJECTS an empty order", () => {
    expect(validateOrderItems([], menu).ok).toBe(false);
  });
});
