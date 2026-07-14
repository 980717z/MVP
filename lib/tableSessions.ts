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
    const cur = map.get(k) ?? { tableNo: k, orders: [], total: 0, hasOrder: true, served: false, newestAt: 0 };
    cur.orders.push(o);
    cur.total = money(cur.total + activeTotal(o));
    cur.served = cur.served || (o.items ?? []).some((it) => !(it as { cancelled?: boolean }).cancelled && (it as { served?: boolean }).served);
    cur.newestAt = Math.max(cur.newestAt, new Date(o.created_at).getTime());
    map.set(k, cur);
  }
  return map;
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

/** Today's checkout records, optionally for one table (newest first). */
export async function listTableCheckouts(slug: string, tableNo?: string): Promise<TableCheckout[]> {
  let q = supabase
    .from("table_sessions")
    .select("id,table_no,closed_at,payment_method,amount_tendered,change_given,subtotal,total")
    .eq("tenant_slug", slug)
    .order("closed_at", { ascending: false })
    .limit(50);
  if (tableNo) q = q.eq("table_no", tableNo);
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
export async function listSessionOrders(sessionId: string): Promise<SessionItem[]> {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("items,created_at")
    .eq("table_session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listSessionOrders", error);
    return [];
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
