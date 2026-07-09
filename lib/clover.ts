// ─────────────────────────────────────────────────────────────────────────
//  Clover Ecommerce — SERVER ONLY (reads CLOVER_ECOMM_PRIVATE_KEY). Never
//  import into a client component. The card is tokenized client-side by
//  clover.js (public key) into a `clv_` token; the server exchanges that token
//  for a synchronous charge here. Confirmed against the sandbox 2026-07-07:
//  POST /v1/charges returns status:"succeeded" + paid:true in the response —
//  no webhook, no polling. Money settles to the merchant's own MID.
//  Spike: docs/clover-spike.md
// ─────────────────────────────────────────────────────────────────────────

export interface ChargeResult {
  ok: boolean;
  chargeId?: string;
  brand?: string;
  last4?: string;
  amountCents?: number;
  /** Clean, customer-safe message on decline/failure. */
  error?: string;
}

function cfg() {
  return {
    base: process.env.CLOVER_BASE,
    key: process.env.CLOVER_ECOMM_PRIVATE_KEY,
    mid: process.env.CLOVER_MERCHANT_ID,
  };
}

/** True when the server has the keys to charge. Routes gate on this. */
export function cloverConfigured(): boolean {
  const c = cfg();
  return !!(c.base && c.key && c.mid);
}

/**
 * Charge a tokenized card. `amountCents` is the SERVER-computed total (never
 * trust the client). Returns ok:false with a clean message on decline/error —
 * callers must NOT mark the order paid unless ok:true.
 */
export async function cloverCharge(opts: {
  amountCents: number;
  token: string; // clv_… from clover.js
  description?: string;
  email?: string;
  /** dedupes accidental double-submits at Clover's side */
  idempotencyKey?: string;
}): Promise<ChargeResult> {
  const { base, key, mid } = cfg();
  if (!base || !key || !mid) return { ok: false, error: "Payments not configured." };
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) return { ok: false, error: "Invalid amount." };
  if (!opts.token?.startsWith("clv_")) return { ok: false, error: "Invalid card token." };

  try {
    const res = await fetch(`${base}/v1/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Clover-Merchant-Id": mid,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        amount: opts.amountCents,
        currency: "cad",
        source: opts.token,
        ecomind: "ecom",
        ...(opts.description ? { description: opts.description } : {}),
        ...(opts.email ? { receipt_email: opts.email } : {}),
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.status === "succeeded" && data?.paid) {
      return { ok: true, chargeId: data.id, brand: data.source?.brand, last4: data.source?.last4, amountCents: data.amount };
    }
    // Decline or error — Clover returns an `error` object (Stripe-shaped).
    const msg =
      data?.error?.message ||
      data?.message ||
      (res.status === 402 ? "Card declined." : `Payment failed (${res.status}).`);
    return { ok: false, error: msg };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error reaching the payment processor." };
  }
}

/** Refund a charge in full (used when staff cancels a paid togo/delivery order). */
export async function cloverRefund(chargeId: string): Promise<{ ok: boolean; error?: string }> {
  const { base, key, mid } = cfg();
  if (!base || !key || !mid) return { ok: false, error: "Payments not configured." };
  try {
    const res = await fetch(`${base}/v1/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "X-Clover-Merchant-Id": mid, "Content-Type": "application/json" },
      body: JSON.stringify({ charge: chargeId }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && (data?.status === "succeeded" || data?.id)) return { ok: true };
    return { ok: false, error: data?.error?.message || `Refund failed (${res.status}).` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error." };
  }
}
