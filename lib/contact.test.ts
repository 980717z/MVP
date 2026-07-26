import { describe, expect, it } from "vitest";
import { isValidEmail, cleanEmail, cleanName, hasName } from "./contact";

describe("isValidEmail", () => {
  it("accepts ordinary addresses, including the UofT ones", () => {
    for (const e of ["a@b.ca", "student@utoronto.ca", "s.name@mail.utoronto.ca", "x@y.co"]) {
      expect(isValidEmail(e)).toBe(true);
    }
  });

  it("rejects the typos a hurried student makes", () => {
    for (const e of ["", "  ", "nope", "no@domain", "a@b", "a b@c.ca", "@b.ca", "a@@b.ca", "a@b .ca", null, undefined]) {
      expect(isValidEmail(e)).toBe(false);
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidEmail("  s@utoronto.ca  ")).toBe(true);
  });

  it("rejects absurdly long input", () => {
    expect(isValidEmail("a".repeat(300) + "@b.ca")).toBe(false);
  });
});

describe("cleanEmail", () => {
  it("trims and lowercases so one student isn't two rows", () => {
    expect(cleanEmail("  Student@Utoronto.CA ")).toBe("student@utoronto.ca");
  });
});

describe("cleanName / hasName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(cleanName("  Jamal   Khan ")).toBe("Jamal Khan");
  });
  it("bounds length so a request can't store a paragraph", () => {
    expect(cleanName("x".repeat(200)).length).toBe(80);
  });
  it("hasName is false for blank/whitespace, true for a real name", () => {
    expect(hasName("   ")).toBe(false);
    expect(hasName("")).toBe(false);
    expect(hasName(null)).toBe(false);
    expect(hasName("Ali")).toBe(true);
  });
});
