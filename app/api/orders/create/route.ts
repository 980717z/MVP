import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateOrderItems } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { DELIVERY_MIN_SUBTOTAL, type OrderType } from "@/lib/tax";
import type { OrderItem, OrderAddress } from "@/lib/orders";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/orders/create  { slug, items, table_no?, phone?, note?,
//                              order_type?, address?, customer_email? }
//  Server-authoritative order creation: NEVER trust the client's per-item
//  price or total. Reprices every line against the live menu here, before
//  the row ever reaches the database. `orders` no longer grants anon INSERT
//  directly (see supabase/orders-lockdown.sql) — this route is the only way
//  in, using the service-role key to write the validated row.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  if (!rateLimit(`order:ip:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }

  let d: {
    slug?: string;
    items?: OrderItem[];
    table_no?: string;
    phone?: string;
    note?: string;
    order_type?: OrderType;
    address?: OrderAddress;
    customer_email?: string;
  };
  try {
    d = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const slug = (d.slug ?? "").trim().slice(0, 60);
  if (!slug) return NextResponse.json({ ok: false, error: "缺少店铺信息" }, { status: 400 });

  const { data: tenant } = await db.from("tenants").select("slug").eq("slug", slug).maybeSingle();
  if (!tenant) return NextResponse.json({ ok: false, error: "店铺不存在" }, { status: 404 });

  const { data: menu, error: menuErr } = await db.from("menu_items").select("*").eq("tenant_slug", slug);
  if (menuErr) return NextResponse.json({ ok: false, error: "菜单读取失败" }, { status: 500 });

  const rp = validateOrderItems(d.items ?? [], (menu ?? []) as any);
  if (!rp.ok || !rp.items || rp.subtotal == null) {
    return NextResponse.json({ ok: false, error: rp.error ?? "订单校验失败" }, { status: 400 });
  }

  const order_type: OrderType = d.order_type ?? "dine_in";
  if (order_type === "delivery" && rp.subtotal < DELIVERY_MIN_SUBTOTAL) {
    return NextResponse.json({ ok: false, error: `配送需满 $${DELIVERY_MIN_SUBTOTAL}，当前 $${rp.subtotal.toFixed(2)}` }, { status: 400 });
  }
  if (order_type !== "dine_in" && rp.items.some((it) => it.market)) {
    return NextResponse.json({ ok: false, error: "时价菜品暂不支持外卖/自取在线支付" }, { status: 400 });
  }

  const { data: inserted, error } = await db
    .from("orders")
    .insert({
      tenant_slug: slug,
      items: rp.items,
      total: rp.subtotal,
      table_no: order_type === "dine_in" ? (d.table_no ?? "").slice(0, 20) : "",
      // phone is NOT NULL + must match orders_phone_chk (10-digit / +intl / 'N/A').
      phone: (d.phone ?? "").trim() || "N/A",
      note: (d.note ?? "").slice(0, 500),
      order_type,
      address: d.address ?? null,
      customer_email: d.customer_email?.trim().slice(0, 200) || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[orders/create]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: inserted.id });
}
