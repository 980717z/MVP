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
  const subtotal = taxIncluded ? amount / (1 + HST_RATE) : amount;
  const gst = subtotal * GST_RATE;
  const pst = subtotal * PST_RATE;
  return { subtotal: r2(subtotal), gst: r2(gst), pst: r2(pst), total: r2(subtotal + gst + pst) };
}
