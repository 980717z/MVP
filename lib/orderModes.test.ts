import { describe, expect, it } from "vitest";
import { resolveOrderModes, isModeAllowed, offersMarket, ALL_ORDER_MODES } from "./orderModes";

describe("resolveOrderModes", () => {
  it("campus food truck offers pickup only", () => {
    expect(resolveOrderModes(["pickup"])).toEqual(["pickup"]);
    expect(offersMarket(resolveOrderModes(["pickup"]))).toBe(false);
  });

  // Back-compat: the whole point of the fallback is that a restaurant that never
  // set order_modes (or a pre-migration DB) keeps every mode.
  it("absent / empty / null falls back to ALL modes", () => {
    expect(resolveOrderModes(null)).toEqual(ALL_ORDER_MODES);
    expect(resolveOrderModes(undefined)).toEqual(ALL_ORDER_MODES);
    expect(resolveOrderModes([])).toEqual(ALL_ORDER_MODES);
  });

  it("preserves order, drops unknowns, de-dupes", () => {
    expect(resolveOrderModes(["pickup", "dine"])).toEqual(["pickup", "dine"]);
    expect(resolveOrderModes(["pickup", "spaceship", 42])).toEqual(["pickup"]);
    expect(resolveOrderModes(["dine", "dine", "pickup"])).toEqual(["dine", "pickup"]);
  });

  it("all-garbage falls back to ALL (never leaves a shop with zero modes)", () => {
    expect(resolveOrderModes(["nope", "nada"])).toEqual(ALL_ORDER_MODES);
  });
});

describe("isModeAllowed", () => {
  it("gates the customer ?m= param and the admin tabs", () => {
    const truck = resolveOrderModes(["pickup"]);
    expect(isModeAllowed("pickup", truck)).toBe(true);
    expect(isModeAllowed("delivery", truck)).toBe(false);
    expect(isModeAllowed("market", truck)).toBe(false);
  });

  it("a restaurant (ALL) allows every mode", () => {
    const all = resolveOrderModes(null);
    for (const m of ALL_ORDER_MODES) expect(isModeAllowed(m, all)).toBe(true);
  });
});

describe("offersMarket", () => {
  it("true only when market is offered", () => {
    expect(offersMarket(["pickup"])).toBe(false);
    expect(offersMarket(ALL_ORDER_MODES)).toBe(true);
  });
});
