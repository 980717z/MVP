import { describe, expect, it } from "vitest";
import { pinyinInitials } from "./pinyin";

describe("pinyinInitials", () => {
  it("gives the first pinyin letter of each Chinese character", () => {
    expect(pinyinInitials("菠萝咕噜肉")).toBe("blglr");
    expect(pinyinInitials("生猛龙虾")).toBe("smlx");
    expect(pinyinInitials("白灼虾")).toBe("bzx");
    expect(pinyinInitials("宫保鸡丁")).toBe("gbjd");
  });

  it("keeps latin/digits so mixed names stay searchable", () => {
    expect(pinyinInitials("XO酱皇")).toBe("xojh");
  });

  it("strips spaces and punctuation", () => {
    expect(pinyinInitials("苹果汁 (瓶)")).toBe("pgzp");
  });

  it("empty / blank → empty string", () => {
    expect(pinyinInitials("")).toBe("");
    expect(pinyinInitials("   ")).toBe("");
    expect(pinyinInitials(null)).toBe("");
    expect(pinyinInitials(undefined)).toBe("");
  });
});
