import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hoursStatus, type Hours } from "@/lib/hours";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/pickup/hours?slug=<tenant> — is the truck open, and until when?
//  Powers the menu's closed banner + the time-picker min/max. campus_vendors
//  has no anon SELECT (public reads go through the directory RPC), so this
//  reads via the service role and returns only the non-sensitive schedule
//  facts. Vendors without configured hours report unconfigured=true and are
//  never gated (non-campus tenants unaffected).
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

  const db = supabaseAdmin();
  // Fail OPEN on missing config/errors: hours are a courtesy gate, and a
  // broken gate must never block ordering outright.
  if (!db) return NextResponse.json({ ok: true, open: true, unconfigured: true, opensAt: null, closesAt: null });

  const { data } = await db.from("campus_vendors").select("hours").eq("tenant_slug", slug).maybeSingle();
  const s = hoursStatus((data?.hours ?? null) as Hours | null, new Date());
  return NextResponse.json({ ok: true, ...s });
}
