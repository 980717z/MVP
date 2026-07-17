import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { isValidSlug } from "@/lib/qrContract";
import { buildProvisionSql, type TenantTemplate } from "@/lib/tenantTemplate";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  /api/admin/provision — vendor onboarding for the platform owner.
//
//  Provisioning stays REVIEWABLE-SQL-ONLY by design (QR-lock model): this
//  route does NOT write tenants directly. It validates the slug and returns
//  the exact idempotent SQL to paste into Supabase → SQL Editor. That kills
//  the CLI (vite-node) friction without bypassing the review gate, and keeps
//  the load-bearing QR contract (printed signs → /menu/<slug>) safe: a slug is
//  chosen once, reviewed, and never renamed.
//
//  The new vendor is owned by the requesting admin (campus trucks are free and
//  operator-run); the truck's own staff get back-office access via a members
//  invite later. Provisioning also seeds a campus_vendors row with listing OFF
//  (opt-in), so it shows in /admin but not on /eat until they choose to list.
//
//  GET  ?check=<slug>  → { ok, available, reason? }   (live handle validation)
//  POST { name_en, name_zh?, slug, zone?, ownerEmail? } → { ok, sql, menuUrl }
// ─────────────────────────────────────────────────────────────────────────

// Blank campus-truck starter: same shape as templates/demo-truck.json, but no
// demo dishes — the vendor adds their own menu. Categories are editable later.
const CAMPUS_TRUCK_TEMPLATE: TenantTemplate = {
  version: 1,
  type: "food-truck",
  label: { zh: "校园餐车（订餐-取餐 · 无桌码）", en: "Campus food truck (order-ahead pickup, no tables)" },
  modules: ["menu-generator", "qr-menu", "online-orders", "members"],
  tables: [],
  categories: ["招牌", "小食", "饮品"],
  delivery_fsas: [],
  hours: "11:00-20:00",
  menu: [],
};

async function slugTaken(db: import("@supabase/supabase-js").SupabaseClient, slug: string): Promise<boolean> {
  const { data } = await db.from("tenants").select("slug").eq("slug", slug).maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const slug = (new URL(req.url).searchParams.get("check") ?? "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ ok: true, available: false, reason: "empty" });
  const v = isValidSlug(slug);
  if (!v.ok) return NextResponse.json({ ok: true, available: false, reason: v.reason }); // "format" | "reserved"
  if (await slugTaken(gate.db, slug)) return NextResponse.json({ ok: true, available: false, reason: "taken" });
  return NextResponse.json({ ok: true, available: true });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  let b: { name_en?: string; name_zh?: string; slug?: string; zone?: string; ownerEmail?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const slug = (b.slug ?? "").trim().toLowerCase();
  const nameEn = (b.name_en ?? "").trim();
  const nameZh = (b.name_zh ?? "").trim();
  const zone = (b.zone ?? "").trim().slice(0, 40);
  const displayName = nameZh || nameEn; // name_zh is the required identity; fall back to EN

  if (!displayName) return NextResponse.json({ ok: false, error: "缺少店名 / shop name required" }, { status: 400 });
  const v = isValidSlug(slug);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.reason === "reserved" ? "handle is a reserved word" : "handle must be 3–30 chars, a–z 0–9 and hyphens" }, { status: 400 });
  if (await slugTaken(gate.db, slug)) return NextResponse.json({ ok: false, error: "handle already in use" }, { status: 409 });

  let sql: string;
  try {
    sql = buildProvisionSql(CAMPUS_TRUCK_TEMPLATE, {
      slug,
      name_zh: displayName,
      name_en: nameEn || undefined,
      owner_id: gate.userId, // admin owns campus trucks; invite the vendor's staff later
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not build SQL" }, { status: 400 });
  }

  // Seed the campus directory row (listing OFF — opt-in). Appended after the
  // tenant insert the builder emits, so the FK to tenants(slug) is satisfied.
  const zLit = zone.replace(/'/g, "''");
  const sLit = slug.replace(/'/g, "''");
  sql +=
    `\n-- Campus directory row (listing OFF until the vendor opts in)\n` +
    `insert into public.campus_vendors (tenant_slug, campus, zone, listed)\n` +
    `values ('${sLit}', 'uoft-stgeorge', '${zLit}', false)\n` +
    `on conflict (tenant_slug) do update set zone = excluded.zone;\n`;

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    sql,
    slug,
    menuUrl: `${origin}/menu/${slug}`,
    backOfficeUrl: `${origin}/${slug}`,
    ownerEmail: (b.ownerEmail ?? "").trim(),
  });
}
