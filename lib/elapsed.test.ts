import { describe, expect, it } from "vitest";
import { formatWait, waitSince } from "./elapsed";

const MIN = 60_000;

describe("formatWait", () => {
  it("shows <1m for anything under a minute, never 0m", () => {
    expect(formatWait(0)).toBe("<1m");
    expect(formatWait(1_000)).toBe("<1m");
    expect(formatWait(59_999)).toBe("<1m");
  });

  it("shows whole minutes under an hour", () => {
    expect(formatWait(MIN)).toBe("1m");
    expect(formatWait(8 * MIN)).toBe("8m");
    expect(formatWait(59 * MIN)).toBe("59m");
  });

  it("switches to h+padded minutes at an hour so the width stays stable", () => {
    expect(formatWait(60 * MIN)).toBe("1h00m");
    expect(formatWait(65 * MIN)).toBe("1h05m");
    expect(formatWait(125 * MIN)).toBe("2h05m");
  });

  it("floors rather than rounds — 8m59s is still 8m, not 9m", () => {
    expect(formatWait(8 * MIN + 59_000)).toBe("8m");
  });

  // The staff-tablet clock-skew guard: a device running behind the server
  // yields a negative age. Rendering "-3m" would make staff distrust every
  // other number on the floor plan, so we render nothing at all.
  it("returns empty for a negative age (device clock behind server)", () => {
    expect(formatWait(-1)).toBe("");
    expect(formatWait(-5 * MIN)).toBe("");
  });

  it("returns empty for NaN / Infinity instead of printing garbage", () => {
    expect(formatWait(NaN)).toBe("");
    expect(formatWait(Infinity)).toBe("");
    expect(formatWait(-Infinity)).toBe("");
  });
});

describe("waitSince", () => {
  it("formats the gap between a timestamp and now", () => {
    const now = 1_000_000_000;
    expect(waitSince(now - 8 * MIN, now)).toBe("8m");
  });

  // tableOccupancy seeds oldestAt to 0 for a table with no orders; that must
  // read as "no timer", not as "waiting since 1970".
  it("returns empty when the timestamp is absent or zero", () => {
    expect(waitSince(0, 1_000_000_000)).toBe("");
    expect(waitSince(null, 1_000_000_000)).toBe("");
    expect(waitSince(undefined, 1_000_000_000)).toBe("");
  });
});
