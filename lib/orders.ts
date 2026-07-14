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
  /** Staff per-item note (e.g. 加一条鱼); prints under the dish on the bill + kitchen ticket. */
  note?: string;
  /** Staff price adjustment applied to this line (± dollars), already folded into `price`.
   *  Carried separately so the PRICED bill can annotate the reason line "加炒底 +$5.00".
   *  Kitchen ticket ignores it (kitchen doesn't handle money). Absent = no adjustment. */
  adjust?: number;
  /** 已出餐: this dish has been served to the table (floor-plan only; not a kitchen status). */
  served?: boolean;
  /** true for items the kitchen doesn't cook (drinks / plain rice). A round that is
   *  ALL no-kitchen items skips the kitchen ticket; it still prints on the bill. */
  noKitchen?: boolean;
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
  // Campus order-ahead PICKUP (supabase/campus-pickup.sql). Additive timestamps —
  // status enum stays untouched. ready_at set → fires the consumer "ready" push;
  // picked_up_at set → order settled. tracking_token = server capability for the
  // anon pickup-tracking read (NOT the order UUID); pickup_code = shown at the truck.
  ready_at: string | null;
  picked_up_at: string | null;
  pickup_code: string | null;
  tracking_token: string | null;
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

// ── Campus PICKUP lifecycle ────────────────────────────────────────────────
//  Fulfillment state rides on additive timestamps (eta_minutes / ready_at /
//  picked_up_at); the status enum is untouched. Consumer step is derived in
//  lib/pickup.ts: new→1, preparing→2, ready_at→3, picked_up_at→4.

/** Accept a pickup order and set the prep ETA: new → preparing + eta_minutes.
 *  Moving to "preparing" advances the consumer tracker to step 2 ("制作中"). */
export async function acceptPickup(id: string, etaMinutes: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "preparing", eta_minutes: etaMinutes })
    .eq("id", id);
  if (error) {
    console.error("acceptPickup", error);
    return { error: error.message };
  }
  return {};
}

/** CAS-flip a pickup order to READY: stamp ready_at exactly once (WHERE
 *  ready_at IS NULL) so the consumer "ready" push fires a single time even on
 *  double-tap or two staff devices. Returns readied=true only for the winner. */
export async function markPickupReady(id: string): Promise<{ readied: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .update({ ready_at: new Date().toISOString() })
    .eq("id", id)
    .is("ready_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("markPickupReady", error);
    return { readied: false, error: error.message };
  }
  return { readied: !!data };
}

/** CAS-claim pickup completion: stamp picked_up_at + status "done" exactly once
 *  (WHERE picked_up_at IS NULL), so sales/dish/member posting runs a single time
 *  — the pickup analogue of claimOrderDone. */
export async function claimPickedUp(id: string): Promise<{ claimed: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "done", picked_up_at: new Date().toISOString() })
    .eq("id", id)
    .is("picked_up_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("claimPickedUp", error);
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

/** Queue the customer bill (priced 账单) for the printer. Pass several ids to bill
 *  a whole dine-in table's rounds (加餐) as ONE merged bill — the printer poll
 *  combines every pending-bill order at that table. Nulling bill_printed_at also
 *  serves as a reprint. */
export async function requestBill(ids: string | string[]): Promise<{ error?: string }> {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return {};
  const { error } = await supabase
    .from("orders")
    .update({ bill_at: new Date().toISOString(), bill_printed_at: null })
    .in("id", list);
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

/** Mark dishes 已出餐 (served). itemIndex set → one dish; omitted → every active dish
 *  in the order. Floor-plan only — does not touch total or the kitchen status. */
export async function markServed(id: string, served: boolean, itemIndex?: number): Promise<void> {
  const { data, error: fetchErr } = await supabase.from("orders").select("items").eq("id", id).maybeSingle();
  if (fetchErr || !data) return;
  const items: (OrderItem & { cancelled?: boolean })[] = data.items ?? [];
  const next = items.map((it, i) => ((itemIndex == null || i === itemIndex) && !it.cancelled ? { ...it, served } : it));
  const { error } = await supabase.from("orders").update({ items: next }).eq("id", id);
  if (error) console.error("markServed", error);
}
