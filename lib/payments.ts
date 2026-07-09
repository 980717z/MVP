// ─────────────────────────────────────────────────────────────────────────
//  Server-authoritative order re-pricing. NEVER trust the client's amount:
//  validate every line's price against the live menu, reject tampering, then
//  recompute subtotal + HST + delivery tip. Pure + unit-tested; runs in the
//  charge route before money moves. Market (时价) items can't be pre-paid.
// ─────────────────────────────────────────────────────────────────────────

import { priceOrder, DELIVERY_TIP_RATE, DELIVERY_MIN_SUBTOTAL, type OrderPricing, type OrderType } from "./tax";
import type { OrderItem } from "./orders";
import type { MenuItem } from "./menu";

export interface RepriceResult {
  ok: boolean;
  error?: string;
  subtotal?: number;
  pricing?: OrderPricing;
}

/** Valid orderable prices for a dish: the variant prices when multi-size/choice,
 *  else the single price. A market dish has no fixed price → empty (can't pre-pay). */
export function validPrices(dish: MenuItem): number[] {
  if (dish.is_market && (dish.variants?.length ?? 0) === 0) return [];
  if ((dish.variants?.length ?? 0) > 0) {
    // priceless (market) variants don't count as payable prices
    return dish.variants.map((v) => Number(v.price)).filter((p) => p > 0);
  }
  const p = Number(dish.price);
  return p > 0 ? [p] : [];
}

/**
 * Recompute an order's total from the authoritative menu.
 * @param items   the order's stored line items (id + claimed price + qty)
 * @param menu    the tenant's current menu_items
 * @param orderType dine_in | togo | delivery (delivery adds a 10% tip + $30 min)
 */
export function repriceOrder(items: OrderItem[], menu: MenuItem[], orderType: OrderType): RepriceResult {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "订单为空" };
  const byId = new Map(menu.map((m) => [m.id, m]));
  let subtotal = 0;

  for (const it of items) {
    if (it.market) return { ok: false, error: "时价菜品不支持在线支付" };
    const dish = byId.get(it.id);
    if (!dish) return { ok: false, error: `菜品不存在或已下架：${it.name_zh}` };
    if (!Number.isInteger(it.qty) || it.qty <= 0) return { ok: false, error: `数量无效：${it.name_zh}` };
    const price = Number(it.price);
    const ok = validPrices(dish).some((p) => Math.abs(p - price) < 0.005);
    if (!ok) return { ok: false, error: `价格与菜单不符：${it.name_zh}` };
    subtotal += price * it.qty;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  if (orderType === "delivery" && subtotal < DELIVERY_MIN_SUBTOTAL) {
    return { ok: false, error: `配送需满 $${DELIVERY_MIN_SUBTOTAL}，当前 $${subtotal.toFixed(2)}` };
  }
  const tipRate = orderType === "delivery" ? DELIVERY_TIP_RATE : 0;
  return { ok: true, subtotal, pricing: priceOrder(subtotal, tipRate) };
}

/** Dollars → integer cents for the Clover charge amount. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface ValidateResult {
  ok: boolean;
  error?: string;
  items?: OrderItem[]; // normalized: market items' price forced to null
  subtotal?: number; // pre-tax; market items contribute 0 (priced at completion)
}

/**
 * Validate + recompute an order's line items and subtotal against the live
 * menu AT CREATION TIME. Unlike repriceOrder (used right before an online
 * charge), this tolerates 时价/market items — their price is genuinely
 * unknown until staff enters it at completion, so they contribute 0 to the
 * subtotal here rather than being rejected outright.
 */
export function validateOrderItems(items: OrderItem[], menu: MenuItem[]): ValidateResult {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "订单为空" };
  const byId = new Map(menu.map((m) => [m.id, m]));
  let subtotal = 0;
  const normalized: OrderItem[] = [];

  for (const it of items) {
    const dish = byId.get(it.id);
    if (!dish) return { ok: false, error: `菜品不存在或已下架：${it.name_zh}` };
    if (!Number.isInteger(it.qty) || it.qty <= 0 || it.qty > 999) return { ok: false, error: `数量无效：${it.name_zh}` };
    if (it.market) {
      if (!dish.is_market) return { ok: false, error: `菜品不是时价：${it.name_zh}` };
      normalized.push({ ...it, price: null });
      continue;
    }
    const price = Number(it.price);
    const ok = validPrices(dish).some((p) => Math.abs(p - price) < 0.005);
    if (!ok) return { ok: false, error: `价格与菜单不符：${it.name_zh}` };
    normalized.push({ ...it, price });
    subtotal += price * it.qty;
  }

  return { ok: true, items: normalized, subtotal: Math.round(subtotal * 100) / 100 };
}
