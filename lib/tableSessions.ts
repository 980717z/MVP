// ─────────────────────────────────────────────────────────────────────────
//  Table sessions — dine-in floor-plan occupancy + checkout.
//  Occupancy is DERIVED from unpaid dine-in orders (no open-session lifecycle).
//  Checkout goes through the server route (exactly-once posting).
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { Order } from "./orders";
import type { PaymentMethod, SplitPayload } from "./billSplit";

// Split money math lives in the pure ./billSplit module (importable server-side).
export type { PaymentMethod, SplitPayload, SplitShare, ShareLine, ItemizeResult } from "./billSplit";
export { evenPartition, reconcileShares, partitionsMatch, itemizePartitions } from "./billSplit";

/** One table's live state, derived from the orders the portal already polls. */
export interface TableState {
  tableNo: string;
  orders: Order[]; // unpaid dine-in rounds at this table
  total: number; // running total across rounds
  hasOrder: boolean;
  served: boolean; // 已出餐: ≥1 active dish marked served (any-served → orange)
  newestAt: number; // ms of the most recent order (for the "new" cue)
  /** ms of the FIRST unpaid round at this table — the table's total wait.
   *  The floor plan shows this (not newestAt) so a table seated 40 minutes ago
   *  can't look fresh just because someone added a drink round. */
  oldestAt: number;
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const activeTotal = (o: Order) =>
  money((o.items ?? []).filter((it) => !(it as { cancelled?: boolean }).cancelled).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0));

/**
 * Group unpaid dine-in orders by table → occupancy for the floor plan.
 * Pure: pass the orders the portal already has. A table is "has-order" iff it
 * carries ≥1 unpaid dine-in order; everything else renders empty.
 */
export function tableOccupancy(orders: Order[]): Map<string, TableState> {
  const map = new Map<string, TableState>();
  for (const o of orders) {
    if (o.order_type !== "dine_in" || o.payment_status !== "unpaid" || o.status === "cancelled") continue;
    const k = (o.table_no || "").trim();
    if (!k) continue;
    const cur = map.get(k) ?? { tableNo: k, orders: [], total: 0, hasOrder: true, served: false, newestAt: 0, oldestAt: 0 };
    cur.orders.push(o);
    cur.total = money(cur.total + activeTotal(o));
    cur.served = cur.served || (o.items ?? []).some((it) => !(it as { cancelled?: boolean }).cancelled && (it as { served?: boolean }).served);
    const at = new Date(o.created_at).getTime();
    // Guard the reduce against an unparseable created_at: NaN would poison both
    // Math.max and Math.min and blank the timer for the whole table.
    if (Number.isFinite(at)) {
      cur.newestAt = Math.max(cur.newestAt, at);
      cur.oldestAt = cur.oldestAt === 0 ? at : Math.min(cur.oldestAt, at);
    }
    map.set(k, cur);
  }
  return map;
}

/**
 * Live dine-in orders whose table_no matches NO configured table.
 *
 * Why this exists: the customer menu locks `?t=<label>` straight from the QR
 * with no validation (app/menu/[tenant]/page.tsx). A card printed with a typo,
 * a retired label, or the wrong case ("2a" vs "2A") still saves an order and
 * still prints to the kitchen — but tableOccupancy keys it under a label the
 * floor plan never renders, so it lands on NO table and is invisible. Silent
 * drop. This surfaces those orders so a mis-printed sign fails LOUD.
 *
 * Same liveness filter as tableOccupancy (unpaid, dine-in, not cancelled), so
 * an order appears in exactly one place: a real table node, or this list.
 * Comparison is exact — case and whitespace included — because that is what
 * tableOccupancy keys on. Matching loosely here would hide the very typo class
 * this is built to catch.
 */
export function unknownTableOrders(orders: Order[], tables: string[]): Order[] {
  const known = new Set(tables.map((t) => (t ?? "").trim()).filter(Boolean));
  // No tables configured yet → nothing is "unknown" (a brand-new tenant would
  // otherwise see every order flagged). Occupancy still renders them normally.
  if (known.size === 0) return [];
  return orders.filter((o) => {
    if (o.order_type !== "dine_in" || o.payment_status !== "unpaid" || o.status === "cancelled") return false;
    const k = (o.table_no || "").trim();
    // Blank table_no is a staff/phone order with no table, not a bad QR label.
    return k !== "" && !known.has(k);
  });
}

/** A past checkout record (for a table's "paid history" in the sheet). */
export interface TableCheckout {
  id: string;
  table_no: string;
  closed_at: string;
  payment_method: PaymentMethod | "split"; // 'split' = the table was 分单-settled

  amount_tendered: number | null;
  change_given: number | null;
  subtotal: number;
  total: number;
}

/** Checkout records for ONE business day (defaults to un-filtered — pass the
 *  shop's current business_date to scope to "today"). Newest first. Without a
 *  businessDate this returns the last 50 across all history, which is only ever
 *  right for a raw dump; the table sheet always passes today's business_date so
 *  the "paid today" list can't bleed into prior days. */
export async function listTableCheckouts(slug: string, tableNo?: string, businessDate?: string): Promise<TableCheckout[]> {
  let q = supabase
    .from("table_sessions")
    .select("id,table_no,closed_at,payment_method,amount_tendered,change_given,subtotal,total")
    .eq("tenant_slug", slug)
    .order("closed_at", { ascending: false })
    .limit(200);
  if (tableNo) q = q.eq("table_no", tableNo);
  if (businessDate) q = q.eq("business_date", businessDate);
  const { data, error } = await q;
  if (error) {
    console.error("listTableCheckouts", error);
    return [];
  }
  return (data ?? []) as TableCheckout[];
}

/** Checkout rows in a business-date range [from, to] (inclusive), for 销售统计.
 *  Pulls the fields the aggregator needs, splits + tip included. */
export async function listSessionsInRange(slug: string, from: string, to: string): Promise<import("./salesStats").SessionRow[]> {
  const { data, error } = await supabase
    .from("table_sessions")
    .select("id,table_no,closed_at,business_date,payment_method,subtotal,gst,pst,total,tip,splits")
    .eq("tenant_slug", slug)
    .gte("business_date", from)
    .lte("business_date", to)
    .order("closed_at", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("listSessionsInRange", error);
    return [];
  }
  return (data ?? []) as import("./salesStats").SessionRow[];
}

/** Dishes billed on a settled table session — the merged items of every order the
 *  checkout claimed (orders.table_session_id was stamped at settle). Sorted oldest
 *  round first, cancelled items dropped. Empty for pre-feature/togo sessions (which
 *  never carried a table_session_id) — the caller shows a graceful empty state. */
export interface SessionItem { name_zh: string; name_en: string; qty: number; price: number | null; note?: string; adjust?: number }
/** Order ids for a settled session — used to re-queue the combined bill (总单)
 *  to the printer (requestBill nulls bill_printed_at → the Epson merges the
 *  table's pending orders and reprints). */
export async function listSessionOrderIds(sessionId: string): Promise<string[]> {
  if (!sessionId) return [];
  const { data, error } = await supabase.from("orders").select("id").eq("table_session_id", sessionId);
  if (error) {
    console.error("listSessionOrderIds", error);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((o) => o.id);
}

export async function listSessionOrders(sessionId: string): Promise<SessionItem[]> {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("items,created_at")
    .eq("table_session_id", sessionId)
    .order("created_at", { ascending: true });
  // THROW on a real query error so callers can tell "load failed" from "genuinely
  // no items" (a settled session with zero linked orders returns []). An error
  // that renders as an empty list misleads staff mid-service.
  if (error) {
    console.error("listSessionOrders", error);
    throw new Error(error.message);
  }
  const out: SessionItem[] = [];
  for (const o of (data ?? []) as { items?: SessionItem[] & { cancelled?: boolean }[] }[]) {
    for (const it of (o.items ?? []) as (SessionItem & { cancelled?: boolean })[]) {
      if (it.cancelled) continue;
      out.push({ name_zh: it.name_zh, name_en: it.name_en, qty: Number(it.qty) || 1, price: it.price, note: it.note, adjust: it.adjust });
    }
  }
  return out;
}

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  needsPricing?: boolean;
  empty?: boolean;
  alreadyDone?: boolean;
  sessionId?: string;
  subtotal?: number;
  hst?: number;
  total?: number;
  change?: number | null;
}

/**
 * Settle a table. Server route claims the table's unpaid dine-in orders
 * atomically (exactly-once), records the payment, and posts sales.
 */
export async function checkoutTable(
  slug: string,
  tableNo: string,
  paymentMethod: PaymentMethod,
  amountTendered?: number | null,
  split?: SplitPayload | null,
  tip?: number | null,
): Promise<CheckoutResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? "";
  if (!token) return { ok: false, error: "未登录" };
  try {
    const res = await fetch("/api/table/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug, tableNo, paymentMethod, amountTendered: amountTendered ?? null, split: split ?? null, tip: tip ?? null }),
    });
    return (await res.json().catch(() => ({ ok: false, error: "解析失败" }))) as CheckoutResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}
