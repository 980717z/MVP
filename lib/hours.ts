// ─────────────────────────────────────────────────────────────────────────
//  Vendor hours — pure helpers over the campus_vendors.hours shape:
//    { "mon": [["11:00","20:00"]], "tue": [], ... }   (America/Toronto local)
//  Empty array = closed that day; missing/empty object = hours not configured
//  (treated as ALWAYS OPEN so non-campus tenants are never blocked).
//  Used by /api/pickup/create (validation), /api/pickup/hours (menu UI), and
//  unit tests. Zero imports — safe for server routes and client bundles.
// ─────────────────────────────────────────────────────────────────────────

export type Hours = Record<string, [string, string][]>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Minutes since local midnight in a timezone. */
function minutesInTz(date: Date, tz: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3);
  // en-CA can render midnight as "24"; normalize into 0..23.
  const h = Number(get("hour")) % 24;
  return { day, minutes: h * 60 + Number(get("minute")) };
}

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export interface HoursStatus {
  /** false only when hours ARE configured and `at` falls outside every range. */
  open: boolean;
  /** true when hours are missing/empty — callers should not gate on them. */
  unconfigured: boolean;
  /** Next opening time today ("11:00") when closed-before-open; null otherwise. */
  opensAt: string | null;
  /** End of the current (or next) range today ("20:00"); null when none. */
  closesAt: string | null;
}

/** Where `at` falls in the vendor's day. Day boundaries follow the calendar
 *  day in `tz` (food trucks don't span midnight; ranges are within one day). */
export function hoursStatus(hours: Hours | null | undefined, at: Date, tz = "America/Toronto"): HoursStatus {
  const ranges = ((): [number, number][] => {
    if (!hours || typeof hours !== "object") return [];
    const { day } = minutesInTz(at, tz);
    if (!DAY_KEYS.includes(day as (typeof DAY_KEYS)[number])) return [];
    return (hours[day] ?? [])
      .map(([a, b]) => [toMin(a), toMin(b)] as [number | null, number | null])
      .filter((r): r is [number, number] => r[0] != null && r[1] != null && r[1] > r[0]);
  })();

  const anyConfigured = !!hours && Object.values(hours).some((d) => (d ?? []).length > 0);
  if (!anyConfigured) return { open: true, unconfigured: true, opensAt: null, closesAt: null };

  const { minutes } = minutesInTz(at, tz);
  for (const [a, b] of ranges) {
    if (minutes >= a && minutes < b) return { open: true, unconfigured: false, opensAt: null, closesAt: toHHMM(b) };
  }
  // Closed now: find the next range later today (for "opens at HH:MM").
  const next = ranges.filter(([a]) => a > minutes).sort((x, y) => x[0] - y[0])[0];
  return {
    open: false,
    unconfigured: false,
    opensAt: next ? toHHMM(next[0]) : null,
    closesAt: next ? toHHMM(next[1]) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Pickup ordering gate — the single "may this order be placed?" decision.
//  Extracted from /api/pickup/create so it is unit-testable: it is the most
//  safety-critical branch in the campus flow (get it wrong and students either
//  can't order from an open truck, or order food from a closed one that never
//  gets cooked). Pure: no DB, no clock of its own — pass `now`.
// ─────────────────────────────────────────────────────────────────────────

/** How far ahead a student may schedule a pickup, and how much slack we allow
 *  behind `now` (a tab that sat open for a minute mid-checkout shouldn't fail). */
export const PICKUP_MAX_AHEAD_MS = 12 * 3_600_000;
export const PICKUP_PAST_SLACK_MS = 5 * 60_000;

export type PickupGateResult =
  | { ok: true; requestedPickupAt: string | null }
  | { ok: false; reason: "bad_time" | "closed_now" | "closed_at_time"; error: string };

/**
 * Decide whether a pickup order may be placed.
 *   - `pickupAt` absent/null  → ASAP: the truck must be open right now.
 *   - `pickupAt` set          → scheduled: the time must parse, sit inside
 *                               [now − 5min, now + 12h], AND land in an open window.
 * Unconfigured hours never gate (non-campus tenants have no hours row).
 * Returns the normalized ISO timestamp so the caller doesn't re-parse.
 */
export function pickupGate(
  hours: Hours | null | undefined,
  pickupAt: string | null | undefined,
  now: Date,
  tz = "America/Toronto",
): PickupGateResult {
  let requestedPickupAt: string | null = null;

  if (pickupAt) {
    const t = Date.parse(pickupAt);
    if (Number.isNaN(t) || t < now.getTime() - PICKUP_PAST_SLACK_MS || t > now.getTime() + PICKUP_MAX_AHEAD_MS) {
      return { ok: false, reason: "bad_time", error: "取餐时间无效，请重新选择 / Pickup time is invalid — please pick again" };
    }
    requestedPickupAt = new Date(t).toISOString();
  }

  const nowStatus = hoursStatus(hours, now, tz);
  if (nowStatus.unconfigured) return { ok: true, requestedPickupAt };

  if (requestedPickupAt) {
    if (!hoursStatus(hours, new Date(requestedPickupAt), tz).open) {
      return {
        ok: false,
        reason: "closed_at_time",
        error: nowStatus.open && nowStatus.closesAt
          ? `当天营业到 ${nowStatus.closesAt}，请选早一点的时间 / The truck closes at ${nowStatus.closesAt} — pick an earlier time`
          : "该时间不在营业时间内 / That time is outside today's hours",
      };
    }
    return { ok: true, requestedPickupAt };
  }

  if (!nowStatus.open) {
    return {
      ok: false,
      reason: "closed_now",
      error: nowStatus.opensAt
        ? `现在打烊了，${nowStatus.opensAt} 开门 / Closed right now — opens at ${nowStatus.opensAt}`
        : "今天已打烊 / Closed for today",
    };
  }
  return { ok: true, requestedPickupAt: null };
}
