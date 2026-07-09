import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cloverCharge, cloverConfigured } from "@/lib/clover";
import { repriceOrder, toCents } from "@/lib/payments";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pay/charge  { orderId, token }
//  Pay-first for togo/delivery. The card is tokenized client-side by clover.js
//  (public key) into `token`; here the server:
//    1. loads the order (service-role — customers can't read orders),
//    2. RE-PRICES from the live menu (never trusts the client/stored amount),
//    3. charges Clover synchronously (private key), and
//    4. marks the order paid → the DB payment-gate releases it to the kitchen.
//  Money settles to the merchant's own Clover MID; BentoOS never holds funds.
//  Spike/architecture: docs/clover-spike.md
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!cloverConfigured()) return NextResponse.json({ ok: false, error: "在线支付尚未开通" }, { status: 503 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  let body: { orderId?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const orderId = (body.orderId ?? "").trim();
  const token = (body.token ?? "").trim();
  if (!orderId || !token) return NextResponse.json({ ok: false, error: "缺少订单或卡信息" }, { status: 400 });

  // 1) load the order
  const { data: order, error: oe } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (oe || !order) return NextResponse.json({ ok: false, error: "订单不存在" }, { status: 404 });
  if (order.order_type !== "togo" && order.order_type !== "delivery") {
    return NextResponse.json({ ok: false, error: "该订单无需在线支付" }, { status: 400 });
  }
  // idempotent: already paid → success, never double-charge
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  // 2) re-price from the authoritative menu
  const { data: menu } = await db.from("menu_items").select("*").eq("tenant_slug", order.tenant_slug);
  const rp = repriceOrder(order.items, (menu ?? []) as any, order.order_type);
  if (!rp.ok || !rp.pricing) {
    return NextResponse.json({ ok: false, error: rp.error ?? "订单计价失败" }, { status: 400 });
  }

  // 3) charge synchronously (idempotencyKey dedupes an accidental double-submit)
  const charge = await cloverCharge({
    amountCents: toCents(rp.pricing.grandTotal),
    token,
    description: `BentoOS ${order.tenant_slug} #${orderId.slice(0, 8)}`,
    email: order.customer_email ?? undefined,
    idempotencyKey: orderId,
  });
  if (!charge.ok) {
    return NextResponse.json({ ok: false, error: charge.error ?? "支付失败，请重试或换一张卡" }, { status: 402 });
  }

  // 4) mark paid — CAS on payment_status so a concurrent request can't double-write.
  //    Setting paid_at + payment_status='paid' is what the DB gate needs to let
  //    the order reach the kitchen/printer.
  const { error: ue } = await db
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: "online",
      paid_at: new Date().toISOString(),
      clover_checkout_id: charge.chargeId,
      subtotal: rp.pricing.subtotal,
      gst: rp.pricing.gst,
      pst: rp.pricing.pst,
      tip: rp.pricing.tip,
      total: rp.pricing.grandTotal,
    })
    .eq("id", orderId)
    .neq("payment_status", "paid");
  if (ue) {
    // Charged at Clover but the DB write failed — surface for manual reconcile.
    // The idempotencyKey means a client retry re-uses the same charge, not a new one.
    console.error("[pay/charge] CHARGED but order update failed:", orderId, charge.chargeId, ue.message);
    return NextResponse.json({ ok: true, chargeId: charge.chargeId, warn: "paid_sync_pending" });
  }

  return NextResponse.json({
    ok: true,
    chargeId: charge.chargeId,
    brand: charge.brand,
    last4: charge.last4,
    amount: rp.pricing.grandTotal,
  });
}
