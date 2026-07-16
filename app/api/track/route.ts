import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/track — anonymous traction beacon (see lib/track.ts).
//  Deny-by-default: only allowlisted event names, tight field caps, per-IP
//  rate limit. Inserts via the service role because the events table has
//  RLS with no policies (clients can never read or write it directly).
//  Always answers 204 quickly — a beacon endpoint must never make the
//  product wait or leak why an event was dropped.
// ─────────────────────────────────────────────────────────────────────────

const NAMES = new Set(["campus_page_view", "directory_view", "vendor_card_tap", "menu_view", "order_placed"]);
const SRCS = new Set(["", "qr", "pickup", "togo", "directory", "embed", "staff", "direct"]);
const SLUG_RE = /^[a-z0-9-]{0,30}$/;

const ok = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  // Generous for humans, hostile to loops: a real visitor fires a handful of
  // events per minute; 60/min per IP caps runaway scripts without ever
  // dropping legit traffic. (Per-instance limiter — see lib/rateLimit.ts.)
  if (!rateLimit(`track:${clientIp(req)}`, 60, 60_000)) return ok();

  let b: { name?: string; tenant?: string; path?: string; src?: string; sid?: string; meta?: unknown };
  try {
    b = await req.json();
  } catch {
    return ok();
  }

  const name = String(b.name ?? "");
  if (!NAMES.has(name)) return ok();
  const tenant = String(b.tenant ?? "").slice(0, 30);
  if (!SLUG_RE.test(tenant)) return ok();
  const src = String(b.src ?? "");
  const meta = b.meta && typeof b.meta === "object" && !Array.isArray(b.meta) ? b.meta : {};
  if (JSON.stringify(meta).length > 500) return ok();

  const db = supabaseAdmin();
  if (!db) return ok(); // not configured — silently drop, never error the client

  await db.from("events").insert({
    name,
    tenant_slug: tenant,
    path: String(b.path ?? "").slice(0, 120),
    src: SRCS.has(src) ? src : "",
    session_hash: String(b.sid ?? "").slice(0, 32),
    meta,
  });
  return ok();
}
