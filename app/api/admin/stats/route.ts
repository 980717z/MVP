import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/admin/stats   Authorization: Bearer <supabase JWT>
//  Platform-owner traction aggregates for /admin. Gated by ADMIN_EMAILS
//  (comma-separated env, case-insensitive) — fails CLOSED when unset.
//  All heavy lifting happens here with the service role; the client only
//  ever sees aggregates, never raw rows.
//
//  GMV split note: dine-in QR rounds settle into table_sessions at 结账, so
//  summing orders + sessions would double-count dine-in. Online GMV = done
//  togo/delivery/pickup orders; dine GMV = table_sessions.
//
//  Aggregation is in-process over bounded 30-day selects — fine at current
//  scale (single-digit tenants). Move to a SQL RPC if events outgrow ~50k/30d.
// ─────────────────────────────────────────────────────────────────────────

const DAYS = 30;
const TZ = "America/Toronto";
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

// Non-customer traffic stays out of the funnel (landing iframe, staff order entry).
const FUNNEL_EXCLUDE = new Set(["embed", "staff"]);

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { db } = gate;

  const now = Date.now();
  const sinceIso = new Date(now - DAYS * 86_400_000).toISOString();
  const since7 = now - 7 * 86_400_000;

  const [ordersQ, sessionsQ, eventsQ, tenantsQ, vendorsQ] = await Promise.all([
    db.from("orders").select("tenant_slug, total, status, order_type, created_at").gte("created_at", sinceIso).limit(5000),
    db.from("table_sessions").select("tenant_slug, total, closed_at").gte("closed_at", sinceIso).limit(5000),
    db.from("events").select("name, tenant_slug, src, ts, session_hash").gte("ts", sinceIso).limit(20000),
    db.from("tenants").select("slug, name"),
    db.from("campus_vendors").select("tenant_slug, listed, status_updated_at"),
  ]);

  type O = { tenant_slug: string; total: number; status: string; order_type: string; created_at: string };
  type S = { tenant_slug: string; total: number; closed_at: string };
  type E = { name: string; tenant_slug: string; src: string; ts: string; session_hash: string };
  const orders = (ordersQ.data ?? []) as O[];
  const sessions = (sessionsQ.data ?? []) as S[];
  const events = (eventsQ.data ?? []) as E[];
  const tenants = (tenantsQ.data ?? []) as { slug: string; name: { zh?: string; en?: string } | null }[];
  const vendors = (vendorsQ.data ?? []) as { tenant_slug: string; listed: boolean; status_updated_at: string }[];

  const in7 = (iso: string) => new Date(iso).getTime() >= since7;
  const live = orders.filter((o) => o.status !== "cancelled");
  const doneOnline = orders.filter((o) => o.status === "done" && o.order_type !== "dine_in");
  const sum = (xs: { total: number }[]) => Math.round(xs.reduce((s, x) => s + Number(x.total || 0), 0) * 100) / 100;

  // Funnel over the events capture layer (customer traffic only). menuSessions
  // dedupes by browser session so "views" hype doesn't inflate reach.
  const funnel = (cut: (iso: string) => boolean) => {
    const ev = events.filter((e) => cut(e.ts) && !FUNNEL_EXCLUDE.has(e.src));
    const by = (n: string) => ev.filter((e) => e.name === n);
    return {
      campus: by("campus_page_view").length,
      directory: by("directory_view").length,
      vendorTaps: by("vendor_card_tap").length,
      menuViews: by("menu_view").length,
      menuSessions: new Set(by("menu_view").map((e) => e.session_hash || Math.random())).size,
      ordersPlaced: by("order_placed").length,
    };
  };

  // Per-day series (Toronto calendar days), oldest → newest.
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(dayOf(new Date(now - i * 86_400_000).toISOString()));
  const daily = days.map((d) => ({
    date: d,
    orders: live.filter((o) => dayOf(o.created_at) === d).length,
    dineSessions: sessions.filter((s) => dayOf(s.closed_at) === d).length,
    menuViews: events.filter((e) => e.name === "menu_view" && !FUNNEL_EXCLUDE.has(e.src) && dayOf(e.ts) === d).length,
  }));

  // Per-vendor traction — doubles as the "who needs a check-in call" list.
  const listedBy = new Map(vendors.map((v) => [v.tenant_slug, v]));
  const perVendor = tenants.map((t) => {
    const vo = live.filter((o) => o.tenant_slug === t.slug);
    const lastOrder = vo.reduce<string | null>((m, o) => (!m || o.created_at > m ? o.created_at : m), null);
    return {
      slug: t.slug,
      name: t.name?.zh || t.name?.en || t.slug,
      orders7: vo.filter((o) => in7(o.created_at)).length,
      orders30: vo.length,
      dine30: sessions.filter((s) => s.tenant_slug === t.slug).length,
      menuViews7: events.filter((e) => e.name === "menu_view" && e.tenant_slug === t.slug && !FUNNEL_EXCLUDE.has(e.src) && in7(e.ts)).length,
      lastOrderAt: lastOrder,
      listed: listedBy.get(t.slug)?.listed ?? false,
    };
  }).sort((a, b) => b.orders7 - a.orders7 || b.orders30 - a.orders30);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date(now).toISOString(),
    // Setup-progress flag for the cold-start hero: a query error on `events`
    // means the table hasn't been created yet (supabase/events.sql not run).
    eventsTableExists: !eventsQ.error,
    kpis: {
      orders7: live.filter((o) => in7(o.created_at)).length,
      orders30: live.length,
      gmvOnline7: sum(doneOnline.filter((o) => in7(o.created_at))),
      gmvOnline30: sum(doneOnline),
      gmvDine7: sum(sessions.filter((s) => in7(s.closed_at))),
      gmvDine30: sum(sessions),
      tenants: tenants.length,
      listedVendors: vendors.filter((v) => v.listed).length,
    },
    funnel7: funnel((iso) => in7(iso)),
    funnel30: funnel(() => true),
    daily,
    vendors: perVendor,
  });
}
