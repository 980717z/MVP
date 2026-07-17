import { describe, expect, it } from "vitest";
import { hoursStatus, type Hours } from "./hours";

// A Wednesday. 2026-07-15 was a Wednesday; 16:00Z = 12:00 Toronto (EDT, UTC-4).
const wedNoonToronto = new Date("2026-07-15T16:00:00Z");
const wed8amToronto = new Date("2026-07-15T12:00:00Z");
const wed9pmToronto = new Date("2026-07-16T01:00:00Z");

const TRUCK: Hours = {
  mon: [["11:00", "20:00"]], tue: [["11:00", "20:00"]], wed: [["11:00", "20:00"]],
  thu: [["11:00", "20:00"]], fri: [["11:00", "20:00"]], sat: [], sun: [],
};

describe("hoursStatus", () => {
  it("open mid-day within the range", () => {
    const s = hoursStatus(TRUCK, wedNoonToronto);
    expect(s.open).toBe(true);
    expect(s.unconfigured).toBe(false);
    expect(s.closesAt).toBe("20:00");
  });

  it("closed before opening → opensAt today", () => {
    const s = hoursStatus(TRUCK, wed8amToronto);
    expect(s.open).toBe(false);
    expect(s.opensAt).toBe("11:00");
  });

  it("closed after closing → no later range today", () => {
    const s = hoursStatus(TRUCK, wed9pmToronto);
    expect(s.open).toBe(false);
    expect(s.opensAt).toBeNull();
  });

  it("closed on a day with an empty array (Saturday)", () => {
    const sat = new Date("2026-07-18T16:00:00Z"); // Sat 12:00 Toronto
    expect(hoursStatus(TRUCK, sat).open).toBe(false);
  });

  it("missing/empty hours = unconfigured, never blocks", () => {
    expect(hoursStatus(null, wedNoonToronto)).toMatchObject({ open: true, unconfigured: true });
    expect(hoursStatus({}, wed9pmToronto)).toMatchObject({ open: true, unconfigured: true });
    expect(hoursStatus({ mon: [], tue: [] }, wed9pmToronto).unconfigured).toBe(true);
  });

  it("split ranges pick the right window", () => {
    const split: Hours = { wed: [["11:00", "14:00"], ["17:00", "20:00"]] };
    const gap = new Date("2026-07-15T19:00:00Z"); // Wed 15:00 Toronto — in the gap
    const s = hoursStatus(split, gap);
    expect(s.open).toBe(false);
    expect(s.opensAt).toBe("17:00");
  });

  it("garbage range strings are ignored, not fatal", () => {
    const bad: Hours = { wed: [["nope", "20:00"], ["11:00", "20:00"]] };
    expect(hoursStatus(bad, wedNoonToronto).open).toBe(true);
  });
});
