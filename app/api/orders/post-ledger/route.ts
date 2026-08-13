import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { postOrderSales, recordOrderSale, adjustOrderSale, deleteOrderSale, syncMemberFromOrder } from "@/lib/store";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/orders/post-ledger   Authorization: Bearer <supabase JWT>
//
//  Order fulfillment (OrdersPortal completing an order, merging two orders,
//  OrderEditor adding items to a completed order, group-booking syncing a
//  member) writes to `records` (sales / dish-margin / members) via
//  lib/store.ts, using the STAFF's own browser session. That write is
//  operational — it happens automatically as a side effect of fulfillment,
//  not a merchant manually editing content — but RLS can't tell the two
//  apart: both are the same authenticated user writing the same table
//  (see supabase/campus-lock.sql section 2 for the full writeup).
//
//  This route exists so campus's `records` lock (once enabled) can block the
//  "staff manually edits the members module" path without also blocking
//  order fulfillment: the caller is verified here as a real tenant member
//  (same check as app/api/table/checkout/route.ts), then the write runs
//  through supabaseAdmin — which bypasses RLS entirely — instead of the
//  caller's own session. Auth/authorization happens IN THIS ROUTE, not via
//  RLS, so this must stay narrowly scoped to exactly these ledger writes;
//  it is not a general-purpose bypass.
// ─────────────────────────────────────────────────────────────────────────

type Item = { name_zh: string; qty: number; price: number | null };

type Body =
  | { slug?: string; action?: "complete"; orderId?: string; total?: number; items?: Item[]; phone?: string }
  | { slug?: string; action?: "merge"; targetId?: string; srcId?: string; total?: number; items?: Item[] }
  | { slug?: string; action?: "edit-add"; orderId?: string; total?: number; items?: Item[]; delta?: Item[] }
  | { slug?: string; action?: "group-booking"; phone?: string; customerName?: string; amount?: number };

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  const uid = auth?.user?.id;
  if (authErr || !uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

  // Caller must own or be a member of the tenant — same check as checkout/route.ts.
  const { data: tenant } = await db.from("tenants").select("owner_id").eq("slug", slug).maybeSingle();
  if (!tenant) return NextResponse.json({ ok: false, error: "商家不存在" }, { status: 404 });
  let allowed = tenant.owner_id === uid;
  if (!allowed) {
    const { data: m } = await db.from("members").select("member_id").eq("tenant_slug", slug).eq("member_id", uid).maybeSingle();
    allowed = !!m;
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  try {
    switch (body.action) {
      case "complete": {
        const items = body.items ?? [];
        const total = Number(body.total) || 0;
        const orderId = (body.orderId ?? "").trim();
        if (!orderId) return NextResponse.json({ ok: false, error: "missing orderId" }, { status: 400 });
        await Promise.all([
          postOrderSales(slug, items, db),
          recordOrderSale(slug, { id: orderId, total, items, source: "qr" }, db),
          body.phone ? syncMemberFromOrder(slug, body.phone, "", total, db) : Promise.resolve(),
        ]);
        break;
      }
      case "merge": {
        const targetId = (body.targetId ?? "").trim();
        const srcId = (body.srcId ?? "").trim();
        const items = body.items ?? [];
        const total = Number(body.total) || 0;
        if (!targetId || !srcId) return NextResponse.json({ ok: false, error: "missing targetId/srcId" }, { status: 400 });
        await adjustOrderSale(slug, { id: targetId, total, items, source: "qr" }, db);
        await deleteOrderSale(slug, srcId, db);
        break;
      }
      case "edit-add": {
        const orderId = (body.orderId ?? "").trim();
        const items = body.items ?? [];
        const delta = body.delta ?? [];
        const total = Number(body.total) || 0;
        if (!orderId) return NextResponse.json({ ok: false, error: "missing orderId" }, { status: 400 });
        if (delta.length) await postOrderSales(slug, delta, db);
        await adjustOrderSale(slug, { id: orderId, total, items, source: "qr" }, db);
        break;
      }
      case "group-booking": {
        const phone = (body.phone ?? "").trim();
        if (!phone) return NextResponse.json({ ok: false, error: "missing phone" }, { status: 400 });
        await syncMemberFromOrder(slug, phone, body.customerName ?? "", Number(body.amount) || 0, db);
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[post-ledger]", e);
    return NextResponse.json({ ok: false, error: "ledger write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
