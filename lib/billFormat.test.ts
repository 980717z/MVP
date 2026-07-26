import { describe, expect, it } from "vitest";
import { money, signedMoney, pricedNoteLine } from "./billFormat";

describe("money", () => {
  it("formats two-decimal dollars", () => {
    expect(money(16.99)).toBe("$16.99");
    expect(money(4)).toBe("$4.00");
    expect(money(0)).toBe("$0.00");
  });
  it("half-up rounds float noise", () => {
    expect(money(18.9761)).toBe("$18.98");
    expect(money(2.005)).toBe("$2.01");
  });
  it("coerces junk to $0.00", () => {
    expect(money(NaN)).toBe("$0.00");
    expect(money(undefined as unknown as number)).toBe("$0.00");
  });
});

describe("signedMoney", () => {
  it("prefixes + for positive / zero", () => {
    expect(signedMoney(5)).toBe("+$5.00");
    expect(signedMoney(0)).toBe("+$0.00");
    expect(signedMoney(15)).toBe("+$15.00");
  });
  it("uses a proper minus glyph for negative", () => {
    expect(signedMoney(-5)).toBe("−$5.00");
    expect(signedMoney(-0.5)).toBe("−$0.50");
    // the sign is U+2212 MINUS SIGN, not an ASCII hyphen
    expect(signedMoney(-5).charCodeAt(0)).toBe(0x2212);
  });
});

describe("pricedNoteLine", () => {
  it("note + adjust → reason with signed amount", () => {
    expect(pricedNoteLine({ note: "加炒底", adjust: 5 })).toBe("  → 加炒底 +$5.00");
    expect(pricedNoteLine({ note: "加一条鱼", adjust: 15 })).toBe("  → 加一条鱼 +$15.00");
    expect(pricedNoteLine({ note: "减半", adjust: -3 })).toBe("  → 减半 −$3.00");
  });
  it("free note (no adjust) → note only, no price", () => {
    expect(pricedNoteLine({ note: "少辣" })).toBe("  → 少辣");
    expect(pricedNoteLine({ note: "少辣", adjust: 0 })).toBe("  → 少辣");
  });
  it("adjust only (no note) → bilingual generic label", () => {
    expect(pricedNoteLine({ adjust: 5 })).toBe("  → 加价 Adjust +$5.00");
    expect(pricedNoteLine({ adjust: -5 })).toBe("  → 加价 Adjust −$5.00");
  });
  it("neither → null (nothing to annotate)", () => {
    expect(pricedNoteLine({})).toBeNull();
    expect(pricedNoteLine({ note: "   ", adjust: 0 })).toBeNull();
    expect(pricedNoteLine({ note: "" })).toBeNull();
  });
  it("trims whitespace-only notes but keeps a real note with adjust", () => {
    expect(pricedNoteLine({ note: "  ", adjust: 5 })).toBe("  → 加价 Adjust +$5.00");
    expect(pricedNoteLine({ note: " 加蛋 ", adjust: 2 })).toBe("  → 加蛋 +$2.00");
  });
});
