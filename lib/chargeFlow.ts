// ─────────────────────────────────────────────────────────────────────────
//  Charge pipeline — the money path, extracted from the route so it is fully
//  unit/integration-testable without network or a live DB. The route wires an
//  OrderStore over supabaseAdmin and passes the real cloverCharge; tests pass an
//  in-memory store + a fake charge fn.
//
//  State machine (payment_status):
//
//    unpaid ──claim(CAS)──▶ pending ──charge──▶ succeeded ──▶ paid
//      ▲                       │  │                              (retry write 3×)
//      │                       │  └─ declined ──reset──▶ unpaid  (diner retries)
//      └──────reset────────────┘     error(unknown) ──▶ reconcile_pending
//                                                          │
//                              app/api/pay/reconcile ◀─────┘  asks Clover:
//                                landed? → paid   not? → unpaid
//
//  Two invariants:
//   • Only ONE request can hold `pending` (CAS on unpaid→pending) → no double
//     charge from concurrent distinct-token requests.
//   • A charge whose outcome is UNKNOWN is NEVER auto-retried — it parks in
//     reconcile_pending. Resetting it to unpaid would let the diner re-charge a
//     card that may already have been billed.
// ─────────────────────────────────────────────────────────────────────────

import { repriceOrder, toCents } from "./payments";
import { cloverCharge, chargeDescription, type ChargeResult } from "./clover";
import type { OrderItem } from "./orders";
import type { MenuItem } from "./menu";
import type { OrderType } from "./tax";

/** The exact order fields the pipeline reads. */
export interface ChargeableOrder {
  id: string;
  tenant_slug: string;
  order_type: OrderType;
  payment_status: string;
  items: OrderItem[];
  customer_email?: string | null;
}

/** The DB operations the pipeline needs — implemented over supabaseAdmin in the
 *  route, faked in tests. Every mutation is a CAS so concurrency is honest. */
export interface OrderStore {
  loadOrder(id: string): Promise<ChargeableOrder | null>;
  loadMenu(tenantSlug: string): Promise<MenuItem[]>;
  /** CAS unpaid→pending. Returns true only for the caller that won the claim. */
  claimPending(id: string): Promise<boolean>;
  /** CAS pending→paid with the priced fields. Returns true if the row was written. */
  markPaid(id: string, fields: PaidFields): Promise<boolean>;
  /** Release a claim back to unpaid (definitive decline / reprice reject). */
  resetUnpaid(id: string): Promise<void>;
  /** Park an unknown-outcome charge for the reconcile sweep. */
  markReconcile(id: string): Promise<void>;
}

export interface PaidFields {
  payment_method: string;
  paid_at: string;
  clover_checkout_id?: string;
  subtotal: number;
  gst: number;
  pst: number;
  tip: number;
  total: number;
}

export interface ChargeFlowDeps {
  store: OrderStore;
  charge?: typeof cloverCharge;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
}

export interface ChargeFlowInput {
  orderId: string;
  token: string;
  /** Cents the diner was shown (quote-then-pay). We never charge above this. */
  quotedCents?: number;
}

export interface ChargeFlowResult {
  http: number;
  body: Record<string, unknown>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runChargeFlow(input: ChargeFlowInput, deps: ChargeFlowDeps): Promise<ChargeFlowResult> {
  const { store } = deps;
  const charge = deps.charge ?? cloverCharge;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date().toISOString());
  const { orderId, token, quotedCents } = input;

  const order = await store.loadOrder(orderId);
  // Normalize "not found" and "not payable" to ONE response so an attacker
  // can't probe which order ids exist (404 vs 400 leak).
  if (!order || (order.order_type !== "togo" && order.order_type !== "delivery")) {
    return { http: 400, body: { ok: false, error: "该订单无法在线支付" } };
  }
  if (order.payment_status === "paid") {
    return { http: 200, body: { ok: true, alreadyPaid: true } };
  }
  if (order.payment_status === "pending" || order.payment_status === "reconcile_pending") {
    return { http: 409, body: { ok: false, error: "支付处理中，请稍候", inProgress: true } };
  }

  // Claim: CAS unpaid→pending. A concurrent request loses here and bails.
  const claimed = await store.claimPending(orderId);
  if (!claimed) {
    const fresh = await store.loadOrder(orderId);
    if (fresh?.payment_status === "paid") return { http: 200, body: { ok: true, alreadyPaid: true } };
    return { http: 409, body: { ok: false, error: "支付处理中，请稍候", inProgress: true } };
  }

  // Re-price from the live menu (server-authoritative).
  const menu = await store.loadMenu(order.tenant_slug);
  const rp = repriceOrder(order.items, menu, order.order_type);
  if (!rp.ok || !rp.pricing) {
    await store.resetUnpaid(orderId);
    return { http: 400, body: { ok: false, error: rp.error ?? "订单计价失败" } };
  }
  const amountCents = toCents(rp.pricing.grandTotal);

  // Never charge more than the diner was shown. A stale-low quote (menu went
  // UP after the quote) is the only reject; going down just charges less.
  if (typeof quotedCents === "number" && amountCents > quotedCents) {
    await store.resetUnpaid(orderId);
    return { http: 409, body: { ok: false, error: "菜单价格已更新，请刷新后重试", priceChanged: true } };
  }

  const result: ChargeResult = await charge({
    amountCents,
    token,
    // orderId+token: an identical double-tap dedupes; a NEW card is a fresh
    // charge (not a replayed decline).
    idempotencyKey: `${orderId}:${token}`,
    description: chargeDescription(order.tenant_slug, orderId),
    email: order.customer_email ?? undefined,
  });

  if (result.outcome === "declined") {
    await store.resetUnpaid(orderId);
    return { http: 402, body: { ok: false, error: result.error ?? "支付失败，请换一张卡重试" } };
  }
  if (result.outcome === "error") {
    // UNKNOWN — may have charged. Park for reconcile; block any retry.
    await store.markReconcile(orderId);
    return {
      http: 409,
      body: { ok: false, error: "支付确认中，请勿重复支付，我们会尽快为你确认", reconcile: true },
    };
  }

  // Succeeded — write paid, retrying transient DB failures so we never strand a
  // charged order (kitchen gate needs payment_status='paid').
  const paid: PaidFields = {
    payment_method: "online",
    paid_at: now(),
    clover_checkout_id: result.chargeId,
    subtotal: rp.pricing.subtotal,
    gst: rp.pricing.gst,
    pst: rp.pricing.pst,
    tip: rp.pricing.tip,
    total: rp.pricing.grandTotal,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await store.markPaid(orderId, paid)) {
      return {
        http: 200,
        body: { ok: true, chargeId: result.chargeId, brand: result.brand, last4: result.last4, amount: rp.pricing.grandTotal },
      };
    }
    if (attempt < 2) await sleep(150 * (attempt + 1));
  }

  // Charged at Clover but we couldn't mark paid. Park for reconcile (best
  // effort) and tell the client it's confirming — NOT a hard success it can
  // clear the cart on.
  await store.markReconcile(orderId).catch(() => {});
  return { http: 202, body: { ok: false, pending: true, error: "支付确认中，请稍候", chargeId: result.chargeId } };
}
