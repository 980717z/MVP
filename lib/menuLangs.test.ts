import { describe, expect, it } from "vitest";
import { resolveOfferedLangs, clampLang, isBilingual } from "./menuLangs";

describe("resolveOfferedLangs", () => {
  it("English-only vendor offers just English (Pita Express)", () => {
    expect(resolveOfferedLangs(["en"])).toEqual(["en"]);
  });

  it("bilingual vendor keeps order, first = default (fulai)", () => {
    expect(resolveOfferedLangs(["zh", "en"])).toEqual(["zh", "en"]);
  });

  // Back-compat: the whole point of the fallback is the menu never breaks before
  // the migration adds the column, or on a shop that hasn't set it.
  it("missing / empty / null falls back to bilingual zh/en", () => {
    expect(resolveOfferedLangs(null)).toEqual(["zh", "en"]);
    expect(resolveOfferedLangs(undefined)).toEqual(["zh", "en"]);
    expect(resolveOfferedLangs([])).toEqual(["zh", "en"]);
  });

  it("ignores languages with no dish data (fr, garbage)", () => {
    expect(resolveOfferedLangs(["en", "fr"])).toEqual(["en"]);
    expect(resolveOfferedLangs(["fr"])).toEqual(["zh", "en"]); // nothing renderable → fallback
    expect(resolveOfferedLangs(["en", 42, "ar"])).toEqual(["en"]);
  });

  it("de-dupes while preserving order", () => {
    expect(resolveOfferedLangs(["en", "en"])).toEqual(["en"]);
    expect(resolveOfferedLangs(["en", "zh", "en"])).toEqual(["en", "zh"]);
  });
});

describe("clampLang", () => {
  it("keeps the active language when the shop offers it", () => {
    expect(clampLang("en", ["zh", "en"])).toBe("en");
    expect(clampLang("zh", ["zh", "en"])).toBe("zh");
  });

  // The core guard: a stored/URL zh on an English-only vendor must not strand
  // the diner, because there is no toggle to switch back.
  it("falls back to the default when the active language isn't offered", () => {
    expect(clampLang("zh", ["en"])).toBe("en");
    expect(clampLang("en", ["zh"])).toBe("zh");
  });
});

describe("isBilingual", () => {
  it("true only when more than one language is offered", () => {
    expect(isBilingual(["zh", "en"])).toBe(true);
    expect(isBilingual(["en"])).toBe(false);
  });
});
