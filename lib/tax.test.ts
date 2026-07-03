import { describe, expect, it } from "vitest";
import {
  computeTax,
  priceOrder,
  deliveryShortfall,
  postalFsa,
  isValidPostal,
  inDeliveryZone,
  DELIVERY_TIP_RATE,
  DELIVERY_MIN_SUBTOTAL,
  GST_RATE,
  PST_RATE,
  HST_RATE,
} from "./tax";

const DT_FSAS = ["M4W", "M4X", "M4Y", "M5A", "M5B", "M5C", "M5E", "M5G", "M5H", "M5J", "M5K", "M5L", "M5S", "M5T", "M5V", "M5X"];

describe("Ontario tax constants", () => {
  it("HST = GST 5% + PST 8% = 13%", () => {
    expect(GST_RATE).toBe(0.05);
    expect(PST_RATE).toBe(0.08);
    expect(HST_RATE).toBeCloseTo(0.13);
  });
});

describe("computeTax", () => {
  it("adds 13% on top of a pre-tax amount", () => {
    const t = computeTax(100);
    expect(t).toEqual({ subtotal: 100, gst: 5, pst: 8, total: 113 });
  });

  it("extracts tax from a tax-included amount", () => {
    const t = computeTax(113, true);
    expect(t.subtotal).toBe(100);
    expect(t.gst).toBe(5);
    expect(t.pst).toBe(8);
    expect(t.total).toBe(113);
  });

  it("rounds to cents (odd amounts)", () => {
    const t = computeTax(45.99);
    expect(t.gst).toBe(2.3); // 2.2995 → 2.30
    expect(t.pst).toBe(3.68); // 3.6792 → 3.68
    expect(t.total).toBe(51.97);
  });

  it("handles zero", () => {
    expect(computeTax(0)).toEqual({ subtotal: 0, gst: 0, pst: 0, total: 0 });
  });
});

describe("priceOrder (delivery: mandatory 10% tip, pre-tax base, untaxed)", () => {
  it("delivery on $100: tip $10, grand total $123", () => {
    const p = priceOrder(100, DELIVERY_TIP_RATE);
    expect(p.tip).toBe(10);
    expect(p.total).toBe(113); // taxed food only
    expect(p.grandTotal).toBe(123); // tip never taxed
  });

  it("tip is 10% of PRE-tax subtotal, not the after-tax total", () => {
    const p = priceOrder(100, DELIVERY_TIP_RATE);
    expect(p.tip).toBe(10); // NOT 11.30
  });

  it("no tip when rate omitted (takeout/dine-in default)", () => {
    const p = priceOrder(45.99);
    expect(p.tip).toBe(0);
    expect(p.grandTotal).toBe(51.97);
  });

  it("dine-in phone-pay selectable tips (15%, 18%)", () => {
    expect(priceOrder(80, 0.15).tip).toBe(12);
    expect(priceOrder(80, 0.18).tip).toBe(14.4);
  });

  it("rounds tip to cents", () => {
    const p = priceOrder(45.99, DELIVERY_TIP_RATE);
    expect(p.tip).toBe(4.6); // 4.599 → 4.60
    expect(p.grandTotal).toBe(56.57); // 51.97 + 4.60
  });
});

describe("deliveryShortfall ($30 minimum)", () => {
  it("meets the minimum at exactly $30", () => {
    expect(deliveryShortfall(DELIVERY_MIN_SUBTOTAL)).toBe(0);
  });
  it("reports the gap below $30", () => {
    expect(deliveryShortfall(21.5)).toBe(8.5);
  });
  it("no shortfall above the minimum", () => {
    expect(deliveryShortfall(148.95)).toBe(0);
  });
  it("full shortfall on an empty cart", () => {
    expect(deliveryShortfall(0)).toBe(30);
  });
});

describe("postal validation + Toronto DT zone", () => {
  it("accepts valid postal shapes, with or without space", () => {
    expect(isValidPostal("M5T 2E7")).toBe(true);
    expect(isValidPostal("M5T2E7")).toBe(true);
    expect(isValidPostal("m5t 2e7")).toBe(true);
  });

  it("rejects malformed postals", () => {
    expect(isValidPostal("")).toBe(false);
    expect(isValidPostal("12345")).toBe(false);
    expect(isValidPostal("M5T")).toBe(false);
    expect(isValidPostal("M5T 2E")).toBe(false);
  });

  it("extracts the FSA tolerantly", () => {
    expect(postalFsa("m5t 2e7")).toBe("M5T");
    expect(postalFsa(" M5V1J1 ")).toBe("M5V");
  });

  it("343 Spadina (M5T) is in the zone", () => {
    expect(inDeliveryZone("M5T 2E7", DT_FSAS)).toBe(true);
  });

  it("Scarborough (M1B) is out", () => {
    expect(inDeliveryZone("M1B 5K7", DT_FSAS)).toBe(false);
  });

  it("midtown M5R and PO-box M5W are out (deliberate exclusions)", () => {
    expect(inDeliveryZone("M5R 2E1", DT_FSAS)).toBe(false);
    expect(inDeliveryZone("M5W 1E6", DT_FSAS)).toBe(false);
  });

  it("First Canadian Place (M5X) is in (offices are deliverable)", () => {
    expect(inDeliveryZone("M5X 1A1", DT_FSAS)).toBe(true);
  });

  it("case/space tolerant zone check", () => {
    expect(inDeliveryZone("m5b2h1", DT_FSAS)).toBe(true);
  });
});
