import { describe, expect, it } from "vitest";
import { torontoDayStartIso, torontoToday } from "./salesStats";

// The staff order list and the Epson auto-print queue both window on the
// business day. fulai starts at 7am, so a 2am order still belongs to the
// previous service and must not vanish (or reprint) at midnight.
describe("torontoDayStartIso", () => {
  it("dayStartHour=7: an order at 2am Toronto still sits in YESTERDAY's window", () => {
    // 2026-08-02T02:30 Toronto = 06:30 UTC (EDT, -04:00)
    const at2am = new Date("2026-08-02T06:30:00Z");
    expect(torontoToday(at2am, 7)).toBe("2026-08-01");
    expect(torontoDayStartIso(at2am, 7)).toBe("2026-08-01T07:00:00-04:00");
  });

  it("dayStartHour=7: after 7am the window rolls to the new day", () => {
    // 2026-08-02T08:00 Toronto = 12:00 UTC
    const at8am = new Date("2026-08-02T12:00:00Z");
    expect(torontoDayStartIso(at8am, 7)).toBe("2026-08-02T07:00:00-04:00");
  });

  it("the 7am boundary itself opens the new day", () => {
    const at7am = new Date("2026-08-02T11:00:00Z"); // 07:00 Toronto
    expect(torontoDayStartIso(at7am, 7)).toBe("2026-08-02T07:00:00-04:00");
    const at659 = new Date("2026-08-02T10:59:00Z"); // 06:59 Toronto
    expect(torontoDayStartIso(at659, 7)).toBe("2026-08-01T07:00:00-04:00");
  });

  it("dayStartHour=0 (default tenant) is plain Toronto midnight", () => {
    const at2am = new Date("2026-08-02T06:30:00Z");
    expect(torontoDayStartIso(at2am, 0)).toBe("2026-08-02T00:00:00-04:00");
  });

  it("winter dates carry the EST offset, not EDT", () => {
    // 2026-01-15T09:00 Toronto = 14:00 UTC (EST, -05:00)
    const winter = new Date("2026-01-15T14:00:00Z");
    expect(torontoDayStartIso(winter, 7)).toBe("2026-01-15T07:00:00-05:00");
  });
});
