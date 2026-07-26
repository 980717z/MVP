import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cloverConfigured } from "@/lib/clover";
import { runChargeFlow, type OrderStore, type ChargeableOrder, type PaidFields } from "@/lib/chargeFlow";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import type { MenuItem } from "@/lib/menu";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pay/charge  { orderId, token, quotedCents? }
//  Pay-first for togo/delivery. The card is tokenized client-side by clover.js
//  (public key); the server re-prices, CAS-claims the order, charges Clover
//  synchronously (private key), and marks it paid → the DB gate releases it to
//  the kitchen. All the money-state logic lives in lib/chargeFlow (testable);
//  this route just wires the DB store + rate limit. Money settles to the
//  merchant's own Clover MID; BentoOS never holds funds.
//  Plan: ~/.gstack/projects/MVP/allen-main-payment-hardening-20260707.md
// ─────────────────────────────────────────────────────────────────────────

/** OrderStore over supabaseAdmin — every mutation is a CAS. */
function makeStore(db: NonNullable<ReturnType<typeof supabaseAdmin>>): OrderStore {
  return {
    async loadOrder(id) {
      const { data } = await db.from("orders").select("*").eq("id", id).maybeSingle();
      return (data as ChargeableOrder) ?? null;
    },
    async loadMenu(tenantSlug) {
      const { data } = await db.from("menu_items").select("*").eq("tenant_slug", tenantSlug);
      return (data ?? []) as MenuItem[];
    },
    async claimPending(id) {
      const { data } = await db
        .from("orders")
        .update({ payment_status: "pending" })
        .eq("id", id)
        .eq("payment_status", "unpaid")
        .select("id")
        .maybeSingle();
      return !!data;
    },
    async markPaid(id, fields: PaidFields) {
      const { data, error } = await db
        .from("orders")
        .update({ payment_status: "paid", ...fields })
        .eq("id", id)
        .eq("payment_status", "pending")
        .select("id")
        .maybeSingle();
      if (error) return false; // transient — runChargeFlow retries
      return !!data;
    },
    async resetUnpaid(id) {
      await db.from("orders").update({ payment_status: "unpaid" }).eq("id", id).eq("payment_status", "pending");
    },
    async markReconcile(id) {
      await db.from("orders").update({ payment_status: "reconcile_pending" }).eq("id", id).eq("payment_status", "pending");
    },
  };
}

export async function POST(req: Request) {
  if (!cloverConfigured()) return NextResponse.json({ ok: false, error: "在线支付尚未开通" }, { status: 503 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  if (!rateLimit(`charge:${clientIp(req)}`)) {
    return NextResponse.json({ ok: false, error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  let body: { orderId?: string; token?: string; quotedCents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const orderId = (body.orderId ?? "").trim();
  const token = (body.token ?? "").trim();
  const quotedCents = Number.isInteger(body.quotedCents) ? body.quotedCents : undefined;
  if (!orderId || !token) return NextResponse.json({ ok: false, error: "缺少订单或卡信息" }, { status: 400 });

  const { http, body: out } = await runChargeFlow({ orderId, token, quotedCents }, { store: makeStore(db) });
  if (out.pending && out.chargeId) {
    // Charged at Clover but not cleanly marked paid — surface for reconcile.
    console.error("[pay/charge] charge not cleanly settled:", orderId, out.chargeId);
  }
  return NextResponse.json(out, { status: http });
}
