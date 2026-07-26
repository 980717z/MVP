import { describe, expect, it } from "vitest";
import { resolveMenuView } from "./menuView";

describe("resolveMenuView", () => {
  it("manual override wins over viewport width", () => {
    expect(resolveMenuView("phone", true)).toBe("phone"); // forced phone on a wide screen
    expect(resolveMenuView("desktop", false)).toBe("desktop"); // forced desktop on a narrow screen
  });
  it("no override → follows viewport width (≥768 = desktop)", () => {
    expect(resolveMenuView(null, true)).toBe("desktop");
    expect(resolveMenuView(null, false)).toBe("phone");
  });
  it("ignores junk/empty stored values and falls back to width", () => {
    expect(resolveMenuView("", true)).toBe("desktop");
    expect(resolveMenuView("tablet", false)).toBe("phone");
    expect(resolveMenuView(undefined, true)).toBe("desktop");
  });
});
