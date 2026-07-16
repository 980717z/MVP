// Campus marketplace ("what to eat today") — client data layer for /eat.
// Reads the public directory through the get_campus_directory RPC (anon-safe,
// effective status computed server-side). See supabase/campus-vendors.sql.
import { supabase } from "@/lib/supabase";
import type { Bi } from "@/lib/catalog";

export type EffectiveStatus = "open" | "busy" | "sold_out" | "closed";
export type BusyBand = "short" | "long" | null;

// Weekly hours: America/Toronto local "HH:MM" ranges; empty array = closed.
export type Hours = Record<string, [string, string][]>;

export type CampusVendor = {
  slug: string;
  name: Bi;                       // { zh, en, fr? } from tenants.name
  zone: string;
  cuisine_tags: string[];
  dietary_tags: string[];         // 'halal','veg',...
  price_band: "$" | "$$" | "$$$";
  special: Bi | null;
  lat: number | null;
  lng: number | null;
  payment_mode: "order_only" | "pay_first";
  effective_status: EffectiveStatus;
  busy_band: BusyBand;
  hours: Hours;
  status_updated_at: string;
};

export const DEFAULT_CAMPUS = "uoft-stgeorge";

/**
 * Fetch the live campus directory. Returns null on error so the caller can keep
 * last-good data + show retry (empty [] is a legit "zero listed" state, distinct
 * from a failed fetch).
 */
export async function listCampusDirectory(campus = DEFAULT_CAMPUS): Promise<CampusVendor[] | null> {
  const { data, error } = await supabase.rpc("get_campus_directory", { p_campus: campus });
  if (error) {
    console.error("listCampusDirectory", error.message);
    return null;
  }
  return (data ?? []) as CampusVendor[];
}

// ── walk-time (opt-in geolocation, D3) ──────────────────────────────────────
// Haversine metres between two lat/lng points.
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough walk minutes at ~80 m/min; null if either point is missing. */
export function walkMinutes(
  from: { lat: number; lng: number } | null,
  v: { lat: number | null; lng: number | null },
): number | null {
  if (!from || v.lat == null || v.lng == null) return null;
  return Math.max(1, Math.round(metresBetween(from.lat, from.lng, v.lat, v.lng) / 80));
}

// ── "Opens 8:00 AM" for closed vendors (client-side, from hours) ────────────
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Next opening time as a short local label (e.g. "8:00 AM"), or null if none upcoming this week. */
export function nextOpenLabel(hours: Hours, now = new Date()): string | null {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (let ahead = 0; ahead < 7; ahead++) {
    const dow = DOW[(now.getDay() + ahead) % 7];
    const ranges = hours?.[dow] ?? [];
    for (const [open] of ranges) {
      const [h, m] = open.split(":").map(Number);
      const openMins = h * 60 + m;
      if (ahead > 0 || openMins > nowMins) {
        const label = fmtTime(h, m);
        return ahead === 0 ? label : ahead === 1 ? `tomorrow ${label}` : `${cap(dow)} ${label}`;
      }
    }
  }
  return null;
}

function fmtTime(h: number, m: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}:00 ${ampm}` : `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
