// ─────────────────────────────────────────────────────────────────────────
//  Single source of truth for "what day/time is it at the shop". The shop
//  is fixed to Ontario (see lib/tax.ts) — deliberately NEVER the caller's own
//  clock. Two failure modes this replaces:
//    · `new Date().toISOString().slice(0, 10)` — pure UTC, flips to the next
//      calendar day in the early evening in America/Toronto (UTC-5/-4), not
//      at actual local midnight.
//    · `new Date().getFullYear()/getMonth()/getDate()` — the DEVICE's local
//      date, correct only if that device happens to be in the shop's own
//      timezone (never guaranteed for a remote owner or a staff phone with
//      its region set elsewhere).
// ─────────────────────────────────────────────────────────────────────────

export const SHOP_TZ = "America/Toronto";

function shopParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Shop-timezone YYYY-MM-DD for the given instant (defaults to now). */
export function shopYmd(d: Date = new Date()): string {
  const p = shopParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Shop-timezone HH:MM for the given instant (defaults to now). */
export function shopHm(d: Date = new Date()): string {
  const p = shopParts(d);
  return `${p.hour}:${p.minute}`;
}

/** Today's date (YYYY-MM-DD) at the shop, regardless of the caller's own
 *  clock/timezone. Prefer this over `new Date().toISOString().slice(0, 10)`
 *  or local getters anywhere "today" means the shop's business day. */
export function shopToday(): string {
  return shopYmd(new Date());
}

/** Add (or subtract, with a negative `days`) days from a YYYY-MM-DD string.
 *  Pure calendar arithmetic done entirely in UTC — never touches local-time
 *  getters/setters — so the result is identical no matter what timezone the
 *  code happens to run in, and never drifts across a DST boundary. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing dateStr. Same UTC-only
 *  arithmetic as addDays, for the same reason. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** "M/D HH:MM" in shop time, for an order timestamp shown to staff or printed
 *  on a kitchen ticket. Accepts an ISO string (e.g. `order.created_at`) or a
 *  Date. Critical on the server: Vercel's Node runtime defaults to UTC, so
 *  without this a printed ticket's time is the server's UTC clock, not the
 *  shop's — off by 4-5 hours from what's actually happening in the kitchen. */
export function shopMonthDayTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  // en-US (not en-CA): its numeric month/day are unpadded ("1/5"), matching
  // the previous `getMonth()+1`/`getDate()` output — en-CA zero-pads them.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}
