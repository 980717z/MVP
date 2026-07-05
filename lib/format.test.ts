import { describe, expect, it } from "vitest";
import { displayTable } from "./format";

// The physical table signs read 01/02/…/08 but the printed QR codes encode
// ?t=1/?t=2 (permanent-QR contract: stored values never change). displayTable
// is the display-only bridge — single digits pad to two, everything else is
// untouched.
describe("displayTable", () => {
  it("pads single digits to match the printed signs", () => {
    expect(displayTable("1")).toBe("01");
    expect(displayTable("8")).toBe("08");
  });
  it("leaves multi-char and lettered labels unchanged", () => {
    expect(displayTable("10")).toBe("10");
    expect(displayTable("2A")).toBe("2A");
    expect(displayTable("8B")).toBe("8B");
  });
  it("handles empty/null safely", () => {
    expect(displayTable("")).toBe("");
    expect(displayTable(null)).toBe("");
    expect(displayTable(undefined)).toBe("");
    expect(displayTable(" 5 ")).toBe("05");
  });
});
