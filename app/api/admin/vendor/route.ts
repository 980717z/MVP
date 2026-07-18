import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  /api/admin/vendor — read + edit a vendor's campus_vendors listing row.
//  Admin-gated (requireAdmin). Replaces the SQL-only listing flow: flip
//  `listed`, set hours (which also drive the pickup ordering gate), zone,
//  dietary/cuisine tags, price band, and manual open/busy/closed status.
//
//  GET  ?slug=<tenant>        → { ok, vendor: {…campus fields…} | null }
//  PUT  { slug, patch:{…} }   → { ok }   (upsert; validates every field)
// ─────────────────────────────────────────────────────────────────────────

const STATUS = new Set(["open", "busy", "closed"]);
const PRICE = new Set(["$", "$$", "$$$"]);
const DIETARY = new Set(["halal", "veg", "vegan", "gf"]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const FIELDS = "tenant_slug, listed, campus, zone, hours, cuisine_tags, dietary_tags, price_band, status, busy_band, special, status_updated_at";

/** Validate the weekly hours object: { mon: [["11:00","20:00"]], … }. Returns
 *  a cleaned copy or null if malformed (reject rather than store garbage that
 *  would silently mis-gate ordering). */
function cleanHours(raw: unknown): Record<string, [string, string][]> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, [string, string][]> = {};
  for (const [day, ranges] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAYS.has(day) || !Array.isArray(ranges)) return null;
    const clean: [string, string][] = [];
    for (const r of ranges) {
      if (!Array.isArray(r) || r.length !== 2) return null;
      const [a, b] = r as [unknown, unknown];
      if (typeof a !== "string" || typeof b !== "string" || !HHMM.test(a) || !HHMM.test(b) || b <= a) return null;
      clean.push([a, b]);
    }
    out[day] = clean;
  }
  return out;
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });
  const { data } = await gate.db.from("campus_vendors").select(FIELDS).eq("tenant_slug", slug).maybeSingle();
  return NextResponse.json({ ok: true, vendor: data ?? null });
}

export async function PUT(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  let body: { slug?: string; patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  const p = body.patch ?? {};
  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

  // Build a validated patch — only known fields, each checked. Anything the
  // client sends outside this whitelist is ignored.
  const patch: Record<string, unknown> = {};
  if ("listed" in p) patch.listed = !!p.listed;
  if ("zone" in p) patch.zone = String(p.zone ?? "").slice(0, 40);
  if ("price_band" in p) {
    if (!PRICE.has(String(p.price_band))) return NextResponse.json({ ok: false, error: "bad price_band" }, { status: 400 });
    patch.price_band = p.price_band;
  }
  if ("status" in p) {
    if (!STATUS.has(String(p.status))) return NextResponse.json({ ok: false, error: "bad status" }, { status: 400 });
    patch.status = p.status;
    // busy_band only meaningful while busy; clear it otherwise.
    patch.busy_band = p.status === "busy" ? (p.busy_band === "long" ? "long" : "short") : null;
  }
  if ("dietary_tags" in p) {
    const arr = Array.isArray(p.dietary_tags) ? p.dietary_tags.map(String).filter((t) => DIETARY.has(t)) : [];
    patch.dietary_tags = [...new Set(arr)];
  }
  if ("cuisine_tags" in p) {
    const arr = Array.isArray(p.cuisine_tags) ? p.cuisine_tags.map((t) => String(t).trim().toLowerCase().slice(0, 24)).filter(Boolean) : [];
    patch.cuisine_tags = [...new Set(arr)].slice(0, 8);
  }
  if ("hours" in p) {
    const h = cleanHours(p.hours);
    if (h === null) return NextResponse.json({ ok: false, error: "bad hours" }, { status: 400 });
    patch.hours = h;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "empty patch" }, { status: 400 });
  patch.status_updated_at = new Date().toISOString();

  // Upsert so a vendor whose row is somehow missing still lists cleanly.
  // `campus` is deliberately NOT in the payload: on conflict, Supabase updates
  // every column it's given, so including it would rewrite campus on EVERY save
  // and silently drag a vendor back to St. George once a second campus exists
  // (eng review T5). New rows get the column's default instead.
  const { error } = await gate.db
    .from("campus_vendors")
    .upsert({ tenant_slug: slug, ...patch }, { onConflict: "tenant_slug" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
