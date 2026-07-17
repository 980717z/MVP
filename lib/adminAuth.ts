import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";

// Shared gate for /api/admin/* routes. Verifies the caller's Supabase JWT and
// checks the email against ADMIN_EMAILS (comma-separated env, case-insensitive).
// Fails CLOSED when ADMIN_EMAILS is unset. Returns the service-role client +
// the caller's uid/email on success, or a ready-to-return NextResponse.

export type AdminAuth =
  | { ok: true; db: SupabaseClient; userId: string; email: string }
  | { ok: false; res: NextResponse };

export async function requireAdmin(req: Request): Promise<AdminAuth> {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (admins.length === 0) return { ok: false, res: NextResponse.json({ ok: false, error: "not configured" }, { status: 503 }) };

  const db = supabaseAdmin();
  if (!db) return { ok: false, res: NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 }) };

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };

  const { data: auth, error } = await db.auth.getUser(jwt);
  const email = auth?.user?.email?.toLowerCase();
  const userId = auth?.user?.id;
  if (error || !email || !userId) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (!admins.includes(email)) return { ok: false, res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };

  return { ok: true, db, userId, email };
}
