import { describe, expect, it } from "vitest";
import { hoursStatus, pickupGate, type Hours } from "./hours";

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

// The gate that decides whether a student may place a pickup order. Every branch
// here is a real failure a student would hit at the truck, so all of them are
// covered: ordering while open/closed, scheduling in/out of hours, and the two
// ways a scheduled time can be nonsense (already past, absurdly far ahead).
describe("pickupGate", () => {
  const at = (iso: string) => new Date(iso);

  it("ASAP while open → allowed, no scheduled time", () => {
    const r = pickupGate(TRUCK, null, wedNoonToronto);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.requestedPickupAt).toBeNull();
  });

  it("ASAP before opening → rejected, tells the student when it opens", () => {
    const r = pickupGate(TRUCK, null, wed8amToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("closed_now");
      expect(r.error).toContain("11:00");
    }
  });

  it("ASAP after closing → rejected", () => {
    const r = pickupGate(TRUCK, null, wed9pmToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("closed_now");
  });

  it("scheduled inside hours → allowed, returns normalized ISO", () => {
    // 13:00 Toronto, ordered at noon.
    const r = pickupGate(TRUCK, "2026-07-15T17:00:00Z", wedNoonToronto);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.requestedPickupAt).toBe("2026-07-15T17:00:00.000Z");
  });

  it("scheduled after closing → rejected with the closing time", () => {
    // 21:00 Toronto — truck shuts at 20:00.
    const r = pickupGate(TRUCK, "2026-07-16T01:00:00Z", wedNoonToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("closed_at_time");
      expect(r.error).toContain("20:00");
    }
  });

  it("scheduled for a closed DAY → rejected as outside hours", () => {
    // Just after midnight on Saturday (truck shut all weekend), scheduling for
    // Saturday lunch — inside the 12h window, so this really tests the day rule.
    const satMidnight = at("2026-07-18T04:30:00Z"); // Sat 00:30 Toronto
    const r = pickupGate(TRUCK, "2026-07-18T15:00:00Z", satMidnight); // Sat 11:00 Toronto
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("closed_at_time");
  });

  it("a far-future day is caught by the 12h cap before the hours rule", () => {
    // Next Wednesday: the truck IS open then, but nobody pre-orders a week out.
    const r = pickupGate(TRUCK, "2026-07-22T16:00:00Z", wedNoonToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_time");
  });

  it("a stale time from a tab left open → rejected as bad_time, not cooked", () => {
    const r = pickupGate(TRUCK, "2026-07-15T15:00:00Z", wedNoonToronto); // an hour ago
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_time");
  });

  it("a few seconds behind now is tolerated (checkout takes a moment)", () => {
    const r = pickupGate(TRUCK, "2026-07-15T15:58:00Z", wedNoonToronto); // 2 min ago
    expect(r.ok).toBe(true);
  });

  it("absurdly far ahead (next week) → rejected", () => {
    const r = pickupGate(TRUCK, "2026-07-22T16:00:00Z", wedNoonToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_time");
  });

  it("unparseable time → rejected, never silently downgraded to ASAP", () => {
    const r = pickupGate(TRUCK, "not-a-date", wedNoonToronto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_time");
  });

  it("unconfigured hours never gate (non-campus tenants like fulai)", () => {
    expect(pickupGate(null, null, wed9pmToronto).ok).toBe(true);
    expect(pickupGate({}, null, wed9pmToronto).ok).toBe(true);
    // ...but a nonsense time is still rejected even when hours don't gate.
    expect(pickupGate(null, "not-a-date", wedNoonToronto).ok).toBe(false);
  });
});
