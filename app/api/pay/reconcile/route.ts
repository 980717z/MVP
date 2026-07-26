import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cloverConfigured, cloverFindPaidCharge, chargeNeedle } from "@/lib/clover";
import { repriceOrder, toCents } from "@/lib/payments";
import type { MenuItem } from "@/lib/menu";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  GET/POST /api/pay/reconcile
//  Auth (either): Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
//  a manual/external caller can send `x-reconcile-key: $RECONCILE_KEY`. The
//  secret is CRON_SECRET (preferred) or RECONCILE_KEY — set ONE.
//
//  The safety net for the synchronous charge. Two kinds of stuck orders:
//    • reconcile_pending — charge outcome was UNKNOWN (timeout/5xx).
//    • pending (stale)   — a charge that never resolved (client vanished, or
//                          mark-paid failed after a successful charge).
//  For each, ask Clover whether a charge actually landed (matched by the orderId
//  we embed in the charge description — because clover_checkout_id is null in
//  exactly the timeout case). Landed → mark paid. Not → release to unpaid.
//  Scheduled from vercel.json (GET); also POST-able from ops.
// ─────────────────────────────────────────────────────────────────────────

const STALE_PENDING_MS = 5 * 60_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.RECONCILE_KEY;
  if (!secret) return false;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return bearer === secret || req.headers.get("x-reconcile-key") === secret;
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET && !process.env.RECONCILE_KEY) {
    return NextResponse.json({ ok: false, error: "reconcile not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!cloverConfigured()) return NextResponse.json({ ok: false, error: "payments not configured" }, { status: 503 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  // reconcile_pending (any age) + pending older than the stale window.
  const { data: rows, error } = await db
    .from("orders")
    .select("*")
    .or(`payment_status.eq.reconcile_pending,and(payment_status.eq.pending,created_at.lt.${staleBefore})`)
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let paid = 0;
  let released = 0;
  const results: { id: string; action: string }[] = [];

  for (const order of rows ?? []) {
    const hit = await cloverFindPaidCharge(chargeNeedle(order.id));
    if (hit) {
      // Charge landed — re-price to fill the money columns, then CAS to paid.
      const { data: menu } = await db.from("menu_items").select("*").eq("tenant_slug", order.tenant_slug);
      const rp = repriceOrder(order.items, (menu ?? []) as MenuItem[], order.order_type);
      const priced = rp.ok && rp.pricing ? rp.pricing : null;
      const { data: upd } = await db
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "online",
          paid_at: new Date().toISOString(),
          clover_checkout_id: hit.id,
          ...(priced
            ? { subtotal: priced.subtotal, gst: priced.gst, pst: priced.pst, tip: priced.tip, total: priced.grandTotal }
            : { total: hit.amount / 100 }),
        })
        .eq("id", order.id)
        .in("payment_status", ["reconcile_pending", "pending"])
        .select("id")
        .maybeSingle();
      if (upd) {
        paid++;
        results.push({ id: order.id, action: "marked_paid" });
      }
      // sanity: if the landed charge amount disagrees with our re-price, flag it.
      if (priced && toCents(priced.grandTotal) !== hit.amount) {
        console.error("[reconcile] amount mismatch", order.id, "reprice", toCents(priced.grandTotal), "clover", hit.amount);
      }
    } else {
      // No charge found — safe to release for a fresh attempt.
      const { data: upd } = await db
        .from("orders")
        .update({ payment_status: "unpaid" })
        .eq("id", order.id)
        .in("payment_status", ["reconcile_pending", "pending"])
        .select("id")
        .maybeSingle();
      if (upd) {
        released++;
        results.push({ id: order.id, action: "released_unpaid" });
      }
    }
  }

  return NextResponse.json({ ok: true, scanned: (rows ?? []).length, paid, released, results });
}
