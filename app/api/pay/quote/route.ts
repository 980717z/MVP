import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cloverConfigured } from "@/lib/clover";
import { repriceOrder, toCents } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import type { MenuItem } from "@/lib/menu";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pay/quote  { orderId }
//  Authoritative amount for the checkout sheet BEFORE it charges. The sheet
//  shows exactly `cents`, then sends it back as `quotedCents` on charge so the
//  server can guarantee it never bills more than the diner saw (quote-then-pay).
//  Same re-price as the charge route — one source of truth (lib/payments).
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!cloverConfigured()) return NextResponse.json({ ok: false, error: "在线支付尚未开通" }, { status: 503 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  if (!rateLimit(`quote:${clientIp(req)}`)) {
    return NextResponse.json({ ok: false, error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const orderId = (body.orderId ?? "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "缺少订单" }, { status: 400 });

  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  // Normalized with the charge route: don't leak which order ids exist.
  if (!order || (order.order_type !== "togo" && order.order_type !== "delivery")) {
    return NextResponse.json({ ok: false, error: "该订单无法在线支付" }, { status: 400 });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: false, error: "该订单已支付", alreadyPaid: true }, { status: 409 });
  }

  const { data: menu } = await db.from("menu_items").select("*").eq("tenant_slug", order.tenant_slug);
  const rp = repriceOrder(order.items, (menu ?? []) as MenuItem[], order.order_type);
  if (!rp.ok || !rp.pricing) {
    return NextResponse.json({ ok: false, error: rp.error ?? "订单计价失败" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    amount: rp.pricing.grandTotal,
    cents: toCents(rp.pricing.grandTotal),
    breakdown: {
      subtotal: rp.pricing.subtotal,
      gst: rp.pricing.gst,
      pst: rp.pricing.pst,
      tip: rp.pricing.tip,
      total: rp.pricing.grandTotal,
    },
  });
}
