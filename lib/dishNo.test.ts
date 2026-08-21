import { describe, expect, it } from "vitest";
import { cleanDishNo, dishNoMatches } from "./dishNo";

describe("cleanDishNo", () => {
  it("trims, collapses inner whitespace, and upper-cases", () => {
    expect(cleanDishNo("  48a ")).toBe("48A");
    expect(cleanDishNo("f 12")).toBe("F12");
    expect(cleanDishNo("J118")).toBe("J118");
  });

  it("treats blank / missing as empty (the dish simply has no number)", () => {
    expect(cleanDishNo("")).toBe("");
    expect(cleanDishNo("   ")).toBe("");
    expect(cleanDishNo(null)).toBe("");
    expect(cleanDishNo(undefined)).toBe("");
  });

  it("keeps the merchant's own numbering shape rather than reformatting it", () => {
    expect(cleanDishNo("8B")).toBe("8B");
    expect(cleanDishNo("001")).toBe("001"); // not normalized to "1"
  });
});

describe("dishNoMatches", () => {
  it("matches an exact number", () => {
    expect(dishNoMatches("115", "115")).toBe(true);
  });

  it("prefix-matches so 48 finds 48 and 48A", () => {
    expect(dishNoMatches("48", "48")).toBe(true);
    expect(dishNoMatches("48A", "48")).toBe(true);
  });

  // The rule that keeps a number search usable on a 400-dish menu: substring
  // matching would surface 148/480 when staff type 48.
  it("does NOT substring-match — 48 must not drag in 148 or 480", () => {
    expect(dishNoMatches("148", "48")).toBe(false);
    expect(dishNoMatches("480", "48")).toBe(true); // 480 genuinely starts with 48
    expect(dishNoMatches("1148", "48")).toBe(false);
  });

  it("is case-insensitive for letter codes", () => {
    expect(dishNoMatches("F12", "f12")).toBe(true);
    expect(dishNoMatches("f12", "F1")).toBe(true);
    expect(dishNoMatches("N1", "n")).toBe(true);
  });

  it("ignores punctuation on either side (paper menus write '#48' or '48.')", () => {
    expect(dishNoMatches("48", "#48")).toBe(true);
    expect(dishNoMatches("48.", "48")).toBe(true);
    expect(dishNoMatches("48-A", "48a")).toBe(true);
  });

  // The safety property: a dish with no number must never be pulled in by a
  // search, or every numberless dish would match everything.
  it("never matches when the dish has no number", () => {
    expect(dishNoMatches("", "1")).toBe(false);
    expect(dishNoMatches(null, "1")).toBe(false);
    expect(dishNoMatches(undefined, "1")).toBe(false);
  });

  it("never matches on an empty or punctuation-only query", () => {
    expect(dishNoMatches("48", "")).toBe(false);
    expect(dishNoMatches("48", "   ")).toBe(false);
    expect(dishNoMatches("48", "#")).toBe(false);
  });

  // A Chinese-name query normalizes to "" and must not accidentally match.
  it("does not match a CJK query", () => {
    expect(dishNoMatches("48", "牛肉")).toBe(false);
  });
});
