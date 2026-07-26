import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cloverRefund, cloverConfigured } from "@/lib/clover";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pay/refund  { orderId }   Authorization: Bearer <supabase JWT>
//  Staff refunds a PAID togo/delivery order (the cancel-of-paid path — a paid
//  order can be cancelled, so its money must be returned). Verifies the caller
//  can access the tenant (owner or member), CAS-claims paid→refunded so only
//  one caller refunds, then calls Clover. If Clover fails, reverts to paid so
//  DB state never claims a refund that didn't happen.
//  Refund settles back to the diner's card from the merchant's own MID.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!cloverConfigured()) return NextResponse.json({ ok: false, error: "在线支付尚未开通" }, { status: 503 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // 1) authenticate the caller
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  const uid = auth?.user?.id;
  if (authErr || !uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let bodyIn: { orderId?: string };
  try {
    bodyIn = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const orderId = (bodyIn.orderId ?? "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "缺少订单" }, { status: 400 });

  // 2) load the order
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: "订单不存在" }, { status: 404 });

  // 3) caller must own or be a member of the tenant
  const { data: tenant } = await db.from("tenants").select("owner_id").eq("slug", order.tenant_slug).maybeSingle();
  let allowed = tenant?.owner_id === uid;
  if (!allowed) {
    const { data: m } = await db
      .from("members")
      .select("member_id")
      .eq("tenant_slug", order.tenant_slug)
      .eq("member_id", uid)
      .maybeSingle();
    allowed = !!m;
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // 4) only a paid order with a charge can be refunded
  if (order.payment_status === "refunded") return NextResponse.json({ ok: true, alreadyRefunded: true });
  if (order.payment_status !== "paid" || !order.clover_checkout_id) {
    return NextResponse.json({ ok: false, error: "该订单未在线支付，无需退款" }, { status: 400 });
  }

  // 5) CAS-claim paid→refunded so a double-tap can't double-refund
  const { data: claimed } = await db
    .from("orders")
    .update({ payment_status: "refunded" })
    .eq("id", orderId)
    .eq("payment_status", "paid")
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ ok: true, alreadyRefunded: true }); // someone else won the claim

  // 6) refund at Clover; revert on failure so state matches reality
  const r = await cloverRefund(order.clover_checkout_id);
  if (!r.ok) {
    await db.from("orders").update({ payment_status: "paid" }).eq("id", orderId).eq("payment_status", "refunded");
    return NextResponse.json({ ok: false, error: r.error ?? "退款失败，请重试" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
