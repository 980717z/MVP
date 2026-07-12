// ─────────────────────────────────────────────────────────────────────────
//  Bill splitting (分单) — PURE money math, no I/O. Imported by both the client
//  (CheckoutModal) and the server (checkout route), so it must not pull in the
//  browser supabase client. Only depends on computeTax (also pure).
//
//  A split is a presentation + record layer over ONE atomic table settle. The
//  invariant that must hold to the cent:
//    Σ share.subtotal == table.subtotal, Σ share.gst == table.gst,
//    Σ share.pst == table.pst, Σ share.total == table.total.
//  All math is in integer cents; the per-share tax-rounding remainder lands on
//  share 0, so nothing is created or lost.
// ─────────────────────────────────────────────────────────────────────────

import { computeTax } from "./tax";

export type PaymentMethod = "cash" | "card" | "emt" | "other";

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const cents = (n: number) => Math.round((Number(n) || 0) * 100);
const fromCents = (c: number) => Math.round(c) / 100;

export interface ShareLine { name_zh: string; name_en?: string; qty: number; price: number | null }

/** One settled sub-bill — stored in table_sessions.splits and printed separately. */
export interface SplitShare {
  label: string;
  method: PaymentMethod;
  subtotal: number;
  gst: number;
  pst: number;
  total: number;
  tendered?: number | null;   // cash only
  change?: number | null;     // cash only
  tip?: number;               // this payer's tip (pass-through to staff, not sales)
  evenOfN?: number;           // even mode: this share is 1/N
  lines?: ShareLine[];        // itemized mode: this person's dishes (for the receipt)
}

/** Client → server split spec. The server re-taxes authoritatively; the client
 *  sends only the subtotal partition + method + (itemized) lines for the receipt. */
export interface SplitPayload {
  mode: "even" | "item";
  shares: { label: string; method: PaymentMethod; subtotal: number; tendered?: number | null; tip?: number; evenOfN?: number; lines?: ShareLine[] }[];
}

/** Split a subtotal into n cent-exact partitions (remainder cents → earliest shares). */
export function evenPartition(subtotal: number, n: number): number[] {
  const total = cents(subtotal);
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => fromCents(base + (i < rem ? 1 : 0)));
}

/**
 * Tax each share's subtotal independently, then reconcile the gst/pst rounding
 * remainder onto share 0 so per-share components sum EXACTLY to the table's.
 * `partitions` (per-share subtotals, in dollars) MUST already sum to `subtotal`.
 */
export function reconcileShares(subtotal: number, partitions: number[]): { subtotal: number; gst: number; pst: number; hst: number; total: number }[] {
  const table = computeTax(money(subtotal), false);
  const rows = partitions.map((p) => {
    const t = computeTax(money(p), false);
    return { subC: cents(p), gstC: cents(t.gst), pstC: cents(t.pst) };
  });
  if (rows.length) {
    rows[0].gstC += cents(table.gst) - rows.reduce((s, r) => s + r.gstC, 0);
    rows[0].pstC += cents(table.pst) - rows.reduce((s, r) => s + r.pstC, 0);
  }
  return rows.map((r) => ({
    subtotal: fromCents(r.subC),
    gst: fromCents(r.gstC),
    pst: fromCents(r.pstC),
    hst: fromCents(r.gstC + r.pstC),
    total: fromCents(r.subC + r.gstC + r.pstC),
  }));
}

/** True iff the share subtotals sum to the table subtotal, to the cent. */
export function partitionsMatch(subtotal: number, partitions: number[]): boolean {
  return cents(partitions.reduce((a, b) => a + b, 0)) === cents(subtotal);
}

export interface ItemizeResult {
  personSubtotals: number[]; // dollars, index-aligned to peopleIds
  sharedTotal: number;       // dollars sitting in the shared bucket
  unassigned: number;        // units not yet given to a person or 'shared' (a removed person counts here)
  balanced: boolean;         // Σ personSubtotals == subtotal to the cent (only possible when unassigned == 0)
}

/**
 * 按菜分 (itemized): turn the waiter's dish→guest assignment into per-guest
 * subtotals. Each unit goes to a person, to the 'shared' bucket, or is
 * unassigned. The shared bucket is split evenly (remainder cents → earliest
 * guests). A unit assigned to a since-removed guest is treated as unassigned so
 * it resurfaces rather than silently vanishing. Pure + cent-exact.
 */
export function itemizePartitions(
  units: { key: string; price: number }[],
  assignment: Record<string, string>, // unit.key → personId | "shared" | ""
  peopleIds: string[],
  subtotal: number,
): ItemizeResult {
  const n = peopleIds.length;
  const idx = new Map(peopleIds.map((id, i) => [id, i]));
  const perC = new Array<number>(n).fill(0);
  let sharedC = 0, unassigned = 0;
  for (const u of units) {
    const a = assignment[u.key] ?? "";
    if (a === "shared") { sharedC += cents(u.price); continue; }
    const i = a === "" ? undefined : idx.get(a);
    if (i == null) { unassigned++; continue; } // unassigned OR assigned to a removed guest
    perC[i] += cents(u.price);
  }
  if (sharedC > 0 && n > 0) {
    const base = Math.floor(sharedC / n), rem = sharedC - base * n;
    for (let i = 0; i < n; i++) perC[i] += base + (i < rem ? 1 : 0);
  }
  return {
    personSubtotals: perC.map(fromCents),
    sharedTotal: fromCents(sharedC),
    unassigned,
    balanced: unassigned === 0 && perC.reduce((a, b) => a + b, 0) === cents(subtotal),
  };
}
