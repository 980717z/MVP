// ─────────────────────────────────────────────────────────────────────────
//  Orders data layer — public customers submit; tenant members read/manage.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { OrderType } from "./tax";

export interface OrderItem {
  id: string;
  name_zh: string;
  name_en: string;
  price: number | null;
  qty: number;
}

export interface OrderAddress {
  street: string;
  unit?: string;
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
}

/** Customer submits an order (works for anon).
 *  RLS pins new rows to status='new', payment_status='unpaid', tip=0 — payment
 *  and money columns are only ever written by server routes. */
export async function createOrder(
  slug: string,
  input: {
    items: OrderItem[];
    total: number;
    table_no?: string;
    phone?: string;
    note?: string;
    order_type?: OrderType;
    address?: OrderAddress;
    customer_email?: string;
  }
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      tenant_slug: slug,
      items: input.items,
      total: input.total,
      table_no: input.table_no ?? "",
      phone: input.phone ?? "",
      note: input.note ?? "",
      order_type: input.order_type ?? "dine_in",
      address: input.address ?? null,
      customer_email: input.customer_email?.trim() || null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("createOrder", error);
    return { error: error.message };
  }
  return { id: data?.id };
}

/** Start-of-today as an ISO timestamp in the shop's fixed timezone (Toronto),
 *  so the order window is stable for remote owners and across device clocks. */
const SHOP_TZ = "America/Toronto";
function startOfTodayShopTz(): string {
  const now = new Date();
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
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

export async function setOrderStatus(id: string, status: Order["status"]): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) console.error("setOrderStatus", error);
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) console.error("deleteOrder", error);
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
