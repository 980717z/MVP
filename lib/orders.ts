// ─────────────────────────────────────────────────────────────────────────
//  Orders data layer — public customers submit; tenant members read/manage.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { OrderType } from "./tax";
import { SHOP_TZ, shopYmd } from "./shopTime";

export interface OrderItem {
  id: string;
  name_zh: string;
  name_en: string;
  price: number | null;
  qty: number;
  /** 时价 dish: ordered without a visible price; staff enters the actual
   *  price before the order can be marked 完成. */
  market?: boolean;
}

export interface OrderAddress {
  street: string;
  unit?: string;
  city?: string; // e.g. "Toronto, ON" — printed on kitchen/delivery tickets
  postal: string;
  note?: string;
}

export interface Order {
  id: string;
  tenant_slug: string;
  items: OrderItem[];
  total: number;
  table_no: string;
  phone: string;
  note: string;
  status: "new" | "preparing" | "delivering" | "done" | "cancelled";
  created_at: string;
  // QR delivery + payments (supabase/orders-payment.sql)
  order_type: OrderType;
  payment_status: "unpaid" | "pending" | "paid" | "expired" | "refunded";
  payment_method: "" | "server" | "online";
  tip: number;
  subtotal: number | null; // server-written at re-price; null until then
  gst: number | null;
  pst: number | null;
  customer_email: string | null;
  address: OrderAddress | null;
  eta_minutes: number | null;
  paid_at: string | null;
  printed_at: string | null; // Epson Server Direct Print: null = needs printing
}

/** Customer submits an order (works for anon).
 *  Goes through /api/orders/create instead of inserting directly: the server
 *  reprices every line against the live menu and computes `total` itself —
 *  the client's price/total is never trusted (see supabase/orders-lockdown.sql,
 *  which revokes anon's direct INSERT on `orders` so this route is the only
 *  way in). */
export async function createOrder(
  slug: string,
  input: {
    items: OrderItem[];
    table_no?: string;
    phone?: string;
    note?: string;
    order_type?: OrderType;
    address?: OrderAddress;
    customer_email?: string;
  }
): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...input }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return { error: json.error || "下单失败" };
    return { id: json.id };
  } catch (e) {
    console.error("createOrder", e);
    return { error: "网络错误，请重试" };
  }
}

/** Start-of-today as an ISO timestamp in the shop's fixed timezone (Toronto),
 *  so the order window is stable for remote owners and across device clocks. */
function startOfTodayShopTz(): string {
  const now = new Date();
  const d = shopYmd(now); // "YYYY-MM-DD"
  const offPart = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TZ, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-04:00"
  const off = offPart?.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "-05:00";
  return `${d}T00:00:00${off}`;
}

/**
 * Orders for the live staff log. Bounded so the 8s poll stays cheap forever:
 * today's orders OR anything still active (never drops an unfinished order
 * after midnight), newest first, capped at 200.
 *
 * Throws on a real query error so callers can keep the last good list instead
 * of blanking the screen (empty result vs failure must be distinguishable).
 */
export async function listOrders(slug: string): Promise<Order[]> {
  const since = startOfTodayShopTz();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_slug", slug)
    .or(`created_at.gte.${since},status.in.(new,preparing)`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listOrders", error);
    throw new Error(error.message);
  }
  return (data ?? []) as Order[];
}

export async function setOrderStatus(id: string, status: Order["status"]): Promise<{ error?: string }> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) {
    console.error("setOrderStatus", error);
    return { error: error.message };
  }
  return {};
}

/** CAS-claim the transition INTO "done": only one caller wins, so sales/member
 *  posting runs exactly once even on double-tap or two staff devices. */
export async function claimOrderDone(id: string): Promise<{ claimed: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "done" })
    .eq("id", id)
    .neq("status", "done")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("claimOrderDone", error);
    return { claimed: false, error: error.message };
  }
  return { claimed: !!data };
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) console.error("deleteOrder", error);
}

/** Clear printed_at so the Epson re-prints this order on its next poll. */
export async function reprintOrder(id: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ printed_at: null }).eq("id", id);
  if (error) console.error("reprintOrder", error);
}

/** Staff: persist item prices (时价 entry at completion) + the recomputed total. */
export async function updateOrderItems(
  id: string,
  items: OrderItem[],
  total: number,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("orders").update({ items, total }).eq("id", id);
  if (error) {
    console.error("updateOrderItems", error);
    return { error: error.message };
  }
  return {};
}

export async function cancelOrderItem(id: string, itemIndex: number): Promise<void> {
  const { data, error: fetchErr } = await supabase.from("orders").select("items,total").eq("id", id).maybeSingle();
  if (fetchErr || !data) return;
  const items: (OrderItem & { cancelled?: boolean })[] = data.items ?? [];
  if (itemIndex < 0 || itemIndex >= items.length || items[itemIndex].cancelled) return;
  items[itemIndex] = { ...items[itemIndex], cancelled: true };
  const total = items
    .filter((it) => !it.cancelled)
    .reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
  const r2 = Math.round(total * 100) / 100;
  const { error } = await supabase.from("orders").update({ items, total: r2 }).eq("id", id);
  if (error) console.error("cancelOrderItem", error);
}
