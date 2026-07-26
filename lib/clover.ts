// ─────────────────────────────────────────────────────────────────────────
//  Clover Ecommerce — SERVER ONLY (reads CLOVER_ECOMM_PRIVATE_KEY). Never
//  import into a client component. The card is tokenized client-side by
//  clover.js (public key) into a `clv_` token; the server exchanges that token
//  for a synchronous charge here. Confirmed against the sandbox 2026-07-07:
//  POST /v1/charges returns status:"succeeded" + paid:true in the response —
//  no webhook, no polling. Money settles to the merchant's own MID.
//  Spike: docs/clover-spike.md
// ─────────────────────────────────────────────────────────────────────────

// Charge outcome — the reconcile design hinges on this three-way split:
//   succeeded → money moved, order is paid.
//   declined  → Clover gave a definitive "no" (402 / bad request / non-paid
//               200). NO money moved — safe to reset and let the diner retry.
//   error     → we never got a definitive answer (network throw, timeout, 5xx).
//               The charge MAY have landed. NEVER auto-retry; hold for reconcile.
export type ChargeOutcome = "succeeded" | "declined" | "error";

export interface ChargeResult {
  ok: boolean;
  outcome: ChargeOutcome;
  chargeId?: string;
  brand?: string;
  last4?: string;
  amountCents?: number;
  /** Clean, customer-safe message on decline/failure. */
  error?: string;
}

/** A charge as returned by Clover's list/retrieve endpoints (subset we use). */
export interface CloverCharge {
  id: string;
  amount: number;
  status: string;
  paid: boolean;
  description?: string;
  source?: { brand?: string; last4?: string };
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

/** Stable substring that ties a Clover charge back to an order. Both the charge
 *  description and reconcile's lookup derive from this — keep them in lockstep. */
export function chargeNeedle(orderId: string): string {
  return `#${orderId.slice(0, 8)}`;
}
export function chargeDescription(tenantSlug: string, orderId: string): string {
  return `BentoOS ${tenantSlug} ${chargeNeedle(orderId)}`;
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
  // Config / input errors are definitive: no charge left our process → "declined".
  if (!base || !key || !mid) return { ok: false, outcome: "declined", error: "Payments not configured." };
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) return { ok: false, outcome: "declined", error: "Invalid amount." };
  if (!opts.token?.startsWith("clv_")) return { ok: false, outcome: "declined", error: "Invalid card token." };

  let res: Response;
  try {
    res = await fetch(`${base}/v1/charges`, {
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
  } catch (e: any) {
    // Network threw — the request may or may not have reached Clover. UNKNOWN.
    return { ok: false, outcome: "error", error: e?.message || "Network error reaching the payment processor." };
  }

  const data: any = await res.json().catch(() => ({}));
  if (res.ok && data?.status === "succeeded" && data?.paid) {
    return { ok: true, outcome: "succeeded", chargeId: data.id, brand: data.source?.brand, last4: data.source?.last4, amountCents: data.amount };
  }
  // 5xx = Clover-side failure that MAY have charged before erroring → UNKNOWN.
  if (res.status >= 500) {
    return { ok: false, outcome: "error", error: `Payment processor error (${res.status}).` };
  }
  // Any definitive 4xx / non-succeeded 200: Clover answered and no money moved.
  const msg =
    data?.error?.message ||
    data?.message ||
    (res.status === 402 ? "Card declined." : `Payment failed (${res.status}).`);
  return { ok: false, outcome: "declined", error: msg };
}

/**
 * Find a charge for an order by the orderId we embed in its `description`.
 * Used by reconcile when `clover_checkout_id` is null (the timeout case) to
 * answer "did this order's charge actually land?". Returns the newest paid
 * match, or null. `descriptionNeedle` is the exact substring we wrote at charge
 * time (e.g. "#1a2b3c4d").
 */
export async function cloverFindPaidCharge(descriptionNeedle: string): Promise<CloverCharge | null> {
  const { base, key, mid } = cfg();
  if (!base || !key || !mid) return null;
  try {
    // Clover ecommerce lists newest-first; a small page is plenty for reconcile.
    const res = await fetch(`${base}/v1/charges?limit=100`, {
      headers: { Authorization: `Bearer ${key}`, "X-Clover-Merchant-Id": mid },
    });
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => ({}));
    const list: CloverCharge[] = data?.elements || data?.data || data?.charges || [];
    const hit = list.find(
      (c) => c.paid && c.status === "succeeded" && (c.description || "").includes(descriptionNeedle),
    );
    return hit ?? null;
  } catch {
    return null;
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
