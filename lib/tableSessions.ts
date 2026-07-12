// ─────────────────────────────────────────────────────────────────────────
//  Table sessions — dine-in floor-plan occupancy + checkout.
//  Occupancy is DERIVED from unpaid dine-in orders (no open-session lifecycle).
//  Checkout goes through the server route (exactly-once posting).
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { Order } from "./orders";
import type { PaymentMethod, SplitPayload } from "./billSplit";

// Split money math lives in the pure ./billSplit module (importable server-side).
export type { PaymentMethod, SplitPayload, SplitShare, ShareLine } from "./billSplit";
export { evenPartition, reconcileShares, partitionsMatch } from "./billSplit";

/** One table's live state, derived from the orders the portal already polls. */
export interface TableState {
  tableNo: string;
  orders: Order[]; // unpaid dine-in rounds at this table
  total: number; // running total across rounds
  hasOrder: boolean;
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
    const cur = map.get(k) ?? { tableNo: k, orders: [], total: 0, hasOrder: true, newestAt: 0 };
    cur.orders.push(o);
    cur.total = money(cur.total + activeTotal(o));
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
  payment_method: PaymentMethod;
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
): Promise<CheckoutResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? "";
  if (!token) return { ok: false, error: "未登录" };
  try {
    const res = await fetch("/api/table/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug, tableNo, paymentMethod, amountTendered: amountTendered ?? null, split: split ?? null }),
    });
    return (await res.json().catch(() => ({ ok: false, error: "解析失败" }))) as CheckoutResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}
