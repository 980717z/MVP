// ─────────────────────────────────────────────────────────────────────────
//  Pickup / delivery scheduling slots, built on the per-weekday Hours shape
//  from lib/hours ({ "mon": [["11:00","21:00"]], ... }, America/Toronto local).
//  A tenant stores one Hours per channel: tenants.order_hours = { pickup, delivery }.
//
//  orderSlots() returns whether ASAP ("now") is available (shop open right now)
//  and the list of future 15-min slots from `leadMin` ahead, bounded by each
//  day's open ranges, across the next `horizonDays`. Pure (pass `now`) so it's
//  unit-testable and identical on client + server. Zero imports beyond lib/hours.
// ─────────────────────────────────────────────────────────────────────────
import { hoursStatus, type Hours } from "./hours";

export type { Hours };
export const TZ = "America/Toronto";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface OrderSlot {
  /** ISO instant for the slot (America/Toronto wall-clock resolved to UTC). */
  iso: string;
  /** Toronto HH:MM, e.g. "18:30". */
  hhmm: string;
  /** 0 = today, 1 = tomorrow, … (relative calendar day in Toronto). */
  dayOffset: number;
}

/** Empty/missing hours ⇒ not configured ⇒ treat channel as ALWAYS OPEN (never
 *  gate ordering on unconfigured hours; matches lib/hours' fail-open policy). */
export function hoursConfigured(hours: Hours | null | undefined): boolean {
  return !!hours && typeof hours === "object" && Object.values(hours).some((d) => (d ?? []).length > 0);
}

/** Calendar parts (year/month/day/weekday/minutes) of `d` in Toronto. */
function tzParts(d: Date): { y: number; mo: number; day: number; wk: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const h = Number(g("hour")) % 24;
  return { y: Number(g("year")), mo: Number(g("month")), day: Number(g("day")), wk: g("weekday").toLowerCase().slice(0, 3), minutes: h * 60 + Number(g("minute")) };
}

/** Toronto GMT offset (minutes, e.g. -240 for EDT) at instant `d`. */
function tzOffsetMin(d: Date): number {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-05:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(s);
  if (!m) return -300;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Resolve a Toronto wall-clock (calendar date `base` + minutes-past-midnight)
 *  to a real instant, correcting for the tz offset at that moment. */
function torontoInstant(base: Date, minutes: number): Date {
  const p = tzParts(base);
  const guessUTC = Date.UTC(p.y, p.mo - 1, p.day, Math.floor(minutes / 60), minutes % 60);
  // Offset at the guessed instant; DST edge cases are off by an hour at most and
  // never matter for coarse 15-min ordering slots.
  const off = tzOffsetMin(new Date(guessUTC));
  return new Date(guessUTC - off * 60000);
}

const rangesFor = (hours: Hours, wk: string): [number, number][] =>
  (hours[wk] ?? [])
    .map(([a, b]) => [toMin(a), toMin(b)] as [number | null, number | null])
    .filter((r): r is [number, number] => r[0] != null && r[1] != null && r[1] > r[0])
    .sort((x, y) => x[0] - y[0]);

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
};
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * @param hours    the channel's per-weekday ranges (pickup or delivery)
 * @param now      current instant
 * @param leadMin  earliest schedulable slot is this many minutes ahead (default 60)
 * @param stepMin  slot granularity (default 15)
 * @param horizonDays how many calendar days ahead to offer (default 7)
 */
export function orderSlots(
  hours: Hours | null | undefined,
  now: Date,
  { leadMin = 60, stepMin = 15, horizonDays = 7 }: { leadMin?: number; stepMin?: number; horizonDays?: number } = {},
): { asap: boolean; slots: OrderSlot[] } {
  const configured = hoursConfigured(hours);
  // ASAP is offered only when the shop is open right now (or hours unconfigured).
  const asap = configured ? hoursStatus(hours ?? null, now, TZ).open : true;

  const nowParts = tzParts(now);
  const earliest = nowParts.minutes + leadMin; // minutes-past-midnight TODAY, may exceed 1440
  const slots: OrderSlot[] = [];

  for (let off = 0; off < horizonDays; off++) {
    // Calendar day `off` days after today (Toronto): shift the instant by ~24h*off
    // then re-read its Toronto parts so DST shifts don't drift the date.
    const dayDate = new Date(now.getTime() + off * 86_400_000);
    const dp = tzParts(dayDate);
    const wkIdx = (DAY_KEYS.indexOf(nowParts.wk as (typeof DAY_KEYS)[number]) + off) % 7;
    const wk = DAY_KEYS[wkIdx];

    // Unconfigured hours ⇒ a single all-day window so slots still generate.
    const ranges = configured ? rangesFor(hours as Hours, wk) : [[0, 24 * 60] as [number, number]];
    for (const [openMin, closeMin] of ranges) {
      // Today (off 0): start no earlier than now+lead; later days: from open.
      let start = off === 0 ? Math.max(openMin, earliest) : openMin;
      start = Math.ceil(start / stepMin) * stepMin; // align to the grid
      for (let m = start; m < closeMin; m += stepMin) {
        slots.push({ iso: torontoInstant(dayDate, m).toISOString(), hhmm: fmt(m), dayOffset: off });
      }
    }
    if (slots.length >= 96) break; // safety cap (~a full day of 15-min slots)
  }
  return { asap, slots };
}
