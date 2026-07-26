// Ontario sales tax. HST 13% = 5% federal (GST) + 8% provincial.
// Single source of truth for the Sales ledger, dish-margin columns, and
// order-completion posting. If BentoOS later serves other provinces, make
// these per-tenant (e.g. QC: GST 5% + QST 9.975%).
export const GST_RATE = 0.05;
export const PST_RATE = 0.08;
export const HST_RATE = GST_RATE + PST_RATE;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface TaxBreakdown {
  subtotal: number; // pre-tax
  gst: number; // federal 5%
  pst: number; // provincial 8%
  total: number; // after-tax
}

/**
 * Break an amount into subtotal + GST + PST + total.
 * @param amount the figure the user typed
 * @param taxIncluded true if `amount` already includes tax (extract it);
 *                     false (default) if tax is added on top.
 */
export function computeTax(amount: number, taxIncluded = false): TaxBreakdown {
  const subtotal = r2(taxIncluded ? amount / (1 + HST_RATE) : amount);
  const gst = r2(subtotal * GST_RATE);
  const pst = r2(subtotal * PST_RATE);
  // total = sum of the ROUNDED lines, so the displayed breakdown always adds up
  return { subtotal, gst, pst, total: r2(subtotal + gst + pst) };
}

// ── QR ordering: order types, delivery pricing, zone validation ────────────
// Business rules (CEO plan D4-D7, 2026-07-03):
//   dine-in   total = subtotal × 1.13 (+ optional phone-pay tip, untaxed)
//   togo      total = subtotal × 1.13            (pay online first)
//   delivery  total = subtotal × 1.13 + 10% tip  (pay first; subtotal ≥ $30)
//   Tip = 10% of PRE-TAX subtotal; tips are never taxed.

export type OrderType = "dine_in" | "togo" | "delivery" | "pickup";

export const DELIVERY_TIP_RATE = 0.10;
export const DELIVERY_MIN_SUBTOTAL = 30;

export interface OrderPricing extends TaxBreakdown {
  tip: number; // untaxed; on top of `total`
  grandTotal: number; // total + tip — what the customer actually pays
}

/**
 * Full pricing for an order. `tipRate` applies only when explicitly passed
 * (delivery = mandatory 0.10; dine-in phone pay = diner-selected 0/.10/.15/.18).
 */
export function priceOrder(subtotal: number, tipRate = 0): OrderPricing {
  const base = computeTax(subtotal, false);
  const tip = r2(subtotal * tipRate);
  return { ...base, tip, grandTotal: r2(base.total + tip) };
}

/** How far below the delivery minimum this subtotal is (0 = meets it). */
export function deliveryShortfall(subtotal: number): number {
  return subtotal >= DELIVERY_MIN_SUBTOTAL ? 0 : r2(DELIVERY_MIN_SUBTOTAL - subtotal);
}

/** Extract the FSA (first 3 chars, "M5T") from a postal code, tolerant of case/spacing. */
export function postalFsa(postal: string): string {
  return (postal || "").replace(/\s+/g, "").toUpperCase().slice(0, 3);
}

/** Basic Canadian postal shape check: A1A 1A1 (space optional). */
export function isValidPostal(postal: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test((postal || "").trim());
}

/** True if the postal code's FSA is inside the shop's delivery zone. */
export function inDeliveryZone(postal: string, fsas: string[]): boolean {
  const fsa = postalFsa(postal);
  return fsa.length === 3 && fsas.map((f) => f.toUpperCase()).includes(fsa);
}
