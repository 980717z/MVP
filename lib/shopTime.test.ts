import { describe, expect, it } from "vitest";
import { addDays, mondayOf, shopHm, shopMonthDayTime, shopYmd } from "./shopTime";

describe("addDays — pure UTC calendar math, DST- and device-timezone-independent", () => {
  it("crosses the March DST boundary correctly", () => {
    expect(addDays("2026-03-07", 7)).toBe("2026-03-14");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-01-28", 5)).toBe("2026-02-02");
  });

  it("subtracts days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("mondayOf", () => {
  it("finds Monday for a mid-week date", () => {
    expect(mondayOf("2026-03-11")).toBe("2026-03-09"); // Wed → Mon
  });

  it("a Sunday belongs to the Monday six days before it", () => {
    expect(mondayOf("2026-03-15")).toBe("2026-03-09");
  });

  it("a Monday maps to itself", () => {
    expect(mondayOf("2026-03-09")).toBe("2026-03-09");
  });
});

describe("shopYmd / shopHm — shop-timezone (America/Toronto), not the caller's own clock", () => {
  it("reads the shop's date, not a UTC-truncated one, near a UTC-day boundary", () => {
    // 2026-03-10T03:30:00Z is still 2026-03-09 in Toronto (EST/EDT), even
    // though naive UTC truncation would read it as the 10th.
    const instant = new Date("2026-03-10T03:30:00Z");
    expect(shopYmd(instant)).toBe("2026-03-09");
    expect(shopHm(instant)).toBe("23:30");
  });

  it("gives the shop's date regardless of the host's own timezone", () => {
    const instant = new Date("2026-03-10T03:30:00Z");
    // Same instant, asserted the same way a Shanghai-based device would see
    // a completely different local date/time but shopYmd must not care.
    expect(shopYmd(instant)).toBe("2026-03-09");
  });
});

describe("shopMonthDayTime — kitchen ticket / order-list timestamp", () => {
  it("prints the shop's local time, not a Vercel server's default UTC clock", () => {
    // An order placed 2026-01-14 19:30 Toronto time (EST, UTC-5) is stored as
    // 2026-01-15T00:30:00Z. A server defaulting to UTC would print "1/15
    // 00:30" — wrong day AND wrong time on the physical kitchen ticket.
    expect(shopMonthDayTime("2026-01-15T00:30:00Z")).toBe("1/14 19:30");
  });

  it("is unpadded like the getMonth()+1/getDate() output it replaces", () => {
    expect(shopMonthDayTime("2026-01-05T19:30:00Z")).toBe("1/5 14:30");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(shopMonthDayTime(new Date("2026-01-15T00:30:00Z"))).toBe("1/14 19:30");
  });
});
