import { describe, expect, it } from "vitest";
import { applyItemEdit, basePriceOf, activeTotal, type EditableItem } from "./itemEdit";

const line = (p: Partial<EditableItem> = {}): EditableItem => ({ price: 24.99, qty: 1, ...p });

describe("basePriceOf", () => {
  it("is the price itself when nothing was adjusted", () => {
    expect(basePriceOf(line())).toBeCloseTo(24.99, 2);
  });

  it("strips a previous adjustment back out", () => {
    expect(basePriceOf(line({ price: 29.99, adjust: 5 }))).toBeCloseTo(24.99, 2);
  });

  it("handles a negative adjustment (a discount)", () => {
    expect(basePriceOf(line({ price: 19.99, adjust: -5 }))).toBeCloseTo(24.99, 2);
  });
});

describe("applyItemEdit — price + adjust", () => {
  it("records the delta as adjust and folds it into price (加料 +$5)", () => {
    const r = applyItemEdit(line(), { price: 29.99 });
    expect(r.price).toBeCloseTo(29.99, 2);
    expect(r.adjust).toBeCloseTo(5, 2);
  });

  // The invariant that makes repeated edits safe: adjust is recomputed from the
  // BASE each time, never accumulated. 24.99 → 29.99 → 27.99 must end at +3.
  it("stays stable across repeated edits instead of drifting", () => {
    let r = applyItemEdit(line(), { price: 29.99 });
    r = applyItemEdit(r, { price: 27.99 });
    expect(r.price).toBeCloseTo(27.99, 2);
    expect(r.adjust).toBeCloseTo(3, 2);
    expect(basePriceOf(r)).toBeCloseTo(24.99, 2);
  });

  it("drops the adjust key entirely when the price returns to base (no '+$0.00' on the bill)", () => {
    let r = applyItemEdit(line(), { price: 29.99 });
    r = applyItemEdit(r, { price: 24.99 });
    expect(r.price).toBeCloseTo(24.99, 2);
    expect("adjust" in r).toBe(false);
  });

  it("supports a discount as a negative adjustment", () => {
    const r = applyItemEdit(line(), { price: 19.99 });
    expect(r.adjust).toBeCloseTo(-5, 2);
  });

  it("clamps a negative price to zero rather than storing a negative line", () => {
    const r = applyItemEdit(line(), { price: -3 });
    expect(r.price).toBe(0);
  });

  it("rounds to the cent so floating point never leaks onto a bill", () => {
    const r = applyItemEdit(line({ price: 10.1 }), { price: 20.2 });
    expect(r.adjust).toBeCloseTo(10.1, 2);
    expect(String(r.adjust).length).toBeLessThan(8); // not 10.100000000000001
  });

  it("ignores a non-numeric price instead of writing NaN", () => {
    const r = applyItemEdit(line(), { price: NaN });
    expect(r.price).toBeCloseTo(24.99, 2);
  });
});

describe("applyItemEdit — qty", () => {
  it("sets the quantity", () => {
    expect(applyItemEdit(line(), { qty: 3 }).qty).toBe(3);
  });

  // Zero-qty lines would silently vanish from the bill; cancelling is the
  // explicit path for removing a dish.
  it("never drops below 1 — cancelling a dish is a separate action", () => {
    expect(applyItemEdit(line({ qty: 2 }), { qty: 0 }).qty).toBe(1);
    expect(applyItemEdit(line({ qty: 2 }), { qty: -5 }).qty).toBe(1);
  });

  it("floors a fractional quantity", () => {
    expect(applyItemEdit(line(), { qty: 2.7 }).qty).toBe(2);
  });
});

describe("applyItemEdit — note", () => {
  it("sets a note (rides onto the bill + kitchen ticket)", () => {
    expect(applyItemEdit(line(), { note: "加料" }).note).toBe("加料");
  });

  it("trims surrounding whitespace", () => {
    expect(applyItemEdit(line(), { note: "  少辣 " }).note).toBe("少辣");
  });

  it("removes the note key when cleared, rather than storing an empty string", () => {
    const r = applyItemEdit(line({ note: "加料" }), { note: "   " });
    expect("note" in r).toBe(false);
  });

  it("leaves an existing note alone when the patch omits it", () => {
    expect(applyItemEdit(line({ note: "加料" }), { price: 30 }).note).toBe("加料");
  });
});

describe("activeTotal", () => {
  it("sums price x qty across lines", () => {
    expect(activeTotal([line({ price: 24.99 }), line({ price: 19.99, qty: 2 })])).toBeCloseTo(64.97, 2);
  });

  it("excludes cancelled lines", () => {
    expect(activeTotal([line({ price: 10 }), line({ price: 99, cancelled: true })])).toBeCloseTo(10, 2);
  });

  it("treats a null price (un-entered 时价) as zero instead of NaN", () => {
    expect(activeTotal([line({ price: null }), line({ price: 10 })])).toBeCloseTo(10, 2);
  });

  it("handles an empty order", () => {
    expect(activeTotal([])).toBe(0);
  });

  // End-to-end of the real scenario: diner adds 加料 to one dish on a live table.
  it("reflects an edit in the order total (加料 +$5 on one of three dishes)", () => {
    const items = [line({ price: 24.99 }), line({ price: 19.99 }), line({ price: 3 })];
    expect(activeTotal(items)).toBeCloseTo(47.98, 2);
    items[0] = applyItemEdit(items[0], { price: 29.99, note: "加料" });
    expect(activeTotal(items)).toBeCloseTo(52.98, 2);
  });
});
