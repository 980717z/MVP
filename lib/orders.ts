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
  payment_status: "unpaid" | "pending" | "paid" | "expired" | "refunded" | "reconcile_pending";
  payment_method: "" | "server" | "online";
  tip: number;
  subtotal: number | null; // server-written at re-price; null until then
  gst: number | null;
  pst: number | null;
  customer_email: string | null;
  address: OrderAddress | null;
  eta_minutes: number | null;
  paid_at: string | null;
  printed_at: string | null; // Epson: kitchen ticket, null = needs printing
  bill_at: string | null; // customer bill requested (queued for the printer)
  bill_printed_at: string | null; // customer bill printed; null while pending
}

/** UUID v4 with a fallback for older mobile browsers. */
function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Customer submits an order (works for anon).
 *  RLS pins new rows to status='new', payment_status='unpaid', tip=0 — payment
 *  and money columns are only ever written by server routes.
 *  NOTE: the id is generated CLIENT-SIDE and inserted, never read back —
 *  anon has insert-only permission on orders, so `.select()` after insert
 *  fails with "permission denied" (RETURNING needs SELECT). */
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
  const id = newId();
  const { error } = await supabase.from("orders").insert({
    id,
    tenant_slug: slug,
    items: input.items,
    total: input.total,
    table_no: input.table_no ?? "",
    // phone is NOT NULL + must match orders_phone_chk (10-digit / +intl / 'N/A').
    // A blank phone (e.g. a dine-in order with no number) is stored as the
    // sentinel "N/A" so the insert can't fail — see supabase/phone-na.sql.
    phone: (input.phone ?? "").trim() || "N/A",
    note: input.note ?? "",
    order_type: input.order_type ?? "dine_in",
    address: input.address ?? null,
    customer_email: input.customer_email?.trim() || null,
  });
  if (error) {
    console.error("createOrder", error);
    return { error: error.message };
  }
  return { id };
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

/** Queue the customer bill (priced 账单) for the printer. Setting bill_printed_at
 *  back to null also serves as a reprint. */
export async function requestBill(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("orders")
    .update({ bill_at: new Date().toISOString(), bill_printed_at: null })
    .eq("id", id);
  if (error) {
    console.error("requestBill", error);
    return { error: error.message };
  }
  return {};
}

/** Re-queue every ACTIVE order (new / preparing) for printing — one click after
 *  a printer/network outage so the kitchen gets every current ticket. Orders the
 *  printer never received already have printed_at=null (auto-print on reconnect);
 *  this also recovers ones marked printed but never physically printed.
 *  Returns how many were re-queued. */
export async function reprintActiveOrders(slug: string): Promise<number> {
  const { data, error } = await supabase
    .from("orders")
    .update({ printed_at: null })
    .eq("tenant_slug", slug)
    .in("status", ["new", "preparing"])
    .select("id");
  if (error) { console.error("reprintActiveOrders", error); return 0; }
  return data?.length ?? 0;
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
