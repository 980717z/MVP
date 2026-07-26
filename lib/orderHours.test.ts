import { describe, it, expect } from "vitest";
import { orderSlots, hoursConfigured, type Hours } from "./orderHours";

// Open 11:00–21:00 every day.
const ALL_OPEN: Hours = Object.fromEntries(
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [["11:00", "21:00"]]]),
) as Hours;

describe("hoursConfigured", () => {
  it("false for null/empty, true when any day has a range", () => {
    expect(hoursConfigured(null)).toBe(false);
    expect(hoursConfigured({})).toBe(false);
    expect(hoursConfigured({ mon: [] })).toBe(false);
    expect(hoursConfigured({ mon: [["11:00", "21:00"]] })).toBe(true);
  });
});

describe("orderSlots", () => {
  it("open now → ASAP available; first slot is now+60min aligned to 15, bounded by close", () => {
    const now = new Date("2026-07-27T16:00:00-04:00"); // Toronto 16:00 EDT
    const { asap, slots } = orderSlots(ALL_OPEN, now);
    expect(asap).toBe(true);
    const today = slots.filter((s) => s.dayOffset === 0);
    expect(today[0].hhmm).toBe("17:00"); // 16:00 + 60min
    expect(today[today.length - 1].hhmm).toBe("20:45"); // last before 21:00 close
    expect(today).toHaveLength(16); // 17:00 … 20:45
    expect(today.every((s) => s.hhmm < "21:00")).toBe(true);
  });

  it("aligns the first slot up to the 15-min grid", () => {
    const now = new Date("2026-07-27T16:07:00-04:00");
    const today = orderSlots(ALL_OPEN, now).slots.filter((s) => s.dayOffset === 0);
    expect(today[0].hhmm).toBe("17:15"); // 17:07 → ceil to 17:15
  });

  it("closed now (after close) → no ASAP, first slot is tomorrow at open", () => {
    const now = new Date("2026-07-27T22:00:00-04:00"); // after 21:00 close
    const { asap, slots } = orderSlots(ALL_OPEN, now);
    expect(asap).toBe(false);
    expect(slots.filter((s) => s.dayOffset === 0)).toHaveLength(0);
    const tmr = slots.find((s) => s.dayOffset === 1);
    expect(tmr?.hhmm).toBe("11:00");
  });

  it("unconfigured hours → ASAP + slots still generate (never gate)", () => {
    const now = new Date("2026-07-27T16:00:00-04:00");
    const { asap, slots } = orderSlots({}, now);
    expect(asap).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].hhmm).toBe("17:00");
  });

  it("a closed weekday produces no slots that day", () => {
    // Only Mondays open. 2026-07-27 is a Monday, so today (off 0) has slots and
    // the next day (Tue, off 1) has none.
    const monOnly: Hours = { mon: [["11:00", "21:00"]] };
    const now = new Date("2026-07-27T16:00:00-04:00");
    const { slots } = orderSlots(monOnly, now);
    expect(slots.some((s) => s.dayOffset === 0)).toBe(true); // Monday
    expect(slots.some((s) => s.dayOffset === 1)).toBe(false); // Tuesday closed
  });
});
